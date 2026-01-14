// src/tests/unit/orderDraftManager.test.js
// Testes unitários para o sistema local de dados

import { jest } from '@jest/globals';
import OrderDraftManager from '../../utils/orderDraftManager.js';

describe('OrderDraftManager - Sistema Local de Dados', () => {
  let draftManager;
  let mockStorage;

  beforeEach(() => {
    // Mock do localStorage
    mockStorage = {
      data: new Map(),
      getItem: jest.fn((key) => {
        return mockStorage.data.get(key) || null;
      }),
      setItem: jest.fn((key, value) => {
        mockStorage.data.set(key, value);
      }),
      removeItem: jest.fn((key) => {
        mockStorage.data.delete(key);
      }),
      clear: jest.fn(() => {
        mockStorage.data.clear();
      })
    };

    // Substitui o localStorage global
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true
    });

    draftManager = new OrderDraftManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage.data.clear();
  });

  describe('Criação de Rascunhos', () => {
    test('deve criar um rascunho com dados básicos', async () => {
      const draftData = {
        customerSnapshot: {
          name: 'João Silva',
          phone: '11999999999'
        },
        items: [
          {
            productName: 'Pizza Calabresa',
            quantity: 1,
            price: 35.90
          }
        ],
        orderType: 'delivery'
      };

      const draft = await draftManager.createDraft(draftData);

      expect(draft).toBeDefined();
      expect(draft.id).toMatch(/^draft_\d+_[a-z0-9]+$/);
      expect(draft.customerSnapshot.name).toBe('João Silva');
      expect(draft.status).toBe('draft');
      expect(draft.createdAt).toBeDefined();
      expect(draft.updatedAt).toBeDefined();
      expect(mockStorage.setItem).toHaveBeenCalled();
    });

    test('deve gerar IDs únicos para cada rascunho', async () => {
      const draft1 = await draftManager.createDraft({});
      const draft2 = await draftManager.createDraft({});

      expect(draft1.id).not.toBe(draft2.id);
    });

    test('deve validar dados obrigatórios', async () => {
      const invalidDraft = {
        items: null // items é obrigatório
      };

      await expect(draftManager.createDraft(invalidDraft))
        .rejects.toThrow('Items must be an array');
    });

    test('deve sanitizar dados de entrada', async () => {
      const maliciousData = {
        customerSnapshot: {
          name: '<script>alert("xss")</script>Cliente',
          phone: 'javascript:alert(1)11999999999'
        },
        items: [
          {
            productName: 'Pizza<script>alert("xss")</script>',
            quantity: 999999, // deve ser limitado
            price: -50 // deve ser positivo
          }
        ]
      };

      const draft = await draftManager.createDraft(maliciousData);

      expect(draft.customerSnapshot.name).not.toContain('<script>');
      expect(draft.customerSnapshot.phone).not.toContain('javascript:');
      expect(draft.items[0].productName).not.toContain('<script>');
      expect(draft.items[0].quantity).toBeLessThanOrEqual(999);
      expect(draft.items[0].price).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Recuperação de Rascunhos', () => {
    test('deve recuperar rascunho por ID', async () => {
      const createdDraft = await draftManager.createDraft({
        customerSnapshot: { name: 'Test Client' }
      });

      const retrievedDraft = await draftManager.getDraft(createdDraft.id);

      expect(retrievedDraft).toEqual(createdDraft);
    });

    test('deve retornar null para rascunho inexistente', async () => {
      const draft = await draftManager.getDraft('nonexistent_id');
      expect(draft).toBeNull();
    });

    test('deve listar todos os rascunhos', async () => {
      await draftManager.createDraft({ customerSnapshot: { name: 'Client 1' } });
      await draftManager.createDraft({ customerSnapshot: { name: 'Client 2' } });
      await draftManager.createDraft({ customerSnapshot: { name: 'Client 3' } });

      const allDrafts = await draftManager.getAllDrafts();

      expect(allDrafts).toHaveLength(3);
      expect(allDrafts.every(draft => draft.id)).toBe(true);
    });

    test('deve filtrar rascunhos por critérios', async () => {
      await draftManager.createDraft({
        customerSnapshot: { name: 'João' },
        status: 'draft'
      });
      await draftManager.createDraft({
        customerSnapshot: { name: 'Maria' },
        status: 'completed'
      });

      const draftDrafts = await draftManager.getDraftsByStatus('draft');
      const completedDrafts = await draftManager.getDraftsByStatus('completed');

      expect(draftDrafts).toHaveLength(1);
      expect(draftDrafts[0].customerSnapshot.name).toBe('João');
      expect(completedDrafts).toHaveLength(1);
      expect(completedDrafts[0].customerSnapshot.name).toBe('Maria');
    });
  });

  describe('Atualização de Rascunhos', () => {
    test('deve atualizar rascunho existente', async () => {
      const draft = await draftManager.createDraft({
        customerSnapshot: { name: 'Original Name' },
        items: [{ productName: 'Item 1', quantity: 1, price: 10 }]
      });

      const updatedDraft = await draftManager.updateDraft(draft.id, {
        customerSnapshot: { name: 'Updated Name' },
        items: [{ productName: 'Item 1', quantity: 2, price: 10 }]
      });

      expect(updatedDraft.customerSnapshot.name).toBe('Updated Name');
      expect(updatedDraft.items[0].quantity).toBe(2);
      expect(updatedDraft.updatedAt).not.toBe(draft.updatedAt);
    });

    test('deve manter campos não atualizados', async () => {
      const originalDate = new Date().toISOString();
      const draft = await draftManager.createDraft({
        customerSnapshot: { name: 'Original' },
        orderType: 'delivery',
        createdAt: originalDate
      });

      const updatedDraft = await draftManager.updateDraft(draft.id, {
        customerSnapshot: { name: 'Updated' }
      });

      expect(updatedDraft.customerSnapshot.name).toBe('Updated');
      expect(updatedDraft.orderType).toBe('delivery');
      expect(updatedDraft.createdAt).toBe(originalDate);
    });

    test('deve lançar erro ao atualizar rascunho inexistente', async () => {
      await expect(draftManager.updateDraft('nonexistent', {}))
        .rejects.toThrow('Draft not found');
    });
  });

  describe('Exclusão de Rascunhos', () => {
    test('deve remover rascunho por ID', async () => {
      const draft = await draftManager.createDraft({
        customerSnapshot: { name: 'To Delete' }
      });

      await draftManager.deleteDraft(draft.id);

      const retrievedDraft = await draftManager.getDraft(draft.id);
      expect(retrievedDraft).toBeNull();
    });

    test('deve limpar todos os rascunhos', async () => {
      await draftManager.createDraft({ customerSnapshot: { name: '1' } });
      await draftManager.createDraft({ customerSnapshot: { name: '2' } });
      await draftManager.createDraft({ customerSnapshot: { name: '3' } });

      await draftManager.clearAllDrafts();

      const allDrafts = await draftManager.getAllDrafts();
      expect(allDrafts).toHaveLength(0);
    });

    test('deve lidar com exclusão de rascunho inexistente', async () => {
      await expect(draftManager.deleteDraft('nonexistent'))
        .rejects.toThrow('Draft not found');
    });
  });

  describe('Persistência de Dados', () => {
    test('deve persistir rascunhos no localStorage', async () => {
      const draft = await draftManager.createDraft({
        customerSnapshot: { name: 'Persist Test' }
      });

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'orderDrafts',
        expect.any(String)
      );

      const storedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(storedData).toContainEqual(
        expect.objectContaining({
          id: draft.id,
          customerSnapshot: { name: 'Persist Test' }
        })
      );
    });

    test('deve carregar rascunhos do localStorage na inicialização', async () => {
      // Simula dados existentes no localStorage
      const existingDrafts = [
        {
          id: 'existing_1',
          customerSnapshot: { name: 'Existing Client' },
          items: [],
          status: 'draft',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockStorage.data.set('orderDrafts', JSON.stringify(existingDrafts));

      const newManager = new OrderDraftManager();
      const drafts = await newManager.getAllDrafts();

      expect(drafts).toHaveLength(1);
      expect(drafts[0].customerSnapshot.name).toBe('Existing Client');
    });

    test('deve lidar com dados corrompidos no localStorage', async () => {
      mockStorage.data.set('orderDrafts', 'invalid json');

      const newManager = new OrderDraftManager();
      const drafts = await newManager.getAllDrafts();

      expect(drafts).toHaveLength(0);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Cache e Performance', () => {
    test('deve usar cache para leituras repetidas', async () => {
      const draft = await draftManager.createDraft({
        customerSnapshot: { name: 'Cache Test' }
      });

      // Primeira leitura
      const firstRead = await draftManager.getDraft(draft.id);
      
      // Segunda leitura (deve usar cache)
      const secondRead = await draftManager.getDraft(draft.id);

      expect(firstRead).toEqual(secondRead);
      expect(mockStorage.getItem).toHaveBeenCalledTimes(1); // Apenas na primeira leitura
    });

    test('deve invalidar cache ao atualizar', async () => {
      const draft = await draftManager.createDraft({
        customerSnapshot: { name: 'Cache Update' }
      });

      // Lê do cache
      await draftManager.getDraft(draft.id);

      // Atualiza
      await draftManager.updateDraft(draft.id, {
        customerSnapshot: { name: 'Updated' }
      });

      // Próxima leitura deve buscar do storage
      const updatedDraft = await draftManager.getDraft(draft.id);

      expect(updatedDraft.customerSnapshot.name).toBe('Updated');
    });

    test('deve limitar tamanho do cache', async () => {
      // Cria muitos rascunhos para testar limite de cache
      const drafts = [];
      for (let i = 0; i < 150; i++) {
        drafts.push(await draftManager.createDraft({
          customerSnapshot: { name: `Client ${i}` }
        }));
      }

      // Cache deve manter apenas os mais recentes
      const cacheSize = draftManager.getCacheSize();
      expect(cacheSize).toBeLessThanOrEqual(100);
    });
  });

  describe('Tratamento de Erros', () => {
    test('deve lidar com falha no localStorage', async () => {
      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      await expect(draftManager.createDraft({}))
        .rejects.toThrow('Storage quota exceeded');
    });

    test('deve validar estrutura de dados', async () => {
      const invalidData = {
        items: 'not an array',
        customerSnapshot: null,
        totals: 'invalid'
      };

      await expect(draftManager.createDraft(invalidData))
        .rejects.toThrow();
    });

    test('deve prevenir injection attacks', async () => {
      const maliciousData = {
        customerSnapshot: {
          name: '__proto__',
          phone: 'constructor'
        },
        items: [
          {
            productName: 'prototype',
            quantity: 'toString',
            price: 'valueOf'
          }
        ]
      };

      const draft = await draftManager.createDraft(maliciousData);

      // Deve criar objeto seguro sem propriedades perigosas
      expect(draft).toBeDefined();
      expect(draft.__proto__).toBe(Object.prototype);
      expect(draft.constructor).toBe(Object);
    });
  });

  describe('Métricas e Monitoramento', () => {
    test('deve coletar métricas de operações', async () => {
      await draftManager.createDraft({ customerSnapshot: { name: 'Metrics' } });
      await draftManager.updateDraft('draft_1', { customerSnapshot: { name: 'Updated' } });
      await draftManager.deleteDraft('draft_1');

      const metrics = draftManager.getMetrics();

      expect(metrics.operations.create).toBe(1);
      expect(metrics.operations.update).toBe(1);
      expect(metrics.operations.delete).toBe(1);
      expect(metrics.totalOperations).toBe(3);
    });

    test('deve medir tempo de operações', async () => {
      const startTime = performance.now();
      await draftManager.createDraft({ customerSnapshot: { name: 'Timing' } });
      const endTime = performance.now();

      const metrics = draftManager.getMetrics();
      expect(metrics.averageOperationTime).toBeGreaterThan(0);
      expect(metrics.averageOperationTime).toBeLessThan(endTime - startTime + 100);
    });
  });

  describe('Concorrência', () => {
    test('deve lidar com operações concorrentes', async () => {
      const draftId = 'concurrent_test';
      
      // Operações concorrentes
      const promises = [
        draftManager.createDraft({ id: draftId, customerSnapshot: { name: 'Op 1' } }),
        draftManager.createDraft({ id: draftId, customerSnapshot: { name: 'Op 2' } }),
        draftManager.createDraft({ id: draftId, customerSnapshot: { name: 'Op 3' } })
      ];

      const results = await Promise.allSettled(promises);
      
      // Apenas uma deve ter sucesso
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);
    });

    test('deve manter consistência em atualizações concorrentes', async () => {
      const draft = await draftManager.createDraft({
        customerSnapshot: { name: 'Concurrent' },
        items: [{ productName: 'Item', quantity: 1, price: 10 }]
      });

      // Atualizações concorrentes
      const updatePromises = [
        draftManager.updateDraft(draft.id, { items: [{ productName: 'Item', quantity: 2, price: 10 }] }),
        draftManager.updateDraft(draft.id, { items: [{ productName: 'Item', quantity: 3, price: 10 }] }),
        draftManager.updateDraft(draft.id, { items: [{ productName: 'Item', quantity: 4, price: 10 }] })
      ];

      await Promise.all(updatePromises);

      const finalDraft = await draftManager.getDraft(draft.id);
      
      // Quantidade final deve ser uma das atualizadas
      expect([2, 3, 4]).toContain(finalDraft.items[0].quantity);
    });
  });
});

describe('OrderDraftManager - Edge Cases', () => {
  let draftManager;

  beforeEach(() => {
    const mockStorage = {
      data: new Map(),
      getItem: jest.fn((key) => mockStorage.data.get(key) || null),
      setItem: jest.fn((key, value) => mockStorage.data.set(key, value)),
      removeItem: jest.fn((key) => mockStorage.data.delete(key)),
      clear: jest.fn(() => mockStorage.data.clear())
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true
    });

    draftManager = new OrderDraftManager();
  });

  test('deve lidar com dados muito grandes', async () => {
    const largeItems = Array.from({ length: 1000 }, (_, i) => ({
      productName: `Item ${i}`,
      quantity: 1,
      price: 10,
      description: 'A'.repeat(1000) // Descrição grande
    }));

    const draft = await draftManager.createDraft({
      customerSnapshot: { name: 'Large Data' },
      items: largeItems
    });

    expect(draft.items).toHaveLength(1000);
  });

  test('deve lidar com caracteres especiais', async () => {
    const specialData = {
      customerSnapshot: {
        name: 'João ão ç ñ é í ó ú',
        phone: '+55 (11) 99999-9999',
        address: 'Rua São José, 123 - apto 45°'
      },
      items: [{
        productName: 'Pizza "Especial" com &',
        quantity: 1,
        price: 35.90,
        notes: 'Sem cebola / com extra de queijo'
      }]
    };

    const draft = await draftManager.createDraft(specialData);

    expect(draft.customerSnapshot.name).toBe(specialData.customerSnapshot.name);
    expect(draft.items[0].productName).toBe(specialData.items[0].productName);
  });

  test('deve lidar com valores numéricos extremos', async () => {
    const extremeData = {
      customerSnapshot: { name: 'Extreme Values' },
      items: [{
        productName: 'Item Caro',
        quantity: 0,
        price: 999999.99
      }],
      totals: {
        subtotal: 0,
        deliveryFee: 999999.99,
        discount: 999999.99,
        finalTotal: 999999.99
      }
    };

    const draft = await draftManager.createDraft(extremeData);

    expect(draft.items[0].quantity).toBe(0);
    expect(draft.items[0].price).toBe(999999.99);
    expect(draft.totals.finalTotal).toBe(999999.99);
  });
});
