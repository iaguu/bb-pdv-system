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
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
});

// ---------------------------
// Impressão de pedidos / tickets
// ---------------------------
// Usado pelo frontend:
//   window.ticketPrinter.printTickets({ orderId, kitchenText, counterText, trackingUrl, silent, async })
//   window.ticketPrinter.printOrder(order, { silent, async })
// E também via window.electronAPI.* (alias de compat)

contextBridge.exposeInMainWorld('ticketPrinter', {
  printTickets: (payload) => ipcRenderer.invoke('print:tickets', payload),
  printOrder: (order, options) =>
    ipcRenderer.invoke('print:order', { order, options })
});

contextBridge.exposeInMainWorld('electronAPI', {
  printTickets: (payload) => ipcRenderer.invoke('print:tickets', payload),
  printOrder: (order, options) =>
    ipcRenderer.invoke('print:order', { order, options }),
  syncNow: () => ipcRenderer.invoke('sync:pull'),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  getPublicApiConfig: () => ipcRenderer.invoke('app:getPublicApiConfig'),
  getNotificationsEnabled: () => ipcRenderer.invoke('sync:notifications:get'),
  setNotificationsEnabled: (enabled) =>
    ipcRenderer.invoke('sync:notifications:set', enabled),
  getNotificationsSettings: () => ipcRenderer.invoke('sync:notifications:get'),
  setNotificationsSettings: (settings) =>
    ipcRenderer.invoke('sync:notifications:set', settings)
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


contextBridge.exposeInMainWorld('orderEvents', {
  onNewOrder: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, order) => handler(order);
    ipcRenderer.on('orders:new', listener);
    return () => {
      ipcRenderer.removeListener('orders:new', listener);
    };
  },
  onOrderUpdated: (handler) => {
    if (typeof handler !== 'function') {
      return () => {};
    }
    const listener = (_event, order) => handler(order);
    ipcRenderer.on('orders:updated', listener);
    return () => {
      ipcRenderer.removeListener('orders:updated', listener);
    };
  },
});


// ---------------------------
// Entrega: cálculo automático de distância (Google Distance Matrix via main)
// ---------------------------
contextBridge.exposeInMainWorld('deliveryApi', {
  /**
   * Calcula a distância em km entre dois endereços.
   * origin e destination devem ser strings completas (rua, número, bairro, cidade/UF).
   */
  calculateDistanceKm: (origin, destination) =>
    ipcRenderer.invoke('delivery:calculateDistanceKm', { origin, destination })
});
