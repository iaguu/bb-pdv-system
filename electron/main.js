 // electron/main.js
const { app, BrowserWindow, ipcMain, shell, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const QRCode = require("qrcode"); // QR Code para tickets HTML
const isDev = !app.isPackaged;
app.commandLine.appendSwitch(
  "disable-features",
  "Autofill,AutofillAssistant,AutofillServerCommunication"
);
app.commandLine.appendSwitch("disable-blink-features", "Autofill");
const packagedEnvPath = path.join(process.resourcesPath || "", ".env");
const devEnvPath = path.join(__dirname, "..", ".env");
const devEnvOverridePath = path.join(__dirname, "..", ".env.development");
const prodEnvOverridePath = path.join(__dirname, "..", ".env.production");
const envFile = process.env.ENV_FILE || "";
const envCandidates = [];
if (envFile) {
  if (path.isAbsolute(envFile)) {
    envCandidates.push(envFile);
  } else {
    envCandidates.push(path.join(process.resourcesPath || "", envFile));
    envCandidates.push(path.join(__dirname, "..", envFile));
  }
} else if (isDev) {
  envCandidates.push(devEnvOverridePath);
} else {
  envCandidates.push(prodEnvOverridePath);
}
envCandidates.push(packagedEnvPath, devEnvPath);
const resolvedEnvPath = envCandidates.find((candidate) =>
  candidate && fs.existsSync(candidate)
);
if (resolvedEnvPath) dotenv.config({ path: resolvedEnvPath, override: true });
else dotenv.config();
// Modulo de acesso ao "banco" em JSON
const db = require("./db"); // ajuste o path se necessario
const apiServer = require("./apiServer");
const sync = require("./sync");
const { orderEvents, getTrackingBaseUrl } = apiServer;
// Helper fetch no processo main (Node/Electron)
// Usa fetch nativo se existir; caso contrário, faz import dinâmico do node-fetch.
const fetchFn = global.fetch
  ? global.fetch
  : (...args) =>
      import("node-fetch").then(({ default: fetch }) => fetch(...args));
const trimTrailingSlash = (value) =>
  typeof value === "string" ? value.replace(/\/+$/, "") : "";
const trimApiSuffix = (value) => {
  const trimmed = trimTrailingSlash(value);
  return trimmed ? trimmed.replace(/\/api$/i, "") : "";
};
const envPublicApiBase =
  trimApiSuffix(process.env.PUBLIC_API_BASE_URL) ||
  trimApiSuffix(process.env.PDV_API_BASE_URL);
const syncBaseClean = trimApiSuffix(process.env.SYNC_BASE_URL);
const DEFAULT_PUBLIC_API_BASE_URL =
  envPublicApiBase ||
  syncBaseClean ||
  "https://pdv.axionenterprise.cloud/annetom";
const UPDATE_CHECK_URL = process.env.UPDATE_CHECK_URL || "";
const UPDATE_CHECK_TIMEOUT_MS = Number(process.env.UPDATE_CHECK_TIMEOUT_MS || 6000);

let mainWindow;
let mainWindowReady = false;
const pendingNewOrders = [];
const pendingNewOrderIds = new Set();
const pendingUpdatedOrders = [];
const pendingUpdatedOrderIds = new Set();

// -------------------------------------
// Criação da janela principal
// -------------------------------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#f5f7fb",
    title: "AXION PDV",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindowReady = true;
    flushPendingNewOrders();
    flushPendingUpdatedOrders();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    mainWindowReady = false;
  });

  // Abre links externos no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function getOrderEventId(order) {
  if (!order) return null;
  return (
    order.id ||
    order._id ||
    order.orderId ||
    order.code ||
    order.numeroPedido ||
    null
  );
}

function flushPendingNewOrders() {
  if (!mainWindow.webContents || !mainWindowReady) {
    return;
  }

  while (pendingNewOrders.length > 0) {
    const nextOrder = pendingNewOrders.shift();
    if (!nextOrder) continue;
    const nextOrderId = getOrderEventId(nextOrder);
    if (nextOrderId) pendingNewOrderIds.delete(nextOrderId);
    mainWindow.webContents.send("orders:new", nextOrder);
  }
}

function flushPendingUpdatedOrders() {
  if (!mainWindow.webContents || !mainWindowReady) {
    return;
  }

  while (pendingUpdatedOrders.length > 0) {
    const nextOrder = pendingUpdatedOrders.shift();
    if (!nextOrder) continue;
    const nextOrderId = getOrderEventId(nextOrder);
    if (nextOrderId) pendingUpdatedOrderIds.delete(nextOrderId);
    mainWindow.webContents.send("orders:updated", nextOrder);
  }
}

function dispatchOrderToRenderer(order) {
  if (!order) {
    return;
  }

  const orderId = getOrderEventId(order);
  if (orderId && pendingNewOrderIds.has(orderId)) {
    return;
  }

  if (mainWindow && mainWindowReady && mainWindow.webContents) {
    mainWindow.webContents.send("orders:new", order);
    return;
  }

  if (orderId) pendingNewOrderIds.add(orderId);
  pendingNewOrders.push(order);
}

function dispatchOrderUpdatedToRenderer(order) {
  if (!order) {
    return;
  }

  const orderId = getOrderEventId(order);
  if (orderId && pendingUpdatedOrderIds.has(orderId)) {
    return;
  }

  if (mainWindow && mainWindowReady && mainWindow.webContents) {
    mainWindow.webContents.send("orders:updated", order);
    return;
  }

  if (orderId) pendingUpdatedOrderIds.add(orderId);
  pendingUpdatedOrders.push(order);
}

if (orderEvents && typeof orderEvents.on === "function") {
  orderEvents.on("created", (order) => {
    const orderId = getOrderEventId(order) || "desconhecido";
    console.log(`[apiServer] Novo pedido recebido: ${orderId}`);
    dispatchOrderToRenderer(order);
  });
  orderEvents.on("updated", (order) => {
    const orderId = getOrderEventId(order) || "desconhecido";
    console.log(`[apiServer] Pedido atualizado: ${orderId}`);
    dispatchOrderUpdatedToRenderer(order);
  });
}

// Handlers para pedidos do Sync
sync.syncEvents.on("new-order", (order) => {
  const orderId = getOrderEventId(order) || "desconhecido";
  console.log(`[sync] Novo pedido recebido: ${orderId}`);
  dispatchOrderToRenderer(order);
});

sync.syncEvents.on("updated-order", (order) => {
  const orderId = getOrderEventId(order) || "desconhecido";
  console.log(`[sync] Pedido atualizado: ${orderId}`);
  dispatchOrderUpdatedToRenderer(order);
});

sync.syncEvents.on("new-orders-notification", (count) => {
  try {
    const notificationSettings =
      typeof sync.getNotificationSettings === "function"
        ? sync.getNotificationSettings()
        : { enabled: true, audioEnabled: true, desktopEnabled: true };
    if (notificationSettings.audioEnabled && typeof app.beep === "function") {
      app.beep();
    }
    if (
      notificationSettings.desktopEnabled &&
      Notification &&
      typeof Notification.isSupported === "function" &&
      Notification.isSupported()
    ) {
      const iconPath = path.join(app.getAppPath(), "AXIONPDV.png");
      const title = "Novo pedido";
      const body =
        count === 1
          ? "Um novo pedido chegou."
          : `${count} novos pedidos chegaram.`;
      const winNotification = new Notification({
        title,
        body,
        icon: iconPath,
      });
      winNotification.show();
    }
    console.log(`[sync] Notificacao de ${count} novos pedidos.`);
  } catch (err) {
    console.error("[sync] Erro ao notificar:", err);
  }
});

// -------------------------------------
// Helpers genéricos
// -------------------------------------
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrencyBR(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}




/**
 * Normaliza um trackingUrl para o pedido:
 * - Se já existir (order.trackingUrl / delivery.trackingUrl), usa direto.
 * - Senão, monta a partir da base retornada por getTrackingBaseUrl() + id ou código do pedido.
 */
function getTrackingUrlFromOrder(order) {
  if (!order) return "";

  const direct =
    order.trackingUrl ||
    order.delivery.trackingUrl ||
    order.delivery.tracking_url;

  if (direct) return String(direct);

  const code =
    order.trackingCode ||
    order.delivery.trackingCode ||
    order.delivery.tracking_code ||
    order.id ||
    order.code ||
    order.numeroPedido;

  if (!code) return "";

  return `${getTrackingBaseUrl()}${encodeURIComponent(String(code))}`;
}

