
// electron/db.js
// DataEngine unificado para o app da pizzaria.
// Lê e escreve coleções em arquivos JSON no diretório de dados.
//
// Suporta uso tanto dentro do Electron (app.getPath('userData'))
// quanto em um servidor Node externo (via variável de ambiente DATA_DIR).

const fs = require('fs');
const path = require('path');
const os = require('os');
const fetchFn = global.fetch
  ? global.fetch
  : (...args) =>
      import('node-fetch').then(({ default: fetch }) => fetch(...args));

let electronApp = null;
try {
  // Quando rodando dentro do Electron
  const { app } = require('electron');
  electronApp = app;
} catch (err) {
  // Quando rodando em Node "puro" (ex: apiServer)
  electronApp = null;
}
const isElectron = Boolean(process.versions && process.versions.electron);

const COLLECTION_FILES = {
  products: 'products.json',
  customers: 'customers.json',
  orders: 'orders.json',
  motoboys: 'motoboys.json',
  cashSessions: 'cashSessions.json',
  stock_ingredients: 'stock_ingredients.json',
  settings: 'settings.json',
  dashboard: 'dashboard.json'
};
const SYNC_COLLECTIONS = new Set([
  'products',
  'customers',
  'orders',
  'motoboys',
  'cashSessions',
  'settings'
]);

const APPDATA_SCOPE = process.env.APPDATA_SCOPE || 'BB-PEDIDOS';
const PACKAGED_DATA_DIR = path.join(__dirname, 'data');

function resolveStoredDataDir() {
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    return path.resolve(process.env.DATA_DIR.trim());
  }

  const appData =
    (electronApp &&
      typeof electronApp.getPath === 'function' &&
      electronApp.getPath('appData')) ||
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), 'AppData', 'Roaming'));

  return path.join(appData, APPDATA_SCOPE, 'data');
}

function bootstrapDataAssets(dir) {
  if (!fs.existsSync(PACKAGED_DATA_DIR)) {
    return;
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  for (const fileName of Object.values(COLLECTION_FILES)) {
    const sourceFile = path.join(PACKAGED_DATA_DIR, fileName);
    const targetFile = path.join(dir, fileName);
    if (!fs.existsSync(sourceFile)) continue;
    if (fs.existsSync(targetFile)) continue;
    fs.copyFileSync(sourceFile, targetFile);
  }
}

function getDataDir() {
  const resolved = resolveStoredDataDir();
  bootstrapDataAssets(resolved);
  return resolved;
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getCollectionPath(collection) {
  const fileName = COLLECTION_FILES[collection];
  if (!fileName) {
    throw new Error(`Collection not mapped in COLLECTION_FILES: ${collection}`);
  }
  const dataDir = getDataDir();
  ensureDirExists(dataDir);
  return path.join(dataDir, fileName);
}

// Defaults bem simples para cada coleção
function getDefaultData(collection) {
  switch (collection) {
    case 'products':
    case 'customers':
    case 'orders':
    case 'motoboys':
    case 'cashSessions':
    case 'stock_ingredients':
      return { items: [] };
    case 'settings':
      return {
        items: [
          {
            id: 'default',
            pizzariaName: 'AXION PDV'
          }
        ]
      };
    case 'dashboard':
      return {
        stats: {
          lastUpdate: null,
          today: null,
          topProducts: []
        }
      };
    default:
      return {};
  }
}

// --------- Helpers de I/O brutos ---------

async function readRawFile(filePath, fallback) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const content = raw.replace(/\u0000/g, '').replace(/^\uFEFF/, '');
    if (!content.trim()) return fallback;
    try {
      return JSON.parse(content);
    } catch (parseErr) {
      const corruptedPath = `${filePath}.corrupted-${Date.now()}`;
      console.error(`[DataEngine] Invalid JSON at ${filePath}:`, parseErr);
      try {
        await fs.promises.rename(filePath, corruptedPath);
      } catch (renameErr) {
        console.error(
          `[DataEngine] Failed to backup corrupted file ${filePath}:`,
          renameErr
        );
      }
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(fallback, null, 2),
        'utf8'
      );
      return fallback;
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Se não existe, cria com o default
      await fs.promises.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    }
    console.error(`[DataEngine] Error reading file ${filePath}:`, err);
    throw err;
  }
}

async function writeRawFile(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  try {
    await fs.promises.writeFile(filePath, json, 'utf8');
  } catch (err) {
    console.error(`[DataEngine] Error writing file ${filePath}:`, err);
    throw err;
  }
}

// Garante formato { items: [...] }
function ensureItemsWrapper(data) {
  const meta =
    data && typeof data === 'object' && data.meta && typeof data.meta === 'object'
      ? data.meta
      : { deleted: [] };
  if (Array.isArray(data)) {
    return { items: data, meta };
  }
  if (data && Array.isArray(data.items)) {
    return { ...data, meta };
  }
  return { items: [], meta };
}

function getSyncBaseUrl() {
  const base = process.env.SYNC_BASE_URL || "https://api.annetom.com";
  return base.replace(/\/+$/, "");
}

function shouldSync(options) {
  if (options && options.skipSync) return false;
  if (!isElectron) return false;
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
  const dataDir = getDataDir();
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
    console.error('[sync] Erro lendo fila:', err);
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
    console.error('[sync] Erro salvando fila:', err);
  }
}

