// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// ---------------------------
// DataEngine - acesso ao "Data Layer" em JSON
// ---------------------------
contextBridge.exposeInMainWorld('dataEngine', {
  get: (collection) => ipcRenderer.invoke('data:get', collection),
  set: (collection, data) => ipcRenderer.invoke('data:set', collection, data),
  addItem: (collection, item) =>
    ipcRenderer.invoke('data:addItem', collection, item),
  updateItem: (collection, id, changes) =>
    ipcRenderer.invoke('data:updateItem', collection, id, changes),
  removeItem: (collection, id) =>
    ipcRenderer.invoke('data:removeItem', collection, id),
  reset: (collection) => ipcRenderer.invoke('data:reset', collection),
  listCollections: () => ipcRenderer.invoke('data:listCollections'),
  getDataDir: () => ipcRenderer.invoke('data:getDataDir'),

  // Novo: exportar fechamento de caixa em PDF
  exportCashReportPdf: (reportPayload) =>
    ipcRenderer.invoke('cash:export-report-pdf', reportPayload)
});

// ---------------------------
// Info do app (versão, etc.)
// ---------------------------
contextBridge.exposeInMainWorld('appInfo', {
  getInfo: () => ipcRenderer.invoke('app:getInfo')
});

// ---------------------------
// Impressão de pedidos / tickets
// ---------------------------
// Usado pelo frontend:
//   window.ticketPrinter.printTickets({ orderId, kitchenText, counterText, trackingUrl, silent })
//   window.ticketPrinter.printOrder(order, { silent })
// E também via window.electronAPI.* (alias de compat)

contextBridge.exposeInMainWorld('ticketPrinter', {
  printTickets: (payload) => ipcRenderer.invoke('print:tickets', payload),
  printOrder: (order, options) =>
    ipcRenderer.invoke('print:order', { order, options })
});

contextBridge.exposeInMainWorld('electronAPI', {
  printTickets: (payload) => ipcRenderer.invoke('print:tickets', payload),
  printOrder: (order, options) =>
    ipcRenderer.invoke('print:order', { order, options })
});

// ---------------------------
// Config / utilitários de impressoras
// ---------------------------
// Aqui usamos os nomes configurados em Settings (ex: settings.printers.kitchen)
// e damos funções de apoio para listar e testar impressoras.
contextBridge.exposeInMainWorld('printerConfig', {
  listPrinters: () => ipcRenderer.invoke('print:list-printers'),
  testPrinter: (role) => ipcRenderer.invoke('print:test', { role })
  // role pode ser "kitchen", "counter", "cashReport", etc.
});