// Gera um dataURL de QR Code para usar nos tickets HTML (balcão)
async function generateQrDataUrl(value) {
  if (!value) return null;
  try {
    const url = await QRCode.toDataURL(value, {
      margin: 0,
      scale: 3,
    });
    return url; // "data:image/png;base64,...."
  } catch (err) {
    console.error("Erro ao gerar QRCode:", err);
    return null;
  }
}


// -------------------------------------
// Entrega: cálculo de distância via Google Distance Matrix
// -------------------------------------

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Usa a Google Distance Matrix API para obter a distância (em km)
 * entre origin e destination.
 */
async function getDistanceKmFromGoogle(origin, destination) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[distance] GOOGLE_MAPS_API_KEY não definida");
    throw new Error("GOOGLE_MAPS_API_KEY não definida (.env).");
  }

  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    mode: "driving",
    language: "pt-BR",
    region: "br",
    key: GOOGLE_MAPS_API_KEY,
  });

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json${params.toString()}`;

  console.log("[distance] Chamando Distance Matrix:", url);

  const response = await fetchFn(url);

  console.log("[distance] HTTP status:", response.status);

  if (!response.ok) {
    throw new Error(`Erro HTTP Distance Matrix: ${response.status}`);
  }

  const data = await response.json();
  console.log("[distance] JSON:", JSON.stringify(data, null, 2));

  const element = data.rows[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    console.error("[distance] Element status:", element.status, "element:", element);
    throw new Error(
      `Distance Matrix retornou status inválido: ${element.status || "sem dados"}`
    );
  }

  const meters = element.distance.value;
  const km = meters / 1000;
  const durationSeconds = element.duration.value;
  const durationMinutes =
    typeof durationSeconds === "number"
      ? Math.round(durationSeconds / 60)
      : null;
  const durationText = element.duration.text || null;
  console.log("[distance] Distância calculada (km):", km);
  return {
    distanceKm: km,
    durationMinutes,
    durationText,
  };
}

// -------------------------------------
// IPC: DataEngine
// -------------------------------------
ipcMain.handle("data:get", async (_event, collection) => {
  return db.getCollection(collection);
});

// -------------------------------------
// IPC: cálculo de distância para entrega
// Frontend pode chamar via:
//   window.deliveryApi.calculateDistanceKm(origin, destination)
//   ou ipcRenderer.invoke("delivery:calculateDistanceKm", { origin, destination })
// -------------------------------------
ipcMain.handle("delivery:calculateDistanceKm", async (_event, { origin, destination }) => {
  try {
    if (!origin || !destination) {
      throw new Error("Origin ou destination vazios.");
    }

    const distancePayload = await getDistanceKmFromGoogle(origin, destination);
    return distancePayload;
  } catch (err) {
    console.error("[main] delivery:calculateDistanceKm error:", err);
    return null;
  }
});

ipcMain.handle("data:set", async (_event, collection, data) => {
  await db.setCollection(collection, data);
  return true;
});

ipcMain.handle("data:addItem", async (_event, collection, item) => {
  return db.addItem(collection, item);
});

ipcMain.handle(
  "data:updateItem",
  async (_event, collection, id, changes) => {
    return db.updateItem(collection, id, changes);
  }
);

ipcMain.handle("data:removeItem", async (_event, collection, id) => {
  await db.removeItem(collection, id);
  return true;
});

ipcMain.handle("data:reset", async (_event, collection) => {
  await db.resetCollection(collection);
  return true;
});

ipcMain.handle("data:listCollections", async () => {
  return db.listCollections();
});

ipcMain.handle("data:getDataDir", async () => {
  return db.getDataDir();
});

// -------------------------------------
// IPC: Info do app
// -------------------------------------
ipcMain.handle("app:getInfo", async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    env: isDev ? "development" : "production",
    dataDir: db.getDataDir(),
  };
});

ipcMain.handle("app:getPublicApiConfig", async () => {
  return {
    apiBaseUrl: DEFAULT_PUBLIC_API_BASE_URL,
    publicApiToken: process.env.PUBLIC_API_TOKEN || "",
  };
});

async function queryUpdateInfo() {
  if (!UPDATE_CHECK_URL) {
    return {
      success: false,
      error: "UPDATE_CHECK_URL não está configurado.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);

  try {
    const response = await fetchFn(UPDATE_CHECK_URL, {
      headers: {
        Accept: "application/json",
        "x-app-version": app.getVersion(),
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        success: false,
        error: payload.error || `Resposta HTTP ${response.status}`,
        status: response.status,
      };
    }
    return {
      success: true,
      currentVersion: app.getVersion(),
      latestVersion:
        payload.version ||
        payload.latestVersion ||
        payload.tag_name ||
        "",
      releaseNotes:
        payload.notes ||
        payload.releaseNotes ||
        payload.changelog ||
        payload.body ||
        "",
      downloadUrl:
        payload.downloadUrl || payload.url || payload.html_url || "",
      raw: payload,
    };
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return {
      success: false,
      error: isTimeout
        ? "Verificação de atualizações expirou."
        : err.message || "Erro ao verificar atualizações.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle("app:checkUpdates", async () => {
  return queryUpdateInfo();
});

// -------------------------------------
// Helpers de impressora / settings
// -------------------------------------
async function getPrinterSettingsSafe() {
  try {
    const raw = await db.getCollection("settings");

    let root;
    if (Array.isArray(raw.items) && raw.items.length > 0) {
      root = raw.items[0];
    } else if (Array.isArray(raw) && raw.length > 0) {
      root = raw[0];
    } else if (raw && typeof raw === "object") {
      root = raw;
    } else {
      root = {};
    }

    const printing = root.printing || {};
    const printersLegacy = root.printers || {};

    return {
      kitchen:
        printing.kitchenPrinterName ||
        printersLegacy.kitchen ||
        printersLegacy.cozinha ||
        "",
      counter:
        printing.counterPrinterName ||
        printersLegacy.counter ||
        printersLegacy.balcao ||
        "",
      cashReport: printersLegacy.cashReport || printersLegacy.reports || "",
    };
  } catch (err) {
    console.warn("Não foi possível carregar settings/printers:", err);
    return {
      kitchen: "",
      counter: "",
      cashReport: "",
    };
  }
}

// Normalização de nomes de impressora para mapeamento flexível
function normalizePrinterName(name) {
  return (name || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/driver\s*-\s*/g, "") // remove "Driver -"
    .replace(/\s+/g, " ")
    .trim();
}

function findBestPrinterMatch(printers, requestedName) {
  if (!requestedName) return null;

  const target = normalizePrinterName(requestedName);
  if (!target) return null;

  let found = printers.find((p) => normalizePrinterName(p.name) === target);
  if (found) return found;

  found = printers.find((p) =>
    normalizePrinterName(p.name).includes(target)
  );
  if (found) return found;

  found = printers.find((p) =>
    target.includes(normalizePrinterName(p.name))
  );
  if (found) return found;

  return null;
}

// Lista segura de impressoras (Electron 33+)
async function getSystemPrintersSafe(webContents) {
  if (!webContents) {
    console.warn(
      "[printers] webContents não definido ao tentar listar impressoras."
    );
    return [];
  }

  try {
    if (typeof webContents.getPrintersAsync === "function") {
      const printers = await webContents.getPrintersAsync();
      console.log("[printers] getPrintersAsync ->", printers);
      return printers || [];
    }

    if (typeof webContents.getPrinters === "function") {
      const printers = webContents.getPrinters();
      console.log("[printers] getPrinters (sync) ->", printers);
      return printers || [];
    }

    console.warn(
      "[printers] webContents sem getPrinters / getPrintersAsync. Verifique versão do Electron."
    );
    return [];
  } catch (err) {
    console.error("[printers] erro ao obter lista de impressoras:", err);
    return [];
  }
}

// Resolve o deviceName a partir de role + settings + lista do sistema
function resolveDeviceNameFromRole(
  role,
  {
    target,
    requestedPrinterName,
    kitchenPrinterName,
    counterPrinterName,
    settingsPrinters,
    systemPrinters,
  }
) {
  let requested = null;
  let settingsName = "";

  if (role === "kitchen") {
    if (target === "kitchen") {
      requested = requestedPrinterName || kitchenPrinterName || null;
    } else {
      requested = kitchenPrinterName || null;
    }
    settingsName = settingsPrinters.kitchen;
  } else if (role === "counter") {
    if (target === "counter") {
      requested = requestedPrinterName || counterPrinterName || null;
    } else {
      requested = counterPrinterName || null;
    }
    settingsName = settingsPrinters.counter;
  } else if (role === "cashReport") {
    settingsName = settingsPrinters.cashReport;
  }

  const chosen = requested || settingsName;
  if (!chosen) {
    console.log("[print] nenhum nome configurado para role:", role);
    return undefined;
  }

  if (!systemPrinters || systemPrinters.length === 0) {
    console.log(
      "[print] sem lista de impressoras; usando padrão do sistema."
    );
    return undefined;
  }

  const match = findBestPrinterMatch(systemPrinters, chosen);
  if (match) {
    console.log(`[print] mapped "${chosen}" -> "${match.name}"`);
    return match.name;
  }

  console.log(
    `[print] nenhum match para "${chosen}", usando impressora padrão do sistema.`
  );
  return undefined;
}

// -------------------------------------
// Funções utilitárias de impressão
// -------------------------------------
async function printTextTicket(text, { silent = true, deviceName } = {}) {
  // Criar janela de impressão fora do processo principal para não travar
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page {
            margin: 0;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: "Consolas", "Courier New", monospace;
            font-size: 14px;
            line-height: 1.45;
            padding: 6px 10px;
            width: 260px;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
          }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(text)}</pre>
      </body>
    </html>
  `;

  await win.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(html)
  );

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: silent,
        printBackground: false,
        deviceName: deviceName || undefined,
        scaleFactor: 1.0,
        margins: {
          marginType: 'custom',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      },
      (success, failureReason) => {
        if (!success) {
          console.error("Falha ao imprimir ticket:", failureReason);
        }
        // Forçar fechamento da janela para não travar processos
        setTimeout(() => {
          win.close();
        }, 1000);
        resolve(success);
      }
    );
  });
}

