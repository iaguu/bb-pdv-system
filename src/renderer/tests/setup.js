// src/renderer/tests/setup.js
// Configuração do ambiente de testes

import '@testing-library/jest-dom';

// Polyfills para Node.js
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock do window.dataEngine
global.dataEngine = {
  get: jest.fn(),
  set: jest.fn(),
  addItem: jest.fn(),
  updateItem: jest.fn(),
  removeItem: jest.fn()
};

// Mock do window.electronAPI
global.electronAPI = {
  printOrder: jest.fn(),
  showMessageBox: jest.fn(),
  openExternal: jest.fn()
};

// Mock do window.printEngine
global.printEngine = {
  printOrder: jest.fn()
};

// Mock do window.orderEvents
global.orderEvents = {
  onNewOrder: jest.fn(),
  onOrderUpdated: jest.fn()
};

// Mock do localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock do Notification
global.Notification = {
  requestPermission: jest.fn(() => Promise.resolve('granted')),
  permission: 'granted'
};

// Mock do window.confirm
global.confirm = jest.fn(() => true);

// Limpar mocks antes de cada teste
beforeEach(() => {
  jest.clearAllMocks();
});
