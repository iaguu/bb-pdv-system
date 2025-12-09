// electron/main.js
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Módulo de acesso ao "banco" em JSON
// Esperado: ./db.js exporta as funções abaixo
const db = require('./db'); // adapte o path se estiver em outro lugar

const isDev = !app.isPackaged;
let mainWindow;

// -------------------------------------
// Criação da janela principal
// -------------------------------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f5f7fb',
    title: 'Pizzaria - Gestor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    // Vite / React em dev
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // build produzido pelo Vite
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Abre links externos no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// -------------------------------------
// Helpers genéricos
// -------------------------------------
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrencyBR(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// -------------------------------------
// IPC: DataEngine
// -------------------------------------
ipcMain.handle('data:get', async (_event, collection) => {
  return db.getCollection(collection);
});

ipcMain.handle('data:set', async (_event, collection, data) => {
  await db.setCollection(collection, data);
  return true;
});

ipcMain.handle('data:addItem', async (_event, collection, item) => {
  return db.addItem(collection, item);
});

ipcMain.handle('data:updateItem', async (_event, collection, id, changes) => {
  return db.updateItem(collection, id, changes);
});

ipcMain.handle('data:removeItem', async (_event, collection, id) => {
  await db.removeItem(collection, id);
  return true;
});

ipcMain.handle('data:reset', async (_event, collection) => {
  await db.resetCollection(collection);
  return true;
});

ipcMain.handle('data:listCollections', async () => {
  return db.listCollections();
});

ipcMain.handle('data:getDataDir', async () => {
  return db.getDataDir();
});

// -------------------------------------
// IPC: Info do app
// -------------------------------------
ipcMain.handle('app:getInfo', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    env: isDev ? 'development' : 'production',
    dataDir: db.getDataDir()
  };
});

// -------------------------------------
// Helpers de impressora / settings
// -------------------------------------
async function getPrinterSettingsSafe() {
  try {
    const raw = await db.getCollection('settings');

    let root;
    if (Array.isArray(raw?.items) && raw.items.length > 0) {
      root = raw.items[0];
    } else if (Array.isArray(raw) && raw.length > 0) {
      root = raw[0];
    } else if (raw && typeof raw === 'object') {
      root = raw;
    } else {
      root = {};
    }

    const printing = root.printing || {};
    const printersLegacy = root.printers || {};

    // Preferimos os nomes salvos em `printing.*` (nova tela),
    // mas mantemos compat com `printers.*` antigo.
    return {
      kitchen:
        printing.kitchenPrinterName ||
        printersLegacy.kitchen ||
        printersLegacy.cozinha ||
        '',
      counter:
        printing.counterPrinterName ||
        printersLegacy.counter ||
        printersLegacy.balcao ||
        '',
      cashReport: printersLegacy.cashReport || printersLegacy.reports || ''
    };
  } catch (err) {
    console.warn('Não foi possível carregar settings/printers:', err);
    return {
      kitchen: '',
      counter: '',
      cashReport: ''
    };
  }
}