async function enqueueSyncPayload(collection, payload) {
  if (!isElectron) return;
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
      console.error('[sync] Falha ao enviar colecao:', collection, response.status);
      if (shouldEnqueue) {
        await enqueueSyncPayload(collection, payload);
      }
      return false;
    }
    return true;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[sync] Timeout enviando colecao:', collection);
    } else {
      console.error('[sync] Erro enviando colecao:', collection, err);
    }
    if (shouldEnqueue) {
      await enqueueSyncPayload(collection, payload);
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function flushSyncQueue() {
  if (!shouldSync()) {
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

// --------- API PRINCIPAL DO DATAENGINE ---------

// 1) Ler coleção completa
async function getCollection(collection) {
  const filePath = getCollectionPath(collection);
  const defaultData = getDefaultData(collection);
  return readRawFile(filePath, defaultData);
}

// 2) Salvar coleção inteira (sobrescreve)
async function setCollection(collection, data, options = null) {
  const filePath = getCollectionPath(collection);
  await writeRawFile(filePath, data);
  if (shouldSync(options)) {
    void pushCollectionToRemote(collection, buildFullPayload(data));
  }
  return data;
}

// 3) Adicionar item (mantém convenção { items: [] })
async function addItem(collection, item, options = null) {
  const filePath = getCollectionPath(collection);
  const current = await getCollection(collection);
  const wrapper = ensureItemsWrapper(current);
  const now = getNowIso();

  // Se nao vier id, gera um simples
  if (!item.id) {
    item.id = `${collection}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  if (!item.createdAt) {
    item.createdAt = now;
  }
  item.updatedAt = now;

  if (!wrapper.meta || typeof wrapper.meta !== 'object') {
    wrapper.meta = { deleted: [] };
  }
  if (Array.isArray(wrapper.meta.deleted)) {
    wrapper.meta.deleted = wrapper.meta.deleted.filter(
      (entry) => String(entry.id) !== String(item.id)
    );
  }

  wrapper.items.push(item);
  console.log("[DB] Salvando na colecao:", collection);
  console.log("[DB] Caminho:", filePath);
  console.log("[DB] Conteudo antes:", wrapper);
  console.log("[DB] Item novo:", item);

  await writeRawFile(filePath, wrapper);

  console.log("[DB] Arquivo salvo com sucesso.");

  if (shouldSync(options)) {
    void pushCollectionToRemote(collection, buildDeltaPayload([item], []));
  }

  return item;
}

// 4) Atualizar item por id
async function updateItem(collection, id, changes, options = null) {
  const filePath = getCollectionPath(collection);
  const current = await getCollection(collection);
  const wrapper = ensureItemsWrapper(current);
  const now = getNowIso();

  const index = wrapper.items.findIndex((it) => String(it.id) === String(id));
  if (index === -1) {
    throw new Error(`Item with id ${id} not found in ${collection}`);
  }

  wrapper.items[index] = {
    ...wrapper.items[index],
    ...changes,
    updatedAt: changes.updatedAt || now
  };

  await writeRawFile(filePath, wrapper);
  if (shouldSync(options)) {
    void pushCollectionToRemote(
      collection,
      buildDeltaPayload([wrapper.items[index]], [])
    );
  }
  return wrapper.items[index];
}

// 5) Remover item por id
async function removeItem(collection, id, options = null) {
  const filePath = getCollectionPath(collection);
  const current = await getCollection(collection);
  const wrapper = ensureItemsWrapper(current);
  const now = getNowIso();

  const index = wrapper.items.findIndex((it) => String(it.id) === String(id));
  if (index === -1) {
    return false;
  }

  const [removed] = wrapper.items.splice(index, 1);
  if (!wrapper.meta || typeof wrapper.meta !== 'object') {
    wrapper.meta = { deleted: [] };
  }
  if (!Array.isArray(wrapper.meta.deleted)) {
    wrapper.meta.deleted = [];
  }
  const existing = wrapper.meta.deleted.find(
    (entry) => String(entry.id) === String(id)
  );
  const deletedEntry = existing || { id, deletedAt: now };
  deletedEntry.deletedAt = now;
  if (!existing) {
    wrapper.meta.deleted.push(deletedEntry);
  }

  await writeRawFile(filePath, wrapper);
  if (shouldSync(options)) {
    void pushCollectionToRemote(
      collection,
      buildDeltaPayload([], [deletedEntry])
    );
  }
  return removed;
}

// 6) Resetar coleção para default
async function resetCollection(collection, options = null) {
  const filePath = getCollectionPath(collection);
  const defaultData = getDefaultData(collection);
  await writeRawFile(filePath, defaultData);
  if (shouldSync(options)) {
    void pushCollectionToRemote(collection, buildFullPayload(defaultData));
  }
  return defaultData;
}

// 7) Listar coleções disponíveis (helper)
function listCollections() {
  return Object.keys(COLLECTION_FILES);
}

module.exports = {
  COLLECTION_FILES,
  getDataDir,
  getCollection,
  setCollection,
  addItem,
  updateItem,
  removeItem,
  resetCollection,
  listCollections,
  flushSyncQueue
};







