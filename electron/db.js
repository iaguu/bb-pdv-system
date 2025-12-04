
// electron/db.js
// DataEngine unificado para o app da pizzaria.
// Lê e escreve coleções em arquivos JSON no diretório de dados.
//
// Suporta uso tanto dentro do Electron (app.getPath('userData'))
// quanto em um servidor Node externo (via variável de ambiente DATA_DIR).

const fs = require('fs');
const path = require('path');

let electronApp = null;
try {
  // Quando rodando dentro do Electron
  const { app } = require('electron');
  electronApp = app;
} catch (err) {
  // Quando rodando em Node "puro" (ex: apiServer)
  electronApp = null;
}

const COLLECTION_FILES = {
  products: 'products.json',
  customers: 'customers.json',
  orders: 'orders.json',
  motoboys: 'motoboys.json',
  cashSessions: 'cashSessions.json',
  settings: 'settings.json',
  dashboard: 'dashboard.json'
};

function getDataDir() {
  // 1) Se definido externamente (ex: apiServer), prioriza isso
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    return path.resolve(process.env.DATA_DIR.trim());
  }

  // 2) Se estiver no Electron e o app já existir
  if (electronApp && typeof electronApp.getPath === 'function') {
    return path.join(electronApp.getPath('userData'), 'data');
  }

  // 3) Fallback: diretório "data" na pasta atual do processo (Node puro)
  return path.join(process.cwd(), 'data');
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
      return { items: [] };
    case 'settings':
      return {
        items: [
          {
            id: 'default',
            pizzariaName: 'Anne & Tom'
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
    const content = await fs.promises.readFile(filePath, 'utf8');
    if (!content.trim()) return fallback;
    return JSON.parse(content);
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
  if (Array.isArray(data)) {
    return { items: data };
  }
  if (data && Array.isArray(data.items)) {
    return data;
  }
  return { items: [] };
}

// --------- API PRINCIPAL DO DATAENGINE ---------

// 1) Ler coleção completa
async function getCollection(collection) {
  const filePath = getCollectionPath(collection);
  const defaultData = getDefaultData(collection);
  return readRawFile(filePath, defaultData);
}

// 2) Salvar coleção inteira (sobrescreve)
async function setCollection(collection, data) {
  const filePath = getCollectionPath(collection);
  await writeRawFile(filePath, data);
  return data;
}

// 3) Adicionar item (mantém convenção { items: [] })
async function addItem(collection, item) {
  const filePath = getCollectionPath(collection);
  const current = await getCollection(collection);
  const wrapper = ensureItemsWrapper(current);

  // Se não vier id, gera um simples
  if (!item.id) {
    item.id = `${collection}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  wrapper.items.push(item);
  console.log("[DB] Salvando na coleção:", collection);
  console.log("[DB] Caminho:", filePath);
  console.log("[DB] Conteúdo antes:", wrapper);
  console.log("[DB] Item novo:", item);

  await writeRawFile(filePath, wrapper);

  console.log("[DB] Arquivo salvo com sucesso.");

  return item;
}

// 4) Atualizar item por id
async function updateItem(collection, id, changes) {
  const filePath = getCollectionPath(collection);
  const current = await getCollection(collection);
  const wrapper = ensureItemsWrapper(current);

  const index = wrapper.items.findIndex((it) => String(it.id) === String(id));
  if (index === -1) {
    throw new Error(`Item with id ${id} not found in ${collection}`);
  }

  wrapper.items[index] = {
    ...wrapper.items[index],
    ...changes
  };

  await writeRawFile(filePath, wrapper);
  return wrapper.items[index];
}

// 5) Remover item por id
async function removeItem(collection, id) {
  const filePath = getCollectionPath(collection);
  const current = await getCollection(collection);
  const wrapper = ensureItemsWrapper(current);

  const index = wrapper.items.findIndex((it) => String(it.id) === String(id));
  if (index === -1) {
    return false;
  }

  const [removed] = wrapper.items.splice(index, 1);
  await writeRawFile(filePath, wrapper);
  return removed;
}

// 6) Resetar coleção para default
async function resetCollection(collection) {
  const filePath = getCollectionPath(collection);
  const defaultData = getDefaultData(collection);
  await writeRawFile(filePath, defaultData);
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
  listCollections
};