// Normalização de nomes de impressora para mapeamento flexível
function normalizePrinterName(name) {
  return (name || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/driver\s*-\s*/g, '') // remove "Driver -"
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestPrinterMatch(printers, requestedName) {
  if (!requestedName) return null;

  const target = normalizePrinterName(requestedName);
  if (!target) return null;

  // 1) Match exato
  let found = printers.find(
    (p) => normalizePrinterName(p.name) === target
  );
  if (found) return found;

  // 2) requested contido no nome cadastrado
  found = printers.find((p) =>
    normalizePrinterName(p.name).includes(target)
  );
  if (found) return found;

  // 3) nome cadastrado contido no requested
  found = printers.find((p) =>
    target.includes(normalizePrinterName(p.name))
  );
  if (found) return found;

  return null;
}

// Lista segura de impressoras (Electron 33+)
async function getSystemPrintersSafe(webContents) {
  if (!webContents) {
    console.warn('[printers] webContents não definido ao tentar listar impressoras.');
    return [];
  }

  try {
    if (typeof webContents.getPrintersAsync === 'function') {
      const printers = await webContents.getPrintersAsync();
      console.log('[printers] getPrintersAsync ->', printers);
      return printers || [];
    }

    if (typeof webContents.getPrinters === 'function') {
      const printers = webContents.getPrinters();
      console.log('[printers] getPrinters (sync) ->', printers);
      return printers || [];
    }

    console.warn(
      '[printers] webContents sem getPrinters / getPrintersAsync. Verifique versão do Electron.'
    );
    return [];
  } catch (err) {
    console.error('[printers] erro ao obter lista de impressoras:', err);
    return [];
  }
}

// Resolve o deviceName a partir de role + settings + lista do sistema
function resolveDeviceNameFromRole(role, {
  target,
  requestedPrinterName,
  kitchenPrinterName,
  counterPrinterName,
  settingsPrinters,
  systemPrinters
}) {
  let requested = null;
  let settingsName = '';

  if (role === 'kitchen') {
    if (target === 'kitchen') {
      requested = requestedPrinterName || kitchenPrinterName || null;
    } else {
      requested = kitchenPrinterName || null;
    }
    settingsName = settingsPrinters.kitchen;
  } else if (role === 'counter') {
    if (target === 'counter') {
      requested = requestedPrinterName || counterPrinterName || null;
    } else {
      requested = counterPrinterName || null;
    }
    settingsName = settingsPrinters.counter;
  } else if (role === 'cashReport') {
    settingsName = settingsPrinters.cashReport;
  }

  const chosen = requested || settingsName;
  if (!chosen) {
    console.log('[print] nenhum nome configurado para role:', role);
    return undefined; // usa padrão do sistema
  }

  if (!systemPrinters || systemPrinters.length === 0) {
    console.log(
      '[print] sem lista de impressoras; usando padrão do sistema.'
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
// Função utilitária para imprimir texto (PDV)
// -------------------------------------
async function printTextTicket(text, { silent = true, deviceName } = {}) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false
    }
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
            width: 260px; /* largura aproximada de bobina 58/80mm */
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

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent,
        printBackground: false,
        deviceName: deviceName || undefined // undefined => usa padrão do sistema
      },
      (success, failureReason) => {
        if (!success) {
          console.error('Falha ao imprimir ticket:', failureReason);
        }
        win.close();
        resolve(success);
      }
    );
  });
}