async function printHtmlTicket(innerHtml, { silent = true, deviceName } = {}) {
  // Criar janela de impressão fora do processo principal para não travar
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page {
            margin: 0;
            size: 58mm auto;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: "Courier New", monospace;
            font-size: 12px;
            line-height: 1.3;
            padding: 8px;
            width: 240px; /* bobina 58mm */
            background: #ffffff;
            color: #000000;
          }

          .ticket {
            width: 100%;
          }

          .ticket.kitchen {
            color: #0f172a;
            background: #ffffff;
          }
          .ticket.kitchen .ticket-header,
          .ticket.kitchen .ticket-body,
          .ticket.kitchen .ticket-meta,
          .ticket.kitchen .ticket-section-title {
            color: #0f172a;
            font-weight: 600;
          }
          .ticket.kitchen .ticket-body {
            line-height: 1.5;
          }
          .ticket.kitchen .ticket-alert {
            border-color: #d97706;
            background: #fff7ed;
            color: #7c2d12;
          }

          .ticket-header {
            text-align: center;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 2px solid #000000;
          }
          .ticket-title {
            font-size: 18px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .ticket-subtitle {
            font-size: 14px;
            font-weight: 600;
            margin-top: 2px;
            color: #666666;
          }
          .ticket-meta {
            font-size: 10px;
            color: #666666;
            margin-top: 2px;
          }

          .ticket-tag {
            display: inline-block;
            font-size: 10px;
            border-radius: 999px;
            padding: 1px 6px;
            border: 1px solid #9ca3af;
            margin-top: 3px;
          }

          .ticket-divider {
            border-top: 1px dashed #9ca3af;
            margin: 6px 0;
          }

          .ticket-section {
            margin-top: 4px;
          }
          .ticket-section-title {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 4px;
          }

          /* ALERTA (cozinha) */
          .ticket-alert {
            font-size: 11px;
            padding: 4px 6px;
            border-radius: 4px;
            border: 1px solid #f97316;
            background: #fff7ed;
            color: #7c2d12;
            margin-bottom: 4px;
          }

          /* ITENS (cozinha / balcão) */
          .tk-item {
            padding: 6px 0;
            border-bottom: 1px dotted #666666;
            margin-bottom: 4px;
          }
          .tk-item:last-child {
            border-bottom: 0;
          }
          .tk-item-title {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.2;
          }
          .tk-qty {
            font-weight: 800;
            background: #000000;
            color: #ffffff;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 10px;
          }
          .tk-size {
            font-weight: 600;
            color: #666666;
            font-style: italic;
          }
          .tk-flavors {
            font-weight: 600;
          }
          .tk-item-row {
            font-size: 10px;
            margin-top: 2px;
            color: #666666;
          }

          .tk-item-price {
            color: #111827;
          }

          .tk-badge {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 700;
            margin-right: 4px;
          }
          .tk-badge-extra {
            background: #fee2e2;
            color: #b91c1c;
          }
          .tk-badge-obs {
            background: #b91c1c;
            color: #ffffff;
          }
          .tk-item-extras {
            color: #b91c1c;
            font-weight: 600;
          }
          .tk-item-obs {
            color: #b91c1c;
            font-weight: 700;
          }

          .ticket-body {
            font-size: 12px;
            line-height: 1.35;
            white-space: pre-wrap;
            word-break: break-word;
          }

          /* RESUMO (totais) – balcão */
          .ticket-summary {
            margin-top: 8px;
            border-top: 2px solid #000000;
            padding-top: 6px;
          }
          .ticket-summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 2px;
          }
          .ticket-summary-row + .ticket-summary-row {
            margin-top: 2px;
          }
          .ticket-summary-row--total {
            margin-top: 6px;
            padding-top: 4px;
            border-top: 2px solid #000000;
            font-weight: 800;
            font-size: 14px;
          }
          .ticket-summary-label {
            flex: 1;
            text-transform: uppercase;
            font-weight: 600;
          }
          .ticket-summary-value {
            margin-left: 8px;
            font-weight: 700;
          }

          /* QR / BALCÃO */
          .ticket-section-qr {
            text-align: center;
            margin-top: 12px;
            border-top: 2px solid #000000;
            padding-top: 8px;
          }
          .ticket-qr {
            margin: 8px 0;
          }
          .ticket-qr img {
            max-width: 160px;
            max-height: 160px;
            border: 2px solid #000000;
          }
          .ticket-qr-link {
            font-size: 9px;
            margin-top: 4px;
            word-break: break-all;
            font-weight: 600;
            color: #000000;
          }

          .ticket-footer {
            margin-top: 16px;
            padding-top: 8px;
            border-top: 1px solid #000000;
            font-size: 9px;
            text-align: center;
            color: #666666;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        ${innerHtml}
      </body>
    </html>
  `;

  await win.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(html)
  );

  // Melhorar configuração de impressão para não travar
  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: silent,
        printBackground: false,
        deviceName: deviceName || undefined,
        scaleFactor: 1.0,
        margins: {
          marginType: 'custom',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      },
      (success, failureReason) => {
        if (!success) {
          console.error("Falha ao imprimir ticket HTML:", failureReason);
        }
        // Forçar fechamento da janela para não travar processos
        setTimeout(() => {
          win.close();
        }, 1000);
        resolve(success);
      }
    );
  });
}

// -------------------------------------
// Helpers para relatório de caixa em HTML / PDF
// -------------------------------------
function buildCashReportHtml(payload) {
  const {
    periodLabel,
    statusFilter,
    generatedAt,
    stats = {},
    sessions = [],
  } = payload || {};

  const generatedDate = generatedAt ? new Date(generatedAt) : new Date();

  const statusLabel =
    {
      all: "Todas",
      open: "Abertas",
      closed: "Fechadas",
    }[statusFilter || "all"] || "Todas";

  const headerInfo = `
    Período: ${escapeHtml(periodLabel || "não informado")}<br/>
    Status: ${escapeHtml(statusLabel)}<br/>
    Gerado em: ${escapeHtml(
      generatedDate.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    )}
  `;

  const sessionsRows = sessions
    .map((s) => {
      const opened = s.openedAt ? new Date(s.openedAt) : null;
      const closed = s.closedAt ? new Date(s.closedAt) : null;

      const openedStr = opened
        ? opened.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "-";

      const closedStr = closed
        ? closed.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "-";

      return `
        <tr>
          <td>${escapeHtml(s.id || "")}</td>
          <td>${escapeHtml(openedStr)}</td>
          <td>${escapeHtml(closedStr)}</td>
          <td>${escapeHtml(s.status === "closed" ? "Fechada" : "Aberta")}</td>
          <td>${escapeHtml(s.operator || "-")}</td>
          <td style="text-align:right;">${formatCurrencyBR(s.opening)}</td>
          <td style="text-align:right;">${formatCurrencyBR(s.closing)}</td>
          <td style="text-align:right;">${formatCurrencyBR(s.sales)}</td>
          <td style="text-align:right;">${formatCurrencyBR(s.difference)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Fechamento de Caixa</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 12px;
            color: #111827;
            padding: 24px;
            background: #f9fafb;
          }
          h1 {
            font-size: 20px;
            margin-bottom: 4px;
          }
          h2 {
            font-size: 14px;
            margin: 16px 0 8px;
          }
          .header {
            margin-bottom: 16px;
          }
          .header-sub {
            font-size: 11px;
            color: #4b5563;
            margin-top: 4px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin: 8px 0 16px;
          }
          .summary-card {
            background: #ffffff;
            border-radius: 8px;
            padding: 8px 10px;
            border: 1px solid #e5e7eb;
          }
          .summary-title {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 2px;
          }
          .summary-value {
            font-size: 13px;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            background: #ffffff;
          }
          thead {
            background: #f3f4f6;
          }
          th, td {
            font-size: 11px;
            padding: 6px 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          th {
            text-align: left;
            font-weight: 600;
            color: #374151;
          }
          tfoot td {
            font-weight: 600;
            background: #f9fafb;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Fechamento de Caixa - Anne &amp; Tom</h1>
          <div class="header-sub">
            ${headerInfo}
          </div>
        </div>

        <h2>Resumo</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-title">Sessões no período</div>
            <div class="summary-value">${stats.count || 0}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">Vendas em caixa</div>
            <div class="summary-value">${formatCurrencyBR(
              stats.totalSales
            )}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">Diferença acumulada</div>
            <div class="summary-value">${formatCurrencyBR(
              stats.totalDifference
            )}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">Média por sessão fechada</div>
            <div class="summary-value">${formatCurrencyBR(
              stats.avgPerSession
            )}</div>
          </div>
        </div>

        <h2>Detalhe por sessão</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Abertura</th>
              <th>Fechamento</th>
              <th>Status</th>
              <th>Operador</th>
              <th style="text-align:right;">Abertura</th>
              <th style="text-align:right;">Fechamento</th>
              <th style="text-align:right;">Vendas</th>
              <th style="text-align:right;">Diferença</th>
            </tr>
          </thead>
          <tbody>
            ${sessionsRows || ""}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

// -------------------------------------
// Mapas / labels para pedidos (PDV)
// -------------------------------------
const PAYMENT_METHOD_LABELS = {
  "": "A definir",
  money: "Dinheiro",
  dinheiro: "Dinheiro",
  cash: "Dinheiro",
  pix: "Pix",
  card: "Cartão",
  cartao: "Cartão (maquininha)",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  vr: "Vale refeição",
};

const PAYMENT_STATUS_LABELS = {
  pending: "Pendente",
  paid: "Pago",
  to_define: "A definir",
};

const ORDER_TYPE_LABELS = {
  delivery: "Entrega",
  pickup: "Retirada na loja",
  counter: "Balcão / retirada",
};

const SOURCE_LABELS = {
  website: "Site",
  web: "Site",
  whatsapp: "WhatsApp",
  ifood: "iFood",
  phone: "Telefone",
  local: "Balcão / Local",
  balcao: "Balcão / Local",
  counter: "Balcão / Local",
  desktop: "Sistema",
};

function normalizeStatus(status) {
  if (!status) return "open";
  const s = status.toString().toLowerCase();
  if (s === "finalizado" || s === "done") return "done";
  if (s === "cancelado" || s === "cancelled") return "cancelled";
  if (s === "preparing" || s === "em_preparo" || s === "preparo") {
    return "preparing";
  }
  if (s === "out_for_delivery" || s === "delivery" || s === "em_entrega") {
    return "out_for_delivery";
  }
  if (s === "open" || s === "em_aberto") return "open";
  return s;
}

// -------------------------------------
// Ticket COZINHA – com badges de ADICIONAIS / OBS
// -------------------------------------
function buildKitchenTicket(order) {
  if (!order) {
    return '<div class="ticket"><div class="ticket-header"><div class="ticket-title">Pedido não informado</div></div></div>';
  }

  const id = order.id || order.code || order.numeroPedido || "";
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();

  const rawOrderType =
    order.type || order.delivery.mode || order.orderType || "delivery";
  const orderTypeKey = rawOrderType.toString().toLowerCase();
  const orderTypeLabel =
    ORDER_TYPE_LABELS[orderTypeKey] || ORDER_TYPE_LABELS.delivery;

  const rawSource = (order.source || "local").toString().toLowerCase();
  const sourceLabel = SOURCE_LABELS[rawSource] || SOURCE_LABELS.local;

  const statusKey = normalizeStatus(order.status || order.orderStatus);
  const statusLabelMap = {
    open: "Em aberto",
    preparing: "Em preparo",
    out_for_delivery: "Saiu p/ entrega",
    done: "Finalizado",
    cancelled: "Cancelado",
  };
  const statusLabel = statusLabelMap[statusKey] || "Em aberto";

  const customer = order.customerSnapshot || order.customer || {};

  const customerName =
    customer.name || order.customerName || "Cliente";

  const customerPhone =
    customer.phone || order.customerPhone || "";

  const customerMode = order.customerMode || "registered";
  const counterLabel =
    customerMode === "counter"
      ? order.counterLabel || order.customerName || "Balcão"
      : null;

  const addressObj =
    order.delivery.address ||
    customer.address ||
    order.customerAddress ||
    order.address ||
    null;

  let addressText = "";
  if (typeof addressObj === "string") {
    addressText = addressObj;
  } else if (addressObj && typeof addressObj === "object") {
    const street = addressObj.street || addressObj.logradouro || "";
    const number = addressObj.number || addressObj.numero || "";
    const neighborhood = addressObj.neighborhood || addressObj.bairro || "";
    const city = addressObj.city || addressObj.cidade || "";
    const state = addressObj.state || addressObj.uf || "";

    const main = [
      street && (street + (number ? ", " + number : "")),
      neighborhood,
      city && (state ? city + " / " + state : city),
    ]
      .filter(Boolean)
      .join(" • ");

    const cep = addressObj.cep || addressObj.CEP || "";
    const complement = addressObj.complement || addressObj.complemento || "";
    const extras = [
      complement && "Compl.: " + complement,
      cep && "CEP: " + cep,
    ]
      .filter(Boolean)
      .join(" • ");

    addressText = [main, extras].filter(Boolean).join(" • ");
  }

  const courierRaw =
    order.delivery.courier ||
    order.delivery.motoboy ||
    order.delivery.driver ||
    order.motoboy ||
    null;

  let courierName = "";
  let courierPhone = "";

  if (courierRaw) {
    if (typeof courierRaw === "string") {
      courierName = courierRaw;
    } else if (typeof courierRaw === "object") {
      courierName = courierRaw.name || courierRaw.nome || "";
      courierPhone = courierRaw.phone || courierRaw.telefone || "";
    }
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const orderNotes = order.orderNotes || "";
  const kitchenNotes = order.kitchenNotes || "";

  const hasAnyExtras = items.some(
    (i) => Array.isArray(i.extras) && i.extras.length > 0
  );
  const hasAnyItemObs = items.some(
    (i) => i.kitchenNotes || i.obs || i.observacao
  );
  const hasGlobalObs = Boolean(kitchenNotes || orderNotes);

  const parts = [];

  parts.push('<div class="ticket ticket-kitchen">');

  // Cabeçalho
  parts.push('  <div class="ticket-header">');
  parts.push('    <div class="ticket-title">ANNE &amp; TOM</div>');
  parts.push('    <div class="ticket-subtitle">COMANDA COZINHA</div>');
  parts.push(
    '    <div class="ticket-meta">Pedido #' +
      escapeHtml(id) +
      " • " +
      escapeHtml(orderTypeLabel) +
      " • " +
      escapeHtml(statusLabel) +
      "</div>"
  );
  parts.push(
    '    <div class="ticket-meta">' +
      escapeHtml(
        createdAt.toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      ) +
      " • Origem: " +
      escapeHtml(sourceLabel) +
      "</div>"
  );

  if (customerMode === "counter" && counterLabel) {
    parts.push(
      '    <div class="ticket-meta">Atendimento: ' +
        escapeHtml(counterLabel) +
        "</div>"
    );
  } else {
    parts.push(
      '    <div class="ticket-meta">Cliente: ' +
        escapeHtml(customerName) +
        "</div>"
    );
    if (customerPhone) {
      parts.push(
        '    <div class="ticket-meta">Fone: ' +
          escapeHtml(customerPhone) +
          "</div>"
      );
    }
  }

  if (addressText) {
    parts.push(
      '    <div class="ticket-meta">Endereço: ' +
        escapeHtml(addressText) +
        "</div>"
    );
  }

  if (courierName) {
    parts.push(
      '    <div class="ticket-meta">Entregador: ' +
        escapeHtml(courierName) +
        (courierPhone ? " • " + escapeHtml(courierPhone) : "") +
        "</div>"
    );
  }

  parts.push("  </div>");
  parts.push('  <div class="ticket-divider"></div>');

  // Alerta visual se tiver extras/obs
  if (hasAnyExtras || hasAnyItemObs || hasGlobalObs) {
    parts.push(
      '  <div class="ticket-alert">⚠ Pedido com ADICIONAIS / OBSERVAÇÕES — atenção ao montar!</div>'
    );
  }

  // Itens
  parts.push('  <div class="ticket-section">');
  parts.push('    <div class="ticket-section-title">ITENS</div>');

  if (!items.length) {
    parts.push('    <div class="ticket-body">Nenhum item cadastrado.</div>');
  } else {
    items.forEach((item) => {
      const qty = Number(item.quantity || item.qty || 1);
      const sizeLabel = (item.sizeLabel || item.size || "").toString();

      const flavor1Name =
        item.name || item.flavor1Name || "Item";

      const flavor2Name =
        item.halfDescription || item.flavor2Name || "";

      const flavor3Name =
        item.flavor3Name || item.flavor3Label || "";

      const flavors = [flavor1Name, flavor2Name, flavor3Name].filter(Boolean);

      const unitPrice = Number(item.unitPrice || item.price || 0);
      const lineTotal =
        Number(item.lineTotal || item.total || 0) ||
        unitPrice * qty;

      const extrasNames = Array.isArray(item.extras)
        ? item.extras
            .map(
              (ex) =>
                (ex && (ex.name || ex.label || ex.descricao)) || ""
            )
            .filter(Boolean)
            .join(", ")
        : "";

      const itemObs =
        item.kitchenNotes || item.obs || item.observacao || "";

      parts.push('    <div class="tk-item">');

      // título do item (qtd + tamanho + sabores)
      parts.push('      <div class="tk-item-title">');
      parts.push('        <span class="tk-qty">' + qty + "x</span>");
      if (sizeLabel) {
        parts.push(
          '        <span class="tk-size">' +
            escapeHtml(sizeLabel) +
            "</span>"
        );
      }
      parts.push(
        '        <span class="tk-flavors">' +
          escapeHtml(flavors.join(" / ")) +
          "</span>"
      );
      parts.push("      </div>");

      // preços
      if (unitPrice || lineTotal) {
        parts.push(
          '      <div class="tk-item-row tk-item-price">Un.: ' +
            escapeHtml(formatCurrencyBR(unitPrice)) +
            " • Ln.: " +
            escapeHtml(formatCurrencyBR(lineTotal)) +
            "</div>"
        );
      }

      // adicionais
      if (extrasNames) {
        parts.push(
          '      <div class="tk-item-row tk-item-extras"><span class="tk-badge tk-badge-extra">ADICIONAIS</span>' +
            escapeHtml(extrasNames) +
            "</div>"
        );
      }

      // observações
      if (itemObs) {
        parts.push(
          '      <div class="tk-item-row tk-item-obs"><span class="tk-badge tk-badge-obs">OBS</span> ' +
            escapeHtml(itemObs) +
            "</div>"
        );
      }

      parts.push("    </div>");
    });
  }

  parts.push("  </div>");

  // Observações gerais
  if (kitchenNotes || orderNotes) {
    parts.push('  <div class="ticket-divider"></div>');
    parts.push('  <div class="ticket-section">');
    if (kitchenNotes) {
      parts.push(
        '    <div class="ticket-section-title">OBSERVAÇÕES COZINHA</div>'
      );
      parts.push(
        '    <div class="ticket-body">' +
          escapeHtml(kitchenNotes) +
          "</div>"
      );
    }
    if (orderNotes) {
      parts.push(
        '    <div class="ticket-section-title">OBSERVAÇÕES DO PEDIDO</div>'
      );
      parts.push(
        '    <div class="ticket-body">' +
          escapeHtml(orderNotes) +
          "</div>"
      );
    }
    parts.push("  </div>");
  }

  parts.push('  <div class="ticket-footer">');
  parts.push("    Impresso para COZINHA - Anne &amp; Tom");
  parts.push("  </div>");

  parts.push("</div>");

  return parts.join("");
}

// -------------------------------------
// Builder de ticket texto (string) – opcional / compat
// -------------------------------------
function buildCounterTicket(order) {
  if (!order) return "Pedido não informado.";

  const id = order.id || order.code || order.numeroPedido || "";
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();

  const rawOrderType =
    order.type || order.delivery.mode || order.orderType || "delivery";
  const orderTypeKey = rawOrderType.toString().toLowerCase();
  const orderTypeLabel =
    ORDER_TYPE_LABELS[orderTypeKey] || ORDER_TYPE_LABELS.delivery;

  const rawSource = (order.source || "local").toString().toLowerCase();
  const sourceLabel = SOURCE_LABELS[rawSource] || SOURCE_LABELS.local;

  const rawPaymentMethod =
    order.payment.method || order.paymentMethod || "";
  const paymentMethodKey = rawPaymentMethod.toString().toLowerCase();
  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[paymentMethodKey] || PAYMENT_METHOD_LABELS[""];

  const rawPaymentStatus =
    order.payment.status || order.paymentStatus || "to_define";
  const paymentStatusKey = rawPaymentStatus
    .toString()
    .toLowerCase()
    .replace("-", "_");
  const paymentStatusLabel =
    PAYMENT_STATUS_LABELS[paymentStatusKey] || "A definir";

  const cashGiven =
    Number(
      order.payment.cashGiven ||
        order.cashGiven ||
        order.payment.valorEntregue ||
        0
    ) || 0;

  const customer = order.customerSnapshot || order.customer || {};

  const customerName =
    customer.name || order.customerName || "Cliente";

  const customerPhone =
    customer.phone || order.customerPhone || "";

  const customerCpf =
    customer.cpf || order.customerCpf || "";

  const customerMode = order.customerMode || "registered";
  const counterLabel =
    customerMode === "counter"
      ? order.counterLabel || order.customerName || "Balcão"
      : null;

  const addressObj =
    order.delivery.address ||
    customer.address ||
    order.customerAddress ||
    order.address ||
    null;

  let addressText = "";
  if (typeof addressObj === "string") {
    addressText = addressObj;
  } else if (addressObj && typeof addressObj === "object") {
    const street = addressObj.street || addressObj.logradouro || "";
    const number = addressObj.number || addressObj.numero || "";
    const neighborhood = addressObj.neighborhood || addressObj.bairro || "";
    const city = addressObj.city || addressObj.cidade || "";
    const state = addressObj.state || addressObj.uf || "";

    const main = [
      street && (street + (number ? ", " + number : "")),
      neighborhood,
      city && (state ? city + " / " + state : city),
    ]
      .filter(Boolean)
      .join(" • ");

    const cep = addressObj.cep || addressObj.CEP || "";
    const complement = addressObj.complement || addressObj.complemento || "";
    const extras = [
      complement && "Compl.: " + complement,
      cep && "CEP: " + cep,
    ]
      .filter(Boolean)
      .join(" • ");

    addressText = [main, extras].filter(Boolean).join(" • ");
  }

  const courierRaw =
    order.delivery.courier ||
    order.delivery.motoboy ||
    order.delivery.driver ||
    order.motoboy ||
    null;

  let courierName = "";
  let courierPhone = "";

  if (courierRaw) {
    if (typeof courierRaw === "string") {
      courierName = courierRaw;
    } else if (typeof courierRaw === "object") {
      courierName = courierRaw.name || courierRaw.nome || "";
      courierPhone = courierRaw.phone || courierRaw.telefone || "";
    }
  }

  const subtotal = Number(
    order.totals.subtotal || order.subtotal || 0
  );

  const deliveryFee = Number(
    order.delivery.fee ||
      order.totals.deliveryFee ||
      order.deliveryFee ||
      0
  );

  const discountAmount = Number(
    order.totals.discount ||
      (typeof order.discount === "object"
        ? order.discount.amount
        : order.discount) ||
      0
  );

  const total = Number(
    order.totals.finalTotal ||
      order.total ||
      subtotal + deliveryFee - discountAmount
  );

  const changeAmount =
    cashGiven > 0 ? Math.max(cashGiven - total, 0) : 0;

  const items = Array.isArray(order.items) ? order.items : [];

  const trackingUrl = getTrackingUrlFromOrder(order);

  const lines = [];

  lines.push("ANNE & TOM PIZZARIA");
  lines.push("CUPOM NÃO FISCAL");
  lines.push("--------------------------------");
  lines.push("PEDIDO #" + id);
  lines.push(
    createdAt.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    })
  );
  lines.push("ORIGEM: " + sourceLabel);
  lines.push("TIPO:   " + orderTypeLabel);
  lines.push("--------------------------------");

  if (customerMode === "counter" && counterLabel) {
    lines.push("ATEND.: " + counterLabel);
  } else {
    lines.push("CLIENTE: " + customerName);
    if (customerPhone) lines.push("FONE:    " + customerPhone);
    if (customerCpf) lines.push("CPF:     " + customerCpf);
  }

  if (addressText && orderTypeKey === "delivery") {
    lines.push("ENDEREÇO:");
    String(addressText)
      .split(" • ")
      .forEach((ln) => lines.push("  " + ln));
  }

  lines.push("--------------------------------");
  lines.push("ITENS");

  if (!items.length) {
    lines.push("Nenhum item cadastrado.");
  } else {
    items.forEach((item) => {
      const qty = Number(item.quantity || item.qty || 1);
      const sizeLabel = (item.sizeLabel || item.size || "").toString();

      const flavor1Name =
        item.name || item.flavor1Name || "Item";

      const flavor2Name =
        item.halfDescription || item.flavor2Name || "";

      const flavor3Name =
        item.flavor3Name || item.flavor3Label || "";

      const flavors = [flavor1Name, flavor2Name, flavor3Name].filter(
        Boolean
      );

      const unitPrice = Number(item.unitPrice || item.price || 0);
      const lineTotal =
        Number(item.lineTotal || item.total || 0) ||
        unitPrice * qty;

      const nameLine = [qty + "x", sizeLabel, flavors.join(" / ")]
        .filter(Boolean)
        .join(" ");

      lines.push(nameLine);
      if (unitPrice || lineTotal) {
        lines.push("  Un.: " + formatCurrencyBR(unitPrice));
        lines.push("  Ln.: " + formatCurrencyBR(lineTotal));
      }

      if (Array.isArray(item.extras) && item.extras.length > 0) {
        const extrasNames = item.extras
          .map(
            (ex) =>
              (ex && (ex.name || ex.label || ex.descricao)) || ""
          )
          .filter(Boolean)
          .join(", ");
        if (extrasNames) {
          lines.push("  + ADIC.: " + extrasNames);
        }
      }

      if (item.obs || item.observacao || item.kitchenNotes) {
        const noteText =
          item.obs || item.observacao || item.kitchenNotes;
        lines.push("  OBS: " + String(noteText));
      }
    });
  }

  lines.push("--------------------------------");
  lines.push("SUBTOTAL : " + formatCurrencyBR(subtotal));
  lines.push("ENTREGA  : " + formatCurrencyBR(deliveryFee));
  lines.push("DESCONTO : -" + formatCurrencyBR(discountAmount));
  lines.push("TOTAL    : " + formatCurrencyBR(total));
  lines.push("--------------------------------");
  lines.push("PAGAMENTO: " + paymentMethodLabel);
  lines.push("STATUS   : " + paymentStatusLabel);

  if (cashGiven > 0) {
    lines.push("VALOR PAGO: " + formatCurrencyBR(cashGiven));
    lines.push("TROCO     : " + formatCurrencyBR(changeAmount));
  }

  if (orderTypeKey === "delivery") {
    lines.push("--------------------------------");
    lines.push("ENTREGA / MOTOBOY");
    if (courierName) {
      lines.push("ENTREGADOR: " + courierName);
    } else {
      lines.push("ENTREGADOR: A DEFINIR");
    }
    if (courierPhone) {
      lines.push("FONE MOT.: " + courierPhone);
    }
    lines.push("VALOR NA PORTA: " + formatCurrencyBR(total));
  }

  if (order.orderNotes) {
    lines.push("--------------------------------");
    lines.push("OBSERVAÇÕES:");
    String(order.orderNotes)
      .split(/\r\n/)
      .forEach((ln) => lines.push("  " + ln));
  }

  if (trackingUrl) {
    lines.push("--------------------------------");
    lines.push("TRACKING / QR:");
    lines.push("LINK:");
    String(trackingUrl)
      .split(/\r\n/)
      .forEach((ln) => lines.push("  " + ln));
  }

  lines.push("--------------------------------");
  lines.push("Obrigado pela preferência!");
  lines.push("Sistema AXION PDV");

  return lines.join("\n");
}

// -------------------------------------
// HTML do BALCÃO com layout em blocos + QR
// -------------------------------------
function buildCounterHtmlTicket(order, qrCodeDataUrl) {
  if (!order) {
    return `
      <div class="ticket ticket-counter">
        <div class="ticket-header">
          <div class="ticket-title">ANNE &amp; TOM</div>
          <div class="ticket-subtitle">CUPOM BALCÃO</div>
        </div>
        <div class="ticket-divider"></div>
        <div class="ticket-body">Pedido não informado.</div>
      </div>
    `;
  }

  const id = order.id || order.code || order.numeroPedido || "";
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();

  const rawOrderType =
    order.type || order.delivery.mode || order.orderType || "delivery";
  const orderTypeKey = rawOrderType.toString().toLowerCase();
  const orderTypeLabel =
    ORDER_TYPE_LABELS[orderTypeKey] || ORDER_TYPE_LABELS.delivery;

  const rawSource = (order.source || "local").toString().toLowerCase();
  const sourceLabel = SOURCE_LABELS[rawSource] || SOURCE_LABELS.local;

  const rawPaymentMethod =
    order.payment.method || order.paymentMethod || "";
  const paymentMethodKey = rawPaymentMethod.toString().toLowerCase();
  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[paymentMethodKey] || PAYMENT_METHOD_LABELS[""];

  const rawPaymentStatus =
    order.payment.status || order.paymentStatus || "to_define";
  const paymentStatusKey = rawPaymentStatus
    .toString()
    .toLowerCase()
    .replace("-", "_");
  const paymentStatusLabel =
    PAYMENT_STATUS_LABELS[paymentStatusKey] || "A definir";

  const cashGiven =
    Number(
      order.payment.cashGiven ||
        order.cashGiven ||
        order.payment.valorEntregue ||
        0
    ) || 0;

  const customer = order.customerSnapshot || order.customer || {};

  const customerName =
    customer.name || order.customerName || "Cliente";

  const customerPhone =
    customer.phone || order.customerPhone || "";

  const customerCpf =
    customer.cpf || order.customerCpf || "";

  const customerMode = order.customerMode || "registered";
  const counterLabel =
    customerMode === "counter"
      ? order.counterLabel || order.customerName || "Balcão"
      : null;

  const addressObj =
    order.delivery.address ||
    customer.address ||
    order.customerAddress ||
    order.address ||
    null;

  let addressText = "";
  if (typeof addressObj === "string") {
    addressText = addressObj;
  } else if (addressObj && typeof addressObj === "object") {
    const street = addressObj.street || addressObj.logradouro || "";
    const number = addressObj.number || addressObj.numero || "";
    const neighborhood = addressObj.neighborhood || addressObj.bairro || "";
    const city = addressObj.city || addressObj.cidade || "";
    const state = addressObj.state || addressObj.uf || "";

    const main = [
      street && (street + (number ? ", " + number : "")),
      neighborhood,
      city && (state ? city + " / " + state : city),
    ]
      .filter(Boolean)
      .join(" • ");

    const cep = addressObj.cep || addressObj.CEP || "";
    const complement = addressObj.complement || addressObj.complemento || "";
    const extras = [
      complement && "Compl.: " + complement,
      cep && "CEP: " + cep,
    ]
      .filter(Boolean)
      .join(" • ");

    addressText = [main, extras].filter(Boolean).join(" • ");
  }

  const courierRaw =
    order.delivery.courier ||
    order.delivery.motoboy ||
    order.delivery.driver ||
    order.motoboy ||
    null;

  let courierName = "";
  let courierPhone = "";

  if (courierRaw) {
    if (typeof courierRaw === "string") {
      courierName = courierRaw;
    } else if (typeof courierRaw === "object") {
      courierName = courierRaw.name || courierRaw.nome || "";
      courierPhone = courierRaw.phone || courierRaw.telefone || "";
    }
  }

  const subtotal = Number(
    order.totals.subtotal || order.subtotal || 0
  );

  const deliveryFee = Number(
    order.delivery.fee ||
      order.totals.deliveryFee ||
      order.deliveryFee ||
      0
  );

  const discountAmount = Number(
    order.totals.discount ||
      (typeof order.discount === "object"
        ? order.discount.amount
        : order.discount) ||
      0
  );

  const total = Number(
    order.totals.finalTotal ||
      order.total ||
      subtotal + deliveryFee - discountAmount
  );

  const changeAmount =
    cashGiven > 0 ? Math.max(cashGiven - total, 0) : 0;

  const items = Array.isArray(order.items) ? order.items : [];

  const trackingUrl = getTrackingUrlFromOrder(order);

  // ITENS – reuso do estilo da cozinha
  const itensHtml = items.length
    ? items
        .map((item) => {
          const qty = Number(item.quantity || item.qty || 1);
          const sizeLabel = (item.sizeLabel || item.size || "").toString();

          const flavor1Name =
            item.name || item.flavor1Name || "Item";

          const flavor2Name =
            item.halfDescription || item.flavor2Name || "";

          const flavor3Name =
            item.flavor3Name || item.flavor3Label || "";

          const flavors = [flavor1Name, flavor2Name, flavor3Name].filter(
            Boolean
          );

          const unitPrice = Number(item.unitPrice || item.price || 0);
          const lineTotal =
            Number(item.lineTotal || item.total || 0) ||
            unitPrice * qty;

          const extrasNames = Array.isArray(item.extras)
            ? item.extras
                .map(
                  (ex) =>
                    (ex && (ex.name || ex.label || ex.descricao)) || ""
                )
                .filter(Boolean)
                .join(", ")
            : "";

          const itemObs =
            item.kitchenNotes || item.obs || item.observacao || "";

          const lines = [];

          lines.push('<div class="tk-item">');

          lines.push('<div class="tk-item-title">');
          lines.push('<span class="tk-qty">' + qty + "x</span>");
          if (sizeLabel) {
            lines.push(
              '<span class="tk-size">' +
                escapeHtml(sizeLabel) +
                "</span>"
            );
          }
          lines.push(
            '<span class="tk-flavors">' +
              escapeHtml(flavors.join(" / ")) +
              "</span>"
          );
          lines.push("</div>");

          if (unitPrice || lineTotal) {
            lines.push(
              '<div class="tk-item-row tk-item-price">Un.: ' +
                escapeHtml(formatCurrencyBR(unitPrice)) +
                " • Ln.: " +
                escapeHtml(formatCurrencyBR(lineTotal)) +
                "</div>"
            );
          }

          if (extrasNames) {
            lines.push(
              '<div class="tk-item-row tk-item-extras"><span class="tk-badge tk-badge-extra">ADICIONAIS</span>' +
                escapeHtml(extrasNames) +
                "</div>"
            );
          }

          if (itemObs) {
            lines.push(
              '<div class="tk-item-row tk-item-obs"><span class="tk-badge tk-badge-obs">OBS</span> ' +
                escapeHtml(itemObs) +
                "</div>"
            );
          }

          lines.push("</div>");

          return lines.join("");
        })
        .join("")
    : '<div class="ticket-body">Nenhum item cadastrado.</div>';

  // OBS GERAIS
  const hasObs = Boolean(order.orderNotes);
  const obsHtml = hasObs
    ? `
      <div class="ticket-section">
        <div class="ticket-section-title">OBSERVAÇÕES</div>
        <div class="ticket-body">${escapeHtml(order.orderNotes)}</div>
      </div>
    `
    : "";

  // ENTREGA / MOTOBOY
  const isDelivery = orderTypeKey === "delivery";
  const entregaHtml = isDelivery
    ? `
      <div class="ticket-section">
        <div class="ticket-section-title">ENTREGA / MOTOBOY</div>
        <div class="ticket-body">
          ${courierName ? "Entregador: " + escapeHtml(courierName) + "<br/>" : "Entregador: A definir<br/>"}
          ${
            courierPhone
              ? "Fone mot.: " + escapeHtml(courierPhone) + "<br/>"
              : ""
          }
          Valor na porta: ${escapeHtml(formatCurrencyBR(total))}
        </div>
      </div>
    `
    : "";

  return `
    <div class="ticket ticket-counter">
      <div class="ticket-header">
        <div class="ticket-title">ANNE &amp; TOM</div>
        <div class="ticket-subtitle">CUPOM BALCÃO / ENTREGA</div>
        <div class="ticket-meta">
          Pedido #${escapeHtml(id)} • ${escapeHtml(
    createdAt.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    })
  )}
        </div>
        <div class="ticket-meta">
          Origem: ${escapeHtml(sourceLabel)} • Tipo: ${escapeHtml(
    orderTypeLabel
  )}
        </div>
        <div class="ticket-tag">#${escapeHtml(id)}</div>
      </div>

      <div class="ticket-divider"></div>

      <div class="ticket-section">
        <div class="ticket-section-title">CLIENTE</div>
        <div class="ticket-body">
          ${
            customerMode === "counter" && counterLabel
              ? "Atendimento: " + escapeHtml(counterLabel) + "<br/>"
              : "Nome: " + escapeHtml(customerName) + "<br/>"
          }
          ${
            customerPhone
              ? "Fone: " + escapeHtml(customerPhone) + "<br/>"
              : ""
          }
          ${customerCpf ? "CPF: " + escapeHtml(customerCpf) + "<br/>" : ""}
          ${
            addressText && isDelivery
              ? "Endereço: " + escapeHtml(addressText)
              : ""
          }
        </div>
      </div>

      <div class="ticket-divider"></div>

      <div class="ticket-section">
        <div class="ticket-section-title">ITENS</div>
        ${itensHtml}
      </div>

      <div class="ticket-divider"></div>

      <div class="ticket-section">
        <div class="ticket-section-title">RESUMO</div>
        <div class="ticket-summary">
          <div class="ticket-summary-row">
            <span class="ticket-summary-label">Subtotal</span>
            <span class="ticket-summary-value">${escapeHtml(
              formatCurrencyBR(subtotal)
            )}</span>
          </div>
          <div class="ticket-summary-row">
            <span class="ticket-summary-label">Entrega</span>
            <span class="ticket-summary-value">${escapeHtml(
              formatCurrencyBR(deliveryFee)
            )}</span>
          </div>
          <div class="ticket-summary-row">
            <span class="ticket-summary-label">Desconto</span>
            <span class="ticket-summary-value">-${escapeHtml(
              formatCurrencyBR(discountAmount)
            )}</span>
          </div>
          <div class="ticket-summary-row ticket-summary-row--total">
            <span class="ticket-summary-label">TOTAL</span>
            <span class="ticket-summary-value">${escapeHtml(
              formatCurrencyBR(total)
            )}</span>
          </div>
        </div>
      </div>

      <div class="ticket-section">
        <div class="ticket-section-title">PAGAMENTO</div>
        <div class="ticket-body">
          Método: ${escapeHtml(paymentMethodLabel)}<br/>
          Status: ${escapeHtml(paymentStatusLabel)}<br/>
          ${
            cashGiven > 0
              ? "Valor pago: " +
                escapeHtml(formatCurrencyBR(cashGiven)) +
                "<br/>Troco: " +
                escapeHtml(formatCurrencyBR(changeAmount)) +
                "<br/>"
              : ""
          }
        </div>
      </div>

      ${entregaHtml}
      ${obsHtml}

      ${
        qrCodeDataUrl || trackingUrl
          ? `
      <div class="ticket-divider"></div>
      <div class="ticket-section ticket-section-qr">
        <div class="ticket-section-title">QR CODE - ACOMPANHE SEU PEDIDO</div>
        <div class="ticket-body" style="text-align: center; margin-bottom: 6px;">
          Escaneie para acompanhar a entrega em tempo real
        </div>
        ${
          qrCodeDataUrl
            ? `<div class="ticket-qr"><img src="${escapeHtml(
                qrCodeDataUrl
              )}" alt="QR Code" /></div>`
            : ""
        }
        ${
          trackingUrl
            ? `<div class="ticket-qr-link" style="margin-top: 8px; font-size: 10px;">${escapeHtml(trackingUrl)}</div>`
            : ""
        }
        <div class="ticket-body" style="text-align: center; margin-top: 8px; font-size: 9px; font-weight: 600;">
          📱 motoboy.annetom.com
        </div>
      </div>
      `
          : ""
      }

      <div class="ticket-footer">
        Impresso para BALCÃO - Anne &amp; Tom
      </div>
    </div>
  `;
}

// -------------------------------------
// IPC: Impressão de tickets genéricos (sem QR extra)
// -------------------------------------
ipcMain.handle("print:tickets", async (event, payload) => {
  const {
    kitchenText,
    counterText,
    silent,
    target,
    requestedPrinterName,
    kitchenPrinterName,
    counterPrinterName,
    async: asyncMode = false,
  } = payload || {};

  if (!kitchenText && !counterText) {
    console.warn("print:tickets chamado sem textos de ticket.");
    return false;
  }

  try {
    const settingsPrinters = await getPrinterSettingsSafe();
    const systemPrinters = await getSystemPrintersSafe(event.sender);

    const ctx = {
      target,
      requestedPrinterName,
      kitchenPrinterName,
      counterPrinterName,
      settingsPrinters,
      systemPrinters,
    };

    const silentFlag = silent ? true : false;

    if (kitchenText) {
      const deviceNameKitchen = resolveDeviceNameFromRole("kitchen", ctx);
      const kitchenInnerHtml = `
        <div class="ticket">
          <pre class="ticket-body">${escapeHtml(kitchenText)}</pre>
        </div>
      `;
      await printHtmlTicket(kitchenInnerHtml, {
        silent: silentFlag,
        async: asyncMode,
        deviceName: deviceNameKitchen,
      });
    }

    if (counterText) {
      const deviceNameCounter = resolveDeviceNameFromRole("counter", ctx);
      await printTextTicket(counterText, {
        silent: silentFlag,
        async: asyncMode,
        deviceName: deviceNameCounter,
      });
    }

    return true;
  } catch (err) {
    console.error("Erro em print:tickets:", err);
    return false;
  }
});

// -------------------------------------
// IPC: print:order (principal, com QR no BALCÃO)
// -------------------------------------
ipcMain.handle("print:order", async (event, { order, options } = {}) => {
  try {
    if (!order) {
      console.warn("print:order chamado sem order.");
      return { success: false, error: "Pedido não informado." };
    }

    const mode = (options && options.mode) || "full";
    const silent =
      options && typeof options.silent === "boolean"
        ? options.silent
        : true;
    
    // Suporte para modo assíncrono
    const asyncMode = options && typeof options.async === "boolean"
      ? options.async
      : false;

    const settingsPrinters = await getPrinterSettingsSafe();
    const systemPrinters = await getSystemPrintersSafe(event.sender);

    const ctx = {
      target: null,
      requestedPrinterName: null,
      kitchenPrinterName: null,
      counterPrinterName: null,
      settingsPrinters,
      systemPrinters,
    };

    const trackingUrl = getTrackingUrlFromOrder(order);
    const qrCodeDataUrl = await generateQrDataUrl(trackingUrl);

    // Cozinha: ticket HTML com destaques de ADICIONAIS / OBS
    const kitchenHtml = buildKitchenTicket(order);
    // Balcão: ticket texto estruturado + QR
    const counterHtml = buildCounterHtmlTicket(order, qrCodeDataUrl);

    if (mode === "kitchen" || mode === "full") {
      const deviceNameKitchen = resolveDeviceNameFromRole("kitchen", ctx);
      await printHtmlTicket(kitchenHtml, {
        silent,
        async: asyncMode,
        deviceName: deviceNameKitchen,
      });
    }

    if (mode === "counter" || mode === "full") {
      const deviceNameCounter = resolveDeviceNameFromRole("counter", ctx);
      await printHtmlTicket(counterHtml, {
        silent,
        async: asyncMode,
        deviceName: deviceNameCounter,
      });
    }

    return { success: true };
  } catch (err) {
    console.error("Erro em print:order:", err);
    return { success: false, error: String(err) };
  }
});

// -------------------------------------
// IPC: Lista de impressoras e teste rápido
// -------------------------------------
ipcMain.handle("print:list-printers", async (event) => {
  try {
    const printers = await getSystemPrintersSafe(event.sender);
    console.log("[print:list-printers] printers:", printers);
    return printers;
  } catch (e) {
    console.error("Erro em print:list-printers:", e);
    return [];
  }
});

ipcMain.handle("print:test", async (event, { role } = {}) => {
  try {
    const settingsPrinters = await getPrinterSettingsSafe();
    const systemPrinters = await getSystemPrintersSafe(event.sender);

    let settingsName = "";
    if (role === "kitchen") {
      settingsName = settingsPrinters.kitchen;
    } else if (role === "counter") {
      settingsName = settingsPrinters.counter;
    } else if (role === "cashReport") {
      settingsName = settingsPrinters.cashReport;
    }

    let deviceName;
    if (systemPrinters && systemPrinters.length > 0 && settingsName) {
      const match = findBestPrinterMatch(systemPrinters, settingsName);
      deviceName = match ? match.name : undefined;
    }

    const text = `TESTE DE IMPRESSAO - ${
      role || "PADRAO"
    }\n${new Date().toLocaleString("pt-BR")}`;

    const success = await printTextTicket(text, {
      silent: false,
      deviceName,
    });

    return { success };
  } catch (err) {
    console.error("Erro em print:test:", err);
    return { success: false, error: String(err) };
  }
});

// -------------------------------------
// IPC: Sincronização manual (pull)
// -------------------------------------
ipcMain.handle("sync:pull", async () => {
  if (!sync.hasSyncBaseUrl()) {
    return { success: false, error: "SYNC_BASE_URL não configurado." };
  }

  try {
    const result = await sync.runSyncCycle();
    return { success: true, ...result };
  } catch (err) {
    console.error("[sync] Erro no pull manual:", err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle("sync:status", async () => {
  return sync.getSyncStatus();
});

ipcMain.handle("sync:notifications:get", async () => {
  if (typeof sync.getNotificationSettings === "function") {
    return sync.getNotificationSettings();
  }
  return { enabled: sync.getNotificationStatus() };
});

ipcMain.handle("sync:notifications:set", async (_event, payload) => {
  if (
    payload &&
    typeof payload === "object" &&
    typeof sync.setNotificationSettings === "function"
  ) {
    return sync.setNotificationSettings(payload);
  }
  const updated = sync.setNotificationStatus(Boolean(payload));
  await sync.saveSyncSettings();
  return { enabled: updated };
});

// -------------------------------------
// IPC: Exportar relatório de caixa em PDF
// -------------------------------------
ipcMain.handle("cash:export-report-pdf", async (_event, reportPayload) => {
  try {
    const html = buildCashReportHtml(reportPayload);

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });

    await win.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(html)
    );

    const pdfBuffer = await win.webContents.printToPDF({
      marginsType: 1,
      printBackground: true,
      pageSize: "A4",
    });

    win.close();

    const outDir = db.getDataDir();
    const filename = `cash-report-${Date.now()}.pdf`;
    const filePath = path.join(outDir, filename);

    fs.writeFileSync(filePath, pdfBuffer);

    return { success: true, path: filePath };
  } catch (err) {
    console.error("Erro em cash:export-report-pdf:", err);
    return { success: false, error: String(err) };
  }
});

// -------------------------------------
// Lifecycle do app
// -------------------------------------
app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.axion.pdv");
  }
  createMainWindow();
  void sync.loadSyncSettings();
  sync.startSyncPull();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  sync.stopSyncPull();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
