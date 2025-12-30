// electron/utils/dbSync.js
// Lógica de sincronização para o DataEngine, extraída de db.js.
// Gerencia a fila de payloads para enviar ao servidor remoto.

const fs = require('fs');
const path = require('path');
const { logError } = require('./logger'); // Assumindo que o logger já está disponível
const fetchFn = global.fetch
  ? global.fetch
  : (...args) =>
      import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Collections que devem ser sincronizadas
const SYNC_COLLECTIONS = new Set([
  'products',
  'customers',
  'orders',
  'motoboys',
  'cashSessions',
  'settings'
]);

// Helper para obter o diretório de dados (usado para sync-queue.json)
let getDataDirRef = null;
function setDataDirResolver(resolverFn) {
  getDataDirRef = resolverFn;
}
function getResolvedDataDir() {
  if (getDataDirRef) {
    return getDataDirRef();
  }
  logError('dbSync', 'getDataDir resolver não configurado para dbSync.');
  throw new Error('getDataDir resolver não configurado para dbSync.');
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getSyncBaseUrl() {
  const base = process.env.SYNC_BASE_URL || "https://api.annetom.com";
  return base.replace(/\/+$/, "");
}

function shouldSync(isElectronApp, options) {
  if (options && options.skipSync) return false;
  if (!isElectronApp) return false;
  return Boolean(getSyncBaseUrl());
}

function getNowIso() {
  return new Date().toISOString();
}

function buildDeltaPayload(items = [], deleted = []) {
  return {
    mode: 'delta',
    items,
    meta: { deleted }
  };
}

function buildFullPayload(data) {
  return {
    mode: 'full',
    data
  };
}

function getSyncQueuePath() {
  const dataDir = getResolvedDataDir();
  ensureDirExists(dataDir);
  return path.join(dataDir, 'sync-queue.json');
}

async function readSyncQueue() {
  try {
    const raw = await fs.promises.readFile(getSyncQueuePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    logError('dbSync', 'Erro lendo fila de sincronização:', err);
    return [];
  }
}

async function writeSyncQueue(queue) {
  try {
    await fs.promises.writeFile(
      getSyncQueuePath(),
      JSON.stringify(queue, null, 2),
      'utf8'
    );
  } catch (err) {
    logError('dbSync', 'Erro salvando fila de sincronização:', err);
  }
}

async function enqueueSyncPayload(collection, payload) {
  // isElectronApp está agora na shouldSync, então não precisamos dele aqui diretamente
  const queue = await readSyncQueue();
  const maxQueue = Number(process.env.SYNC_QUEUE_MAX || 200);
  queue.push({
    collection,
    payload,
    createdAt: getNowIso()
  });
  if (queue.length > maxQueue) {
    queue.splice(0, queue.length - maxQueue);
  }
  await writeSyncQueue(queue);
}

async function pushCollectionToRemote(collection, payload, options = null) {
  if (!SYNC_COLLECTIONS.has(collection)) return true;
  const baseUrl = getSyncBaseUrl();
  if (!baseUrl) return false;

  const url = `${baseUrl}/sync/collection/${encodeURIComponent(collection)}`;
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.SYNC_TOKEN) {
    headers['x-sync-token'] = process.env.SYNC_TOKEN;
  }
  const shouldEnqueue = !(options && options.skipEnqueue);

  const controller = new AbortController();
  const timeoutMs = Number(process.env.SYNC_TIMEOUT_MS || 5000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      logError('dbSync', 'Falha ao enviar coleção para o remoto:', new Error(`HTTP ${response.status}`), {collection, status: response.status});
      if (shouldEnqueue) {
        await enqueueSyncPayload(collection, payload);
      }
      return false;
    }
    return true;
  } catch (err) {
    if (err.name === 'AbortError') {
      logError('dbSync', 'Timeout enviando coleção:', err, {collection});
    } else {
      logError('dbSync', 'Erro enviando coleção:', err, {collection});
    }
    if (shouldEnqueue) {
      await enqueueSyncPayload(collection, payload);
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function flushSyncQueue(isElectronApp) {
  if (!shouldSync(isElectronApp)) {
    return { success: false, flushed: 0, remaining: 0 };
  }

  const queue = (await readSyncQueue()).filter((entry) =>
    SYNC_COLLECTIONS.has(entry.collection)
  );
  await writeSyncQueue(queue);
  if (queue.length === 0) {
    return { success: true, flushed: 0, remaining: 0 };
  }

  let flushed = 0;
  while (queue.length > 0) {
    const entry = queue[0];
    const ok = await pushCollectionToRemote(entry.collection, entry.payload, {
      skipEnqueue: true,
    });
    if (!ok) break;
    queue.shift();
    flushed += 1;
  }

  await writeSyncQueue(queue);
  return { success: true, flushed, remaining: queue.length };
}

module.exports = {
  SYNC_COLLECTIONS,
  shouldSync,
  getNowIso,
  buildDeltaPayload,
  buildFullPayload,
  flushSyncQueue,
  pushCollectionToRemote,
  setDataDirResolver,
};
