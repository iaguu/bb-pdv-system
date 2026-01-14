// src/tests/setup.js
// Setup básico para testes

// Mock do localStorage
const localStorageMock = {
  data: new Map(),
  getItem: jest.fn((key) => {
    return localStorageMock.data.get(key) || null;
  }),
  setItem: jest.fn((key, value) => {
    localStorageMock.data.set(key, value);
  }),
  removeItem: jest.fn((key) => {
    localStorageMock.data.delete(key);
  }),
  clear: jest.fn(() => {
    localStorageMock.data.clear();
  })
};

// Mock do window.localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock do window.dataEngine
Object.defineProperty(window, 'dataEngine', {
  value: {
    addItem: jest.fn(),
    updateItem: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  },
  writable: true
});

// Mock do window.performance
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  },
  writable: true
});

// Mock do window.crypto
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      importKey: jest.fn(),
      deriveKey: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn()
    }
  },
  writable: true
});

// Mock do navigator
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true
});

Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Test Environment)',
  writable: true
});

// Setup global test utilities
global.testUtils = {
  clearMocks: () => {
    jest.clearAllMocks();
    localStorageMock.data.clear();
  },
  
  createMockDraft: (overrides = {}) => ({
    id: 'draft_test_123',
    customerSnapshot: { name: 'Test Client' },
    items: [{ productName: 'Test Product', quantity: 1, price: 10.00 }],
    totals: { finalTotal: 10.00 },
    status: 'draft',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides
  }),
  
  createMockEvent: (type, data = {}) => ({
    type,
    data,
    timestamp: Date.now(),
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  })
};

// Limpeza após cada teste
afterEach(() => {
  global.testUtils.clearMocks();
});
