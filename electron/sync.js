// electron/sync.js
const path = require("path");
const fs = require("fs");
const { EventEmitter } = require("events");
const db = require("./db");

const syncEvents = new EventEmitter();

// Helper fetch no processo main (Node/Electron)
const fetchFn = global.fetch
  ? global.fetch
  : (...args) =>
      import("node-fetch").then(({ default: fetch }) => fetch(...args));

const SYNC_PULL_INTERVAL_MS = Number(
  process.env.SYNC_PULL_INTERVAL_MS || 3000
); // 3s fixo para polling de pedidos/entregas
const SYNC_STATE_FILENAME = "sync-state.json";
const SYNC_SETTINGS_FILENAME = "sync-settings.json";
const SYNC_LAST_PUSH_FILENAME = "sync-last-push.json";
const SYNC_ITEM_COLLECTIONS = new Set([
  "products",
  "customers",
  "orders",
  "motoboys",
  "cashSessions",
  "settings",
]);
const BOOTSTRAP_COLLECTIONS = new Set([
  "products",
  "customers",
  "orders",
  "motoboys",
  "cashSessions",
  "settings",
]);

let syncTimer = null;
let syncInProgress = false;
let syncStateLoaded = false;
let syncState = { lastSyncByCollection: {} };
let syncStatus = {
  online: false,
  lastPullAt: null,
  lastPullError: null,
  lastPullErrorCode: null,
  lastPullErrorType: null,
  lastPushAt: null,
  lastPushError: null,
  queueRemaining: 0,
  lastNewOrdersAt: null,
  lastNewOrdersCount: 0,
};
let syncRetryTimer = null;
let syncRetryAttempt = 0;
let notificationsEnabled = true;
let notificationsSoundEnabled = true;
let notificationsDesktopEnabled = true;
let lastNotifyAt = 0;
const NEW_ORDER_NOTIFY_COOLDOWN_MS = Number(
  process.env.NEW_ORDER_NOTIFY_COOLDOWN_MS || 2000
);

function getSyncBaseUrl() {
  return db.getSyncBaseUrl();
}

function hasSyncBaseUrl() {
  return Boolean(getSyncBaseUrl());
}

function getSyncStatePath() {
  const dataDir = db.getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, SYNC_STATE_FILENAME);
}

function getSyncSettingsPath() {
  const dataDir = db.getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, SYNC_SETTINGS_FILENAME);
}

function getSyncLastPushPath() {
  const dataDir = db.getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, SYNC_LAST_PUSH_FILENAME);
}

function refreshLastPushAtFromDisk() {
  try {
    const raw = fs.readFileSync(getSyncLastPushPath(), "utf8");
    const parsed = JSON.parse(raw);
    const lastPushAt = parsed && parsed.lastPushAt;
    if (!lastPushAt) return;
    const nextTs = Date.parse(lastPushAt);
    const currentTs = Date.parse(syncStatus.lastPushAt || "");
    if (Number.isNaN(nextTs)) return;
    if (Number.isNaN(currentTs) || nextTs > currentTs) {
      syncStatus.lastPushAt = lastPushAt;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[sync] Erro lendo lastPushAt:", err);
    }
  }
}

async function loadSyncSettings() {
  try {
    const raw = await fs.promises.readFile(getSyncSettingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.notificationsEnabled === "boolean") {
      notificationsEnabled = parsed.notificationsEnabled;
    }
    if (parsed && typeof parsed.notificationsSoundEnabled === "boolean") {
      notificationsSoundEnabled = parsed.notificationsSoundEnabled;
    }
    if (parsed && typeof parsed.notificationsDesktopEnabled === "boolean") {
      notificationsDesktopEnabled = parsed.notificationsDesktopEnabled;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[sync] Erro lendo sync-settings:", err);
    }
  }
}