async function printHtmlTicket(innerHtml, { silent = true, deviceName } = {}) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false
    }
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
            background: #ffffff;
          }
          .ticket {
            width: 100%;
          }
          .ticket-header {
            text-align: left;
            margin-bottom: 6px;
          }
          .ticket-title {
            font-size: 16px;
            font-weight: 700;
          }
          .ticket-subtitle {
            font-size: 13px;
            font-weight: 600;
            margin-top: 2px;
          }
          .ticket-meta {
            font-size: 11px;
            color: #374151;
            margin-top: 1px;
          }
          .ticket-divider {
            border-top: 1px dashed #9ca3af;
            margin: 6px 0;
          }
          .ticket-section-title {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 4px;
          }
          .tk-item {
            margin-bottom: 4px;
          }
          .tk-item-title {
            font-size: 13px;
            font-weight: 600;
          }
          .tk-qty {
            font-weight: 700;
            margin-right: 4px;
          }
          .tk-size {
            font-weight: 600;
            margin-right: 2px;
          }
          .tk-flavors {
            font-weight: 600;
          }
          .tk-item-note {
            font-size: 11px;
            margin-top: 2px;
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
            background: #fee2e2; /* fundo vermelho claro */
            color: #b91c1c;      /* texto vermelho forte */
            border-radius: 3px;
            font-weight: 700;
          }
          .tk-badge-obs {
            background: #b91c1c; /* vermelho forte */
            color: #ffffff;
            border-radius: 3px;
            font-weight: 700;
          }
          .tk-note-extra {
            color: #b91c1c;      /* texto vermelho para adicionais */
            font-weight: 600;
          }
          .tk-note-obs {
            color: #b91c1c;      /* texto vermelho para observações */
            font-weight: 700;
          }
          .ticket-footer {
            margin-top: 8px;
            font-size: 10px;
            text-align: center;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        ${innerHtml}
      </body>
    </html>
  `;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent,
        printBackground: true,
        deviceName: deviceName || undefined
      },
      (success, failureReason) => {
        if (!success) {
          console.error('Falha ao imprimir ticket HTML:', failureReason);
        }
        win.close();
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
    sessions = []
  } = payload || {};

  const generatedDate = generatedAt
    ? new Date(generatedAt)
    : new Date();

  const statusLabel = {
    all: 'Todas',
    open: 'Abertas',
    closed: 'Fechadas'
  }[statusFilter || 'all'] || 'Todas';

  const headerInfo = `
    Período: ${escapeHtml(periodLabel || 'não informado')}<br/>
    Status: ${escapeHtml(statusLabel)}<br/>
    Gerado em: ${escapeHtml(
      generatedDate.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    )}
  `;

  const sessionsRows = sessions
    .map((s) => {
      const opened = s.openedAt ? new Date(s.openedAt) : null;
      const closed = s.closedAt ? new Date(s.closedAt) : null;

      const openedStr = opened
        ? opened.toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          })
        : '-';

      const closedStr = closed
        ? closed.toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          })
        : '-';

      return `
        <tr>
          <td>${escapeHtml(s.id || '')}</td>
          <td>${escapeHtml(openedStr)}</td>
          <td>${escapeHtml(closedStr)}</td>
          <td>${escapeHtml(s.status === 'closed' ? 'Fechada' : 'Aberta')}</td>
          <td>${escapeHtml(s.operator || '-')}</td>
          <td style="text-align:right;">${formatCurrencyBR(s.opening)}</td>
          <td style="text-align:right;">${formatCurrencyBR(s.closing)}</td>
          <td style="text-align:right;">${formatCurrencyBR(s.sales)}</td>
          <td style="text-align:right;">${formatCurrencyBR(s.difference)}</td>
        </tr>
      `;
    })
    .join('');

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
            <div class="summary-value">${formatCurrencyBR(stats.totalSales)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">Diferença acumulada</div>
            <div class="summary-value">${formatCurrencyBR(stats.totalDifference)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">Média por sessão fechada</div>
            <div class="summary-value">${formatCurrencyBR(stats.avgPerSession)}</div>
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
            ${sessionsRows || ''}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

// -------------------------------------
// IPC: Relatório de caixa em PDF
// -------------------------------------
ipcMain.handle('cash:export-report-pdf', async (_event, payload) => {
  try {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false
      }
    });

    const html = buildCashReportHtml(payload);
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    const pdfBuffer = await win.webContents.printToPDF({
      marginsType: 1,
      printBackground: true,
      pageSize: 'A4'
    });

    const baseDir = db.getDataDir();
    const reportsDir = path.join(baseDir, 'reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const periodLabel = (payload && payload.periodLabel) || 'periodo';
    const safeLabel = String(periodLabel).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `fechamento_caixa_${safeLabel}_${Date.now()}.pdf`;

    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    win.close();

    return { success: true, path: filePath };
  } catch (err) {
    console.error('Erro ao gerar relatório de caixa em PDF:', err);
    return { success: false, error: String(err) };
  }
});

// -------------------------------------
// Mapas / labels para pedidos (PDV)
// -------------------------------------
const PAYMENT_METHOD_LABELS = {
  '': 'A definir',
  money: 'Dinheiro',
  dinheiro: 'Dinheiro',
  cash: 'Dinheiro',
  pix: 'Pix',
  card: 'Cartão',
  cartao: 'Cartão (maquininha)',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  vr: 'Vale refeição'
};

const ORDER_TYPE_LABELS = {
  delivery: 'Entrega',
  pickup: 'Retirada na loja',
  counter: 'Balcão / retirada'
};

const SOURCE_LABELS = {
  website: 'Site',
  web: 'Site',
  whatsapp: 'WhatsApp',
  ifood: 'iFood',
  phone: 'Telefone',
  local: 'Balcão / Local',
  balcão: 'Balcão / Local',
  counter: 'Balcão / Local',
  desktop: 'Sistema'
};

function normalizeStatus(status) {
  if (!status) return 'open';
  const s = status.toString().toLowerCase();
  if (s === 'finalizado' || s === 'done') return 'done';
  if (s === 'cancelado' || s === 'cancelled') return 'cancelled';
  if (s === 'preparing' || s === 'em_preparo' || s === 'preparo') {
    return 'preparing';
  }
  if (s === 'out_for_delivery' || s === 'delivery' || s === 'em_entrega') {
    return 'out_for_delivery';
  }
  if (s === 'open' || s === 'em_aberto') return 'open';
  return s;
}

// -------------------------------------
// Builders de ticket PDV (cozinha / balcão)
// -------------------------------------

function buildKitchenTicket(order) {
  if (!order) {
    return '<div class="ticket"><div class="ticket-header"><div class="ticket-title">Pedido não informado</div></div></div>';
  }

  const id = order.id || order.code || order.numeroPedido || '';
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();

  const rawOrderType =
    order.type || order.delivery?.mode || order.orderType || 'delivery';
  const orderTypeKey = rawOrderType.toString().toLowerCase();
  const orderTypeLabel = ORDER_TYPE_LABELS[orderTypeKey] || ORDER_TYPE_LABELS.delivery;

  const rawSource = (order.source || 'local').toString().toLowerCase();
  const sourceLabel = SOURCE_LABELS[rawSource] || SOURCE_LABELS.local;

  const customer =
    order.customerSnapshot ||
    order.customer ||
    {};

  const customerName =
    customer.name ||
    order.customerName ||
    'Cliente';

  const customerPhone =
    customer.phone ||
    order.customerPhone ||
    '';

  const customerMode = order.customerMode || 'registered';
  const counterLabel =
    customerMode === 'counter'
      ? order.counterLabel || order.customerName || 'Balcão'
      : null;

  const addressObj =
    order.delivery?.address ||
    customer.address ||
    order.customerAddress ||
    order.address ||
    null;

  let addressText = '';
  if (typeof addressObj === 'string') {
    addressText = addressObj;
  } else if (addressObj && typeof addressObj === 'object') {
    const street = addressObj.street || addressObj.logradouro || '';
    const number = addressObj.number || addressObj.numero || '';
    const neighborhood = addressObj.neighborhood || addressObj.bairro || '';
    const city = addressObj.city || addressObj.cidade || '';
    const state = addressObj.state || addressObj.uf || '';
    const main = [
      street && (street + (number ? ', ' + number : '')),
      neighborhood,
      city && (state ? city + ' / ' + state : city)
    ].filter(Boolean).join(' • ');
    const cep = addressObj.cep || addressObj.CEP || '';
    const complement = addressObj.complement || addressObj.complemento || '';
    const extras = [
      complement && ('Compl.: ' + complement),
      cep && ('CEP: ' + cep)
    ].filter(Boolean).join(' • ');
    addressText = [main, extras].filter(Boolean).join(' • ');
  }

  const items = Array.isArray(order.items) ? order.items : [];

  const orderNotes = order.orderNotes || '';
  const kitchenNotes = order.kitchenNotes || '';

  const parts = [];

  parts.push('<div class="ticket ticket-kitchen">');
  parts.push('  <div class="ticket-header">');
  parts.push('    <div class="ticket-title">ANNE &amp; TOM</div>');
  parts.push('    <div class="ticket-subtitle">COMANDA COZINHA</div>');
  parts.push('    <div class="ticket-meta">Pedido #' + escapeHtml(id) + ' • ' + escapeHtml(orderTypeLabel) + '</div>');
  parts.push('    <div class="ticket-meta">' + escapeHtml(createdAt.toLocaleString('pt-BR')) + ' • Origem: ' + escapeHtml(sourceLabel) + '</div>');

  if (customerMode === 'counter' && counterLabel) {
    parts.push('    <div class="ticket-meta">Atendimento: ' + escapeHtml(counterLabel) + '</div>');
  } else {
    parts.push('    <div class="ticket-meta">Cliente: ' + escapeHtml(customerName) + '</div>');
    if (customerPhone) {
      parts.push('    <div class="ticket-meta">Fone: ' + escapeHtml(customerPhone) + '</div>');
    }
  }

  if (addressText) {
    parts.push('    <div class="ticket-meta">Endereço: ' + escapeHtml(addressText) + '</div>');
  }

  parts.push('  </div>');
  parts.push('  <div class="ticket-divider"></div>');

  parts.push('  <div class="ticket-section">');
  parts.push('    <div class="ticket-section-title">ITENS</div>');

  if (!items.length) {
    parts.push('    <div class="tk-item">Nenhum item cadastrado.</div>');
  } else {
    items.forEach((item) => {
      const qty = item.quantity || item.qty || 1;
      const sizeLabel = (item.sizeLabel || item.size || '').toString();

      const flavor1Name =
        item.name ||
        item.flavor1Name ||
        'Item';

      const flavor2Name =
        item.halfDescription ||
        item.flavor2Name ||
        '';

      const flavor3Name =
        item.flavor3Name ||
        item.flavor3Label ||
        '';

      const flavors = [flavor1Name, flavor2Name, flavor3Name].filter(Boolean);

      parts.push('    <div class="tk-item">');
      parts.push('      <div class="tk-item-title">');
      parts.push('        <span class="tk-qty">' + qty + 'x</span>');
      if (sizeLabel) {
        parts.push('        <span class="tk-size">' + escapeHtml(sizeLabel) + '</span>');
      }
      parts.push('        <span class="tk-flavors">' + escapeHtml(flavors.join(' / ')) + '</span>');
      parts.push('      </div>');

      if (Array.isArray(item.extras) && item.extras.length > 0) {
        const extrasNames = item.extras
          .map((ex) => ex && ex.name)
          .filter(Boolean)
          .join(', ');
        if (extrasNames) {
          parts.push('      <div class="tk-item-note tk-note-extra">');
          parts.push('        <span class="tk-badge tk-badge-extra">ADICIONAIS</span>');
          parts.push('        ' + escapeHtml(extrasNames));
          parts.push('      </div>');
        }
      }

      if (item.kitchenNotes || item.obs || item.observacao) {
        const noteText =
          item.kitchenNotes ||
          item.obs ||
          item.observacao;
        parts.push('      <div class="tk-item-note tk-note-obs">');
        parts.push('        <span class="tk-badge tk-badge-obs">OBS</span>');
        parts.push('        ' + escapeHtml(noteText));
        parts.push('      </div>');
      }

      parts.push('    </div>');
    });
  }

  parts.push('  </div>');

  if (kitchenNotes || orderNotes) {
    parts.push('  <div class="ticket-divider"></div>');
    parts.push('  <div class="ticket-section">');
    if (kitchenNotes) {
      parts.push('    <div class="ticket-section-title">OBSERVAÇÕES COZINHA</div>');
      parts.push('    <div class="tk-item-note tk-note-obs"><span class="tk-badge tk-badge-obs">OBS</span> ' + escapeHtml(kitchenNotes) + '</div>');
    }
    if (orderNotes) {
      parts.push('    <div class="ticket-section-title">OBSERVAÇÕES DO PEDIDO</div>');
      parts.push('    <div class="tk-item-note tk-note-extra"><span class="tk-badge tk-badge-extra">OBS</span> ' + escapeHtml(orderNotes) + '</div>');
    }
    parts.push('  </div>');
  }

  parts.push('  <div class="ticket-footer">');
  parts.push('    Impresso pelo sistema Anne &amp; Tom');
  parts.push('  </div>');

  parts.push('</div>');

  return parts.join('');
}
function buildCounterTicket(order) {
  if (!order) return 'Pedido não informado.';

  const id = order.id || order.code || order.numeroPedido || '';
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();

  const rawOrderType =
    order.type || order.delivery?.mode || order.orderType || 'delivery';
  const orderTypeKey = rawOrderType.toString().toLowerCase();
  const orderTypeLabel = ORDER_TYPE_LABELS[orderTypeKey] || ORDER_TYPE_LABELS.delivery;

  const rawPaymentMethod =
    order.payment?.method || order.paymentMethod || '';
  const paymentMethodKey = rawPaymentMethod.toString().toLowerCase();
  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[paymentMethodKey] || PAYMENT_METHOD_LABELS[''];

  const rawSource = (order.source || 'local').toString().toLowerCase();
  const sourceLabel = SOURCE_LABELS[rawSource] || SOURCE_LABELS.local;

  const customer =
    order.customerSnapshot ||
    order.customer ||
    {};

  const customerName =
    customer.name ||
    order.customerName ||
    'Cliente';

  const customerPhone =
    customer.phone ||
    order.customerPhone ||
    '';

  const customerMode = order.customerMode || 'registered';
  const counterLabel =
    customerMode === 'counter'
      ? order.counterLabel || order.customerName || 'Balcão'
      : null;

  const subtotal = Number(
    order.totals?.subtotal ?? order.subtotal ?? 0
  );

  const deliveryFee = Number(
    order.delivery?.fee ??
      order.totals?.deliveryFee ??
      order.deliveryFee ??
      0
  );

  const discountAmount = Number(
    order.totals?.discount ??
      (typeof order.discount === 'object'
        ? order.discount.amount
        : order.discount) ??
      0
  );

  const total = Number(
    order.totals?.finalTotal ??
      order.total ??
      subtotal + deliveryFee - discountAmount
  );

  const items = Array.isArray(order.items) ? order.items : [];

  const trackingUrl =
    order.trackingUrl ||
    order.delivery?.trackingUrl ||
    order.delivery?.tracking_url ||
    '';

  const lines = [];

  lines.push('ANNE & TOM PIZZARIA');
  lines.push('CUPOM NÃO FISCAL');
  lines.push('--------------------------------');
  lines.push('PEDIDO #' + id);
  lines.push(createdAt.toLocaleString('pt-BR'));
  lines.push('ORIGEM: ' + sourceLabel);
  lines.push('TIPO: ' + orderTypeLabel);
  lines.push('--------------------------------');

  if (customerMode === 'counter' && counterLabel) {
    lines.push('ATEND.: ' + counterLabel);
  } else {
    lines.push('CLIENTE: ' + customerName);
    if (customerPhone) lines.push('FONE: ' + customerPhone);
  }

  lines.push('--------------------------------');
  lines.push('ITENS');

  if (!items.length) {
    lines.push('Nenhum item cadastrado.');
  } else {
    items.forEach((item) => {
      const qty = item.quantity || item.qty || 1;
      const sizeLabel = (item.sizeLabel || item.size || '').toString();
      const flavor1Name =
        item.name ||
        item.flavor1Name ||
        'Item';

      const flavor2Name =
        item.halfDescription ||
        item.flavor2Name ||
        '';

      const flavor3Name =
        item.flavor3Name ||
        item.flavor3Label ||
        '';

      const flavors = [flavor1Name, flavor2Name, flavor3Name].filter(Boolean);

      const unitPrice = Number(item.unitPrice || item.price || 0);
      const lineTotal =
        Number(item.lineTotal || item.total || 0) ||
        unitPrice * qty;

      const nameLine = [
        qty + 'x',
        sizeLabel,
        flavors.join(' / ')
      ]
        .filter(Boolean)
        .join(' ');

      lines.push(nameLine);
      lines.push('  R$ un: ' + formatCurrencyBR(unitPrice));
      lines.push('  R$ ln: ' + formatCurrencyBR(lineTotal));

      if (Array.isArray(item.extras) && item.extras.length > 0) {
        const extrasNames = item.extras
          .map((ex) => ex.name)
          .filter(Boolean)
          .join(', ');
        if (extrasNames) {
          lines.push('  + ADIC.: ' + extrasNames);
        }
      }
    });;
  }

  lines.push('--------------------------------');
  lines.push('SUBTOTAL : ' + formatCurrencyBR(subtotal));
  lines.push('ENTREGA  : ' + formatCurrencyBR(deliveryFee));
  lines.push('DESCONTO : -' + formatCurrencyBR(discountAmount));
  lines.push('TOTAL    : ' + formatCurrencyBR(total));
  lines.push('--------------------------------');
  lines.push('PAGAMENTO: ' + paymentMethodLabel);

  if (order.orderNotes) {
    lines.push('OBS.:');
    String(order.orderNotes)
      .split(/\r?\n/)
      .forEach((ln) => lines.push('  ' + ln));
  }

  if (trackingUrl) {
    lines.push('--------------------------------');
    lines.push('ENTREGA / QR:');
    lines.push(trackingUrl);
  }

  lines.push('--------------------------------');
  lines.push('Obrigado pela preferência!');
  lines.push('Sistema Anne & Tom');

  return lines.join('\n');
}

// -------------------------------------
// IPC: Impressão de pedidos / tickets
// -------------------------------------
ipcMain.handle('print:tickets', async (event, payload) => {
  const {
    kitchenText,
    counterText,
    silent,
    target,
    requestedPrinterName,
    kitchenPrinterName,
    counterPrinterName
  } = payload || {};

  if (!kitchenText && !counterText) {
    console.warn('print:tickets chamado sem textos de ticket.');
    return false;
  }

  try {
    const settingsPrinters = await getPrinterSettingsSafe();
    const systemPrinters = await getSystemPrintersSafe(event.sender);

    console.log('[print:tickets] payload recebido:', payload);
    console.log('[print:tickets] settingsPrinters:', settingsPrinters);
    console.log('[print:tickets] systemPrinters:', systemPrinters);

    const ctx = {
      target,
      requestedPrinterName,
      kitchenPrinterName,
      counterPrinterName,
      settingsPrinters,
      systemPrinters
    };

    const silentFlag = silent ?? true;

    if (kitchenText) {
      const deviceName = resolveDeviceNameFromRole('kitchen', ctx);
      await printHtmlTicket(kitchenText, {
        silent: silentFlag,
        deviceName
      });
    }

    if (counterText) {
      const deviceName = resolveDeviceNameFromRole('counter', ctx);
      await printTextTicket(counterText, {
        silent: silentFlag,
        deviceName
      });
    }

    return true;
  } catch (err) {
    console.error('Erro em print:tickets:', err);
    return false;
  }
});

// Handler compat com chamadas antigas: print:order
ipcMain.handle('print:order', async (event, { order, options } = {}) => {
  try {
    if (!order) {
      console.warn('print:order chamado sem order.');
      return { success: false, error: 'Pedido não informado.' };
    }

    const mode = (options && options.mode) || 'full';
    const silent = options && typeof options.silent === 'boolean'
      ? options.silent
      : true;

    const settingsPrinters = await getPrinterSettingsSafe();
    const systemPrinters = await getSystemPrintersSafe(event.sender);

    const ctx = {
      target: null,
      requestedPrinterName: null,
      kitchenPrinterName: null,
      counterPrinterName: null,
      settingsPrinters,
      systemPrinters
    };

    const kitchenHtml = buildKitchenTicket(order);
    const counterText = buildCounterTicket(order);

    if (mode === 'kitchen' || mode === 'full') {
      const deviceNameKitchen = resolveDeviceNameFromRole('kitchen', ctx);
      await printHtmlTicket(kitchenHtml, {
        silent,
        deviceName: deviceNameKitchen
      });
    }

    if (mode === 'counter' || mode === 'full') {
      const deviceNameCounter = resolveDeviceNameFromRole('counter', ctx);
      await printTextTicket(counterText, {
        silent,
        deviceName: deviceNameCounter
      });
    }

    return { success: true };
  } catch (err) {
    console.error('Erro em print:order:', err);
    return { success: false, error: String(err) };
  }
});

// -------------------------------------
// IPC: Lista de impressoras e teste rápido
// -------------------------------------
ipcMain.handle('print:list-printers', async (event) => {
  try {
    const printers = await getSystemPrintersSafe(event.sender);
    console.log('[print:list-printers] printers:', printers);
    return printers;
  } catch (e) {
    console.error('Erro em print:list-printers:', e);
    return [];
  }
});

ipcMain.handle('print:test', async (event, { role } = {}) => {
  try {
    const settingsPrinters = await getPrinterSettingsSafe();
    const systemPrinters = await getSystemPrintersSafe(event.sender);

    let settingsName = '';
    if (role === 'kitchen') {
      settingsName = settingsPrinters.kitchen;
    } else if (role === 'counter') {
      settingsName = settingsPrinters.counter;
    } else if (role === 'cashReport') {
      settingsName = settingsPrinters.cashReport;
    }

    let deviceName;
    if (systemPrinters && systemPrinters.length > 0 && settingsName) {
      const match = findBestPrinterMatch(systemPrinters, settingsName);
      deviceName = match ? match.name : undefined;
    }

    const text = `TESTE DE IMPRESSAO - ${
      role || 'PADRAO'
    }\n${new Date().toLocaleString('pt-BR')}`;

    const success = await printTextTicket(text, {
      silent: false,
      deviceName
    });

    return { success };
  } catch (err) {
    console.error('Erro em print:test:', err);
    return { success: false, error: String(err) };
  }
});

// -------------------------------------
// Ciclo de vida do app
// -------------------------------------
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // No macOS costuma-se manter o app na barra.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
