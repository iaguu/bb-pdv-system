// electron/main.js
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Módulo de acesso ao "banco" em JSON
// Esperado: ./db.js exporta as funções abaixo:
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
    const settings = await db.getCollection('settings');
    const printers = settings?.printers || {};
    return {
      kitchen: printers.kitchen || printers.cozinha || '',
      counter: printers.counter || printers.balcao || '',
      cashReport: printers.cashReport || printers.reports || ''
    };
  } catch (err) {
    console.warn('Não foi possível carregar settings.printers:', err);
    return {
      kitchen: '',
      counter: '',
      cashReport: ''
    };
  }
}

// -------------------------------------
// Função utilitária para imprimir texto
// -------------------------------------
// Cria uma janela oculta, carrega um HTML com <pre>texto</pre>
// e envia para impressora (padrão ou deviceName configurado).
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
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 12px;
            padding: 8px 10px;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <pre>${text}</pre>
      </body>
    </html>
  `;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent,
        printBackground: false,
        // Se deviceName for vazio/undefined, usa impressora padrão
        deviceName: deviceName || undefined
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

// -------------------------------------
// Helpers para relatório de caixa em HTML / PDF
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
// payload esperado: ver buildCashReportPayload no frontend (FinancePage)
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
// IPC: Impressão de pedidos
// -------------------------------------
// payload esperado em print:tickets:
//  {
//    orderId,
//    kitchenText,
//    counterText,
//    trackingUrl,
//    silent
//  }
ipcMain.handle('print:tickets', async (_event, payload) => {
  const { kitchenText, counterText, silent } = payload || {};

  if (!kitchenText && !counterText) {
    console.warn('print:tickets chamado sem textos de ticket.');
    return false;
  }

  try {
    const printers = await getPrinterSettingsSafe();

    if (kitchenText) {
      await printTextTicket(kitchenText, {
        silent: silent ?? true,
        deviceName: printers.kitchen || undefined
      });
    }
    if (counterText) {
      await printTextTicket(counterText, {
        silent: silent ?? true,
        deviceName: printers.counter || undefined
      });
    }
    return true;
  } catch (err) {
    console.error('Erro em print:tickets:', err);
    return false;
  }
});

// compat com chamadas antigas: print:order
ipcMain.handle('print:order', async (_event, { order, options } = {}) => {
  // se você quiser reaproveitar sua lógica antiga, pode implementar aqui
  // por enquanto, só loga o pedido (para não quebrar)
  console.log('print:order (compat) chamado para pedido:', order?.id);
  // poderia montar um texto simples e chamar printTextTicket(orderText, options)
  return true;
});

// -------------------------------------
// IPC: Lista de impressoras e teste
// -------------------------------------
ipcMain.handle('print:list-printers', async () => {
  // Usa a mainWindow se existir; se não, cria uma janela temporária
  let win = BrowserWindow.getAllWindows()[0] || mainWindow;
  let tempCreated = false;

  if (!win) {
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false
      }
    });
    tempCreated = true;
  }

  const printers = win.webContents.getPrinters();

  if (tempCreated) {
    win.close();
  }

  return printers;
});

ipcMain.handle('print:test', async (_event, { role } = {}) => {
  try {
    const printers = await getPrinterSettingsSafe();
    let deviceName = '';

    if (role === 'kitchen') {
      deviceName = printers.kitchen;
    } else if (role === 'counter') {
      deviceName = printers.counter;
    } else if (role === 'cashReport') {
      deviceName = printers.cashReport;
    }

    const text = `Teste de impressão - ${
      role || 'padrão'
    }\n${new Date().toLocaleString('pt-BR')}`;

    const success = await printTextTicket(text, {
      silent: false, // teste -> exibe diálogo se necessário
      deviceName: deviceName || undefined
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