async function saveSyncSettings() {
  try {
    await fs.promises.writeFile(
      getSyncSettingsPath(),
      JSON.stringify(
        {
          notificationsEnabled,
          notificationsSoundEnabled,
          notificationsDesktopEnabled,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (err) {
    console.error("[sync] Erro salvando sync-settings:", err);
  }
}

async function loadSyncState() {
  if (syncStateLoaded) return;
  try {
    const raw = await fs.promises.readFile(getSyncStatePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      syncState = {
        lastSyncByCollection: parsed.lastSyncByCollection || {},
      };
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("[sync] Erro lendo sync-state:", err);
    }
  } finally {
    syncStateLoaded = true;
  }
}

async function saveSyncState() {
  try {
    await fs.promises.writeFile(
      getSyncStatePath(),
      JSON.stringify(syncState, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("[sync] Erro salvando sync-state:", err);
  }
}

function updateSyncOnline() {
  if (!hasSyncBaseUrl()) {
    syncStatus.online = false;
    return;
  }
  if (!syncStatus.lastPullAt) {
    syncStatus.online = false;
    return;
  }
  const last = Date.parse(syncStatus.lastPullAt);
  if (Number.isNaN(last)) {
    syncStatus.online = false;
    return;
  }
  const threshold = SYNC_PULL_INTERVAL_MS * 2;
  syncStatus.online =
    Date.now() - last <= threshold && !syncStatus.lastPullError;
}

function getSyncErrorCode(err) {
  if (!err) return null;
  if (err.code) return String(err.code);
  if (err.cause && err.cause.code) return String(err.cause.code);
  return null;
}

function getSyncErrorType(err) {
  const code = getSyncErrorCode(err);
  if (code === "ENOTFOUND") return "dns";
  if (code === "ECONNREFUSED") return "refused";
  if (code === "ETIMEDOUT") return "timeout";
  if (code === "ECONNRESET") return "reset";
  return null;
}

function resetSyncRetry() {
  syncRetryAttempt = 0;
  if (syncRetryTimer) {
    clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
  }
}

function scheduleSyncRetry() {
  if (syncRetryTimer) return;
  const baseDelay = Number(process.env.SYNC_RETRY_BASE_MS || 5000);
  const maxDelay = Number(process.env.SYNC_RETRY_MAX_MS || 60000);
  const delay = Math.min(
    baseDelay * Math.pow(2, syncRetryAttempt),
    maxDelay
  );
  syncRetryAttempt += 1;
  syncRetryTimer = setTimeout(() => {
    syncRetryTimer = null;
    void runSyncCycle();
  }, delay);
}

function notifyNewWebsiteOrders(count) {
  if (!notificationsEnabled) return;
  if (!count || count < 1) return;
  const now = Date.now();
  if (now - lastNotifyAt < NEW_ORDER_NOTIFY_COOLDOWN_MS) return;
  lastNotifyAt = now;

  try {
    syncEvents.emit("new-orders-notification", count);
    console.log(`[sync] Chegaram ${count} novos pedidos do site.`);
  } catch (err) {
    console.error("[sync] Erro ao notificar:", err);
  }
}

function getSyncHeaders() {
  const headers = { Accept: "application/json" };
  if (process.env.SYNC_TOKEN) {
    headers["x-sync-token"] = process.env.SYNC_TOKEN;
  }
  return headers;
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.SYNC_TIMEOUT_MS || 5000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch (err) {
        bodyText = "";
      }
      const detail = bodyText ? `: ${bodyText}` : "";
      throw new Error(`HTTP ${response.status}${detail}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function collectionHasItems(data) {
  if (!data) return false;
  if (Array.isArray(data.items)) return data.items.length > 0;
  if (Array.isArray(data.products)) return data.products.length > 0;
  if (Array.isArray(data)) return data.length > 0;
  return Object.keys(data).length > 0;
}

function normalizeSyncPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (payload.success === true && payload.data) {
    return payload.data;
  }
  return payload;
}

function normalizeWrapper(data) {
  if (Array.isArray(data)) {
    return { items: data, meta: { deleted: [] } };
  }
  if (data && Array.isArray(data.items)) {
    return {
      items: data.items,
      meta:
        data.meta && typeof data.meta === "object"
          ? data.meta
          : { deleted: [] },
    };
  }
  return null;
}

function isIncomingNewer(incoming, current) {
  const incomingTs = Date.parse(incoming.updatedAt || incoming.createdAt || "");
  const currentTs = Date.parse(current.updatedAt || current.createdAt || "");
  if (Number.isNaN(incomingTs) && Number.isNaN(currentTs)) return false;
  if (Number.isNaN(incomingTs)) return false;
  if (Number.isNaN(currentTs)) return true;
  return incomingTs >= currentTs;
}

function buildDeltaFromWrapper(wrapper) {
  if (!wrapper) return { items: [], meta: { deleted: [] } };
  return {
    items: Array.isArray(wrapper.items) ? wrapper.items : [],
    meta:
      wrapper.meta && typeof wrapper.meta === "object"
        ? wrapper.meta
        : { deleted: [] },
  };
}

async function applyDeltaToLocal(collection, delta) {
  const current = await db.getCollection(collection);
  const wrapper = normalizeWrapper(current) || { items: [], meta: { deleted: [] } };
  const incomingItems = Array.isArray(delta.items) ? delta.items : [];
  const deletedItems = Array.isArray(delta.meta.deleted) ? delta.meta.deleted : [];

  for (const item of incomingItems) {
    const index = wrapper.items.findIndex(
      (it) => String(it.id) === String(item.id)
    );
    if (index >= 0) {
      if (isIncomingNewer(item, wrapper.items[index])) {
        wrapper.items[index] = { ...wrapper.items[index], ...item };
      }
    } else {
      wrapper.items.push(item);
    }
  }

  for (const entry of deletedItems) {
    const index = wrapper.items.findIndex(
      (it) => String(it.id) === String(entry.id)
    );
    if (index >= 0) {
      const current = wrapper.items[index];
      const currentTs = Date.parse(
        current.updatedAt || current.createdAt || ""
      );
      const deletedTs = Date.parse(entry.deletedAt || "");
      if (!Number.isNaN(deletedTs) && !Number.isNaN(currentTs)) {
        if (deletedTs >= currentTs) {
          wrapper.items.splice(index, 1);
        }
      }
    }
  }

  if (!Array.isArray(wrapper.meta.deleted)) {
    wrapper.meta.deleted = [];
  }
  for (const entry of deletedItems) {
    const existing = wrapper.meta.deleted.find(
      (it) => String(it.id) === String(entry.id)
    );
    if (existing) {
      existing.deletedAt = entry.deletedAt || existing.deletedAt;
    } else {
      wrapper.meta.deleted.push(entry);
    }
  }

  await db.setCollection(collection, wrapper, { skipSync: true });
}

async function pushFullCollection(name, data) {
  const baseUrl = getSyncBaseUrl();
  if (!baseUrl) {
    throw new Error("SYNC_BASE_URL not set");
  }
  const url = `${baseUrl}/sync/collection/${encodeURIComponent(name)}`;
  return fetchJsonWithTimeout(url, {
    method: "POST",
    headers: {
      ...getSyncHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode: "full", data }),
  });
}

async function pullCollectionsFromRemote() {
  const baseUrl = getSyncBaseUrl();
  if (!baseUrl) {
    return { success: false, error: "SYNC_BASE_URL not set" };
  }
  if (syncInProgress) {
    return { success: false, error: "sync_in_progress" };
  }
  syncInProgress = true;

  const nowIso = new Date().toISOString();
  let newWebsiteOrders = 0;

  try {
    await loadSyncState();
    const collections = db
      .listCollections()
      .filter((name) => SYNC_ITEM_COLLECTIONS.has(name));

    for (const name of collections) {
      const isItemCollection = SYNC_ITEM_COLLECTIONS.has(name);
      const since = syncState.lastSyncByCollection[name];
      const isInitialSync = !since;
      let url = `${baseUrl}/sync/collection/${encodeURIComponent(name)}`;
      if (since && isItemCollection) {
        url += `?since=${encodeURIComponent(since)}`;
      }

      const payload = await fetchJsonWithTimeout(url, {
        method: "GET",
        headers: getSyncHeaders(),
      });
      const payloadData = normalizeSyncPayload(payload);

      if (payloadData && payloadData.delta === true && isItemCollection) {
        const newOrdersFromSync = [];
        const updatedOrdersFromSync = [];
        if (name === "orders") {
          const local = await db.getCollection(name);
          const wrapper =
            normalizeWrapper(local) || { items: [], meta: { deleted: [] } };
          const localIds = new Set(wrapper.items.map((item) => String(item.id)));
          for (const item of payloadData.items || []) {
            const itemId = String(item.id);
            if (!localIds.has(itemId)) {
              if (item.source === "website") {
                newWebsiteOrders += 1;
              }
              newOrdersFromSync.push(item);
            } else {
              updatedOrdersFromSync.push(item);
            }
          }
        }
        await applyDeltaToLocal(name, payloadData);
        if (name === "orders") {
          if (newOrdersFromSync.length > 0) {
            newOrdersFromSync.forEach((order) =>
              syncEvents.emit("new-order", order)
            );
          }
          if (updatedOrdersFromSync.length > 0) {
            updatedOrdersFromSync.forEach((order) =>
              syncEvents.emit("updated-order", order)
            );
          }
        }
      } else if (isItemCollection) {
        const local = await db.getCollection(name);
        const localWrapper = normalizeWrapper(local);
        const remoteWrapper = normalizeWrapper(payloadData);
        const localHasData = collectionHasItems(localWrapper || local);
        const remoteHasData = collectionHasItems(remoteWrapper || payloadData);

        if (remoteWrapper && localWrapper) {
          if (remoteHasData) {
            if (localHasData) {
              await applyDeltaToLocal(name, buildDeltaFromWrapper(remoteWrapper));
              if (isInitialSync) {
                const merged = await db.getCollection(name);
                await pushFullCollection(name, merged);
              }
            } else {
              await db.setCollection(name, remoteWrapper, { skipSync: true });
            }
          } else if (localHasData && BOOTSTRAP_COLLECTIONS.has(name)) {
            await pushFullCollection(name, localWrapper);
          }
        } else if (!remoteHasData && localHasData && BOOTSTRAP_COLLECTIONS.has(name)) {
          await pushFullCollection(name, local);
        } else {
          await db.setCollection(name, payloadData, { skipSync: true });
        }
      } else {
        await db.setCollection(name, payloadData, { skipSync: true });
      }

      syncState.lastSyncByCollection[name] = nowIso;
    }

    syncStatus.lastPullAt = nowIso;
    syncStatus.lastPullError = null;
    syncStatus.lastPullErrorCode = null;
    syncStatus.lastPullErrorType = null;
    resetSyncRetry();
    if (newWebsiteOrders > 0) {
      syncStatus.lastNewOrdersAt = nowIso;
      syncStatus.lastNewOrdersCount = newWebsiteOrders;
      notifyNewWebsiteOrders(newWebsiteOrders);
    }
    await saveSyncState();
  } catch (err) {
    syncStatus.lastPullError = String(err.message || err);
    syncStatus.lastPullErrorCode = getSyncErrorCode(err);
    syncStatus.lastPullErrorType = getSyncErrorType(err);
    console.error("[sync] Erro ao puxar colecoes:", err);
    if (syncStatus.lastPullErrorType === "dns") {
      scheduleSyncRetry();
    }
  } finally {
    syncInProgress = false;
    updateSyncOnline();
  }

  return {
    success: !syncStatus.lastPullError,
    error: syncStatus.lastPullError,
  };
}

async function runSyncCycle() {
  const flushResult = await db.flushSyncQueue();
  const pullResult = await pullCollectionsFromRemote();

  if (flushResult && flushResult.flushed > 0) {
    syncStatus.lastPushAt = new Date().toISOString();
  }
  if (flushResult && flushResult.success === false) {
    syncStatus.lastPushError = flushResult.error || "queue_flush_failed";
  } else if (flushResult && flushResult.remaining === 0) {
    syncStatus.lastPushError = null;
  }

  if (flushResult && typeof flushResult.remaining === "number") {
    syncStatus.queueRemaining = flushResult.remaining;
  }

  updateSyncOnline();
  return { pullResult, flushResult, status: syncStatus };
}

function startSyncPull() {
  if (!hasSyncBaseUrl()) return;
  void runSyncCycle();
  syncTimer = setInterval(() => {
    void runSyncCycle();
  }, SYNC_PULL_INTERVAL_MS);
}

function stopSyncPull() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

function getSyncStatus() {
  refreshLastPushAtFromDisk();
  return syncStatus;
}

function getNotificationStatus() {
  return notificationsEnabled;
}

function setNotificationStatus(value) {
  notificationsEnabled = Boolean(value);
  void saveSyncSettings();
  return notificationsEnabled;
}

function getNotificationSettings() {
  return {
    enabled: notificationsEnabled,
    audioEnabled: notificationsSoundEnabled,
    desktopEnabled: notificationsDesktopEnabled,
  };
}

function setNotificationSettings(values = {}) {
  if (typeof values.enabled === "boolean") {
    notificationsEnabled = values.enabled;
  }
  if (typeof values.audioEnabled === "boolean") {
    notificationsSoundEnabled = values.audioEnabled;
  }
  if (typeof values.desktopEnabled === "boolean") {
    notificationsDesktopEnabled = values.desktopEnabled;
  }
  void saveSyncSettings();
  return getNotificationSettings();
}

module.exports = {
  syncEvents,
  startSyncPull,
  runSyncCycle,
  getSyncStatus,
  loadSyncSettings,
  saveSyncSettings,
  stopSyncPull,
  hasSyncBaseUrl,
  getNotificationStatus,
  setNotificationStatus,
  getNotificationSettings,
  setNotificationSettings
};
