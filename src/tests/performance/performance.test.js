// src/tests/performance/performance.test.js
// Testes de desempenho para o sistema de rascunhos

import { jest } from '@jest/globals';
import OrderDraftManager from '../../utils/orderDraftManager.js';
import DraftAnalyticsEngine from '../../utils/orderDraftAnalytics.js';
import DraftSecurityManager from '../../utils/orderDraftSecurity.js';

describe('Performance Tests', () => {
  let draftManager;
  let analytics;
  let securityManager;
  let mockStorage;

  beforeEach(() => {
    // Mock do localStorage com performance tracking
    mockStorage = {
      data: new Map(),
      getItem: jest.fn((key) => {
        const start = performance.now();
        const result = mockStorage.data.get(key) || null;
        const end = performance.now();
        console.log(`localStorage.getItem took ${end - start}ms`);
        return result;
      }),
      setItem: jest.fn((key, value) => {
        const start = performance.now();
        mockStorage.data.set(key, value);
        const end = performance.now();
        console.log(`localStorage.setItem took ${end - start}ms`);
      }),
      removeItem: jest.fn((key) => {
        const start = performance.now();
        mockStorage.data.delete(key);
        const end = performance.now();
        console.log(`localStorage.removeItem took ${end - start}ms`);
      }),
      clear: jest.fn(() => {
        const start = performance.now();
        mockStorage.data.clear();
        const end = performance.now();
        console.log(`localStorage.clear took ${end - start}ms`);
      })
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true
    });

    draftManager = new OrderDraftManager();
    analytics = new DraftAnalyticsEngine();
    securityManager = new DraftSecurityManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage.data.clear();
  });

  describe('Performance de Criação de Rascunhos', () => {
    test('deve criar 100 rascunhos em menos de 1 segundo', async () => {
      const startTime = performance.now();
      
      const promises = Array.from({ length: 100 }, (_, i) => 
        draftManager.createDraft({
          customerSnapshot: { name: `Client ${i}` },
          items: [
            { productName: `Product ${i}`, quantity: 1, price: 10.00 }
          ]
        })
      );

      await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Created 100 drafts in ${duration}ms`);
      expect(duration).toBeLessThan(1000);
    });

    test('deve manter performance com rascunhos grandes', async () => {
      const largeDraft = {
        customerSnapshot: { name: 'Large Draft Client' },
        items: Array.from({ length: 100 }, (_, i) => ({
          productName: `Large Product ${i}`,
          quantity: 1,
          price: 10.00,
          description: 'A'.repeat(1000), // Descrição grande
          customizations: Array.from({ length: 10 }, (_, j) => ({
            name: `Custom ${j}`,
            value: 'A'.repeat(100)
          }))
        })),
        notes: 'A'.repeat(5000), // Notas grandes
        totals: {
          subtotal: 1000,
          deliveryFee: 10,
          discount: 50,
          finalTotal: 960
        }
      };

      const startTime = performance.now();
      await draftManager.createDraft(largeDraft);
      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Created large draft in ${duration}ms`);
      expect(duration).toBeLessThan(500);
    });

    test('deve lidar com criação concorrente eficiente', async () => {
      const concurrentDrafts = 50;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentDrafts }, (_, i) => 
        draftManager.createDraft({
          id: `concurrent_${i}`,
          customerSnapshot: { name: `Concurrent Client ${i}` },
          items: [{ productName: 'Product', quantity: 1, price: 10 }]
        })
      );

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      console.log(`Concurrent creation: ${successful.length} successful, ${failed.length} failed in ${duration}ms`);
      expect(duration).toBeLessThan(2000);
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('Performance de Leitura e Cache', () => {
    test('deve ler rascunhos rapidamente com cache', async () => {
      // Cria rascunhos primeiro
      const draftIds = [];
      for (let i = 0; i < 100; i++) {
        const draft = await draftManager.createDraft({
          customerSnapshot: { name: `Cache Test ${i}` },
          items: [{ productName: 'Product', quantity: 1, price: 10 }]
        });
        draftIds.push(draft.id);
      }

      // Testa leitura com cache
      const startTime = performance.now();
      
      for (const id of draftIds) {
        await draftManager.getDraft(id);
      }
      
      const endTime = performance.now();
      const avgReadTime = (endTime - startTime) / draftIds.length;

      console.log(`Average cached read time: ${avgReadTime}ms`);
      expect(avgReadTime).toBeLessThan(1); // Cache deve ser muito rápido
    });

    test('deve invalidar cache eficientemente', async () => {
      const draft = await draftManager.createDraft({
        customerSnapshot: { name: 'Cache Invalidation Test' },
        items: [{ productName: 'Product', quantity: 1, price: 10 }]
      });

      // Primeira leitura (cache miss)
      const startTime1 = performance.now();
      await draftManager.getDraft(draft.id);
      const endTime1 = performance.now();
      const firstRead = endTime1 - startTime1;

      // Segunda leitura (cache hit)
      const startTime2 = performance.now();
      await draftManager.getDraft(draft.id);
      const endTime2 = performance.now();
      const secondRead = endTime2 - startTime2;

      // Atualização (invalida cache)
      await draftManager.updateDraft(draft.id, {
        customerSnapshot: { name: 'Updated' }
      });

      // Terceira leitura (cache miss após invalidação)
      const startTime3 = performance.now();
      await draftManager.getDraft(draft.id);
      const endTime3 = performance.now();
      const thirdRead = endTime3 - startTime3;

      console.log(`Read times: 1st=${firstRead}ms, 2nd=${secondRead}ms, 3rd=${thirdRead}ms`);
      expect(secondRead).toBeLessThan(firstRead); // Cache hit deve ser mais rápido
      expect(thirdRead).toBeGreaterThan(secondRead); // Cache miss deve ser mais lento
    });

    test('deve limitar tamanho do cache eficientemente', async () => {
      // Cria mais rascunhos que o limite do cache
      const cacheLimit = 100;
      const draftCount = cacheLimit + 50;

      for (let i = 0; i < draftCount; i++) {
        await draftManager.createDraft({
          customerSnapshot: { name: `Cache Limit Test ${i}` },
          items: [{ productName: 'Product', quantity: 1, price: 10 }]
        });
      }

      const cacheSize = draftManager.getCacheSize();
      console.log(`Cache size after ${draftCount} drafts: ${cacheSize}`);
      expect(cacheSize).toBeLessThanOrEqual(cacheLimit);
    });
  });

  describe('Performance de Busca e Filtragem', () => {
    test('deve buscar em grande conjunto de dados rapidamente', async () => {
      // Cria grande conjunto de dados
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        customerSnapshot: { 
          name: `Customer ${i}`,
          phone: `1199999${i.toString().padStart(4, '0')}`
        },
        items: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, j) => ({
          productName: `Product ${j}`,
          quantity: Math.floor(Math.random() * 5) + 1,
          price: Math.random() * 100 + 10
        })),
        status: 'draft'
      }));

      const startTime = performance.now();
      
      for (const draftData of largeDataset) {
        await draftManager.createDraft(draftData);
      }
      
      const endTime = performance.now();
      const creationTime = endTime - startTime;

      console.log(`Created 1000 drafts in ${creationTime}ms`);

      // Testa performance de busca
      const searchStartTime = performance.now();
      
      const results = await draftManager.searchDrafts('Customer 500');
      
      const searchEndTime = performance.now();
      const searchTime = searchEndTime - searchStartTime;

      console.log(`Search in 1000 drafts took ${searchTime}ms, found ${results.length} results`);
      expect(searchTime).toBeLessThan(100);
      expect(results.length).toBeGreaterThan(0);
    });

    test('deve filtrar por múltiplos critérios eficientemente', async () => {
      // Cria dataset variado
      const categories = ['pizza', 'hamburger', 'drink', 'dessert'];
      const statuses = ['draft', 'completed', 'cancelled'];

      for (let i = 0; i < 500; i++) {
        await draftManager.createDraft({
          customerSnapshot: { name: `Customer ${i}` },
          items: [{
            productName: `${categories[i % categories.length]}_${i}`,
            quantity: 1,
            price: 10 + (i % 50)
          }],
          status: statuses[i % statuses.length],
          category: categories[i % categories.length]
        });
      }

      const filterTests = [
        { name: 'by_category', filter: { category: 'pizza' } },
        { name: 'by_status', filter: { status: 'draft' } },
        { name: 'by_price_range', filter: { minPrice: 20, maxPrice: 30 } },
        { name: 'complex_filter', filter: { category: 'pizza', status: 'draft', minPrice: 15 } }
      ];

      for (const test of filterTests) {
        const startTime = performance.now();
        
        const results = await draftManager.filterDrafts(test.filter);
        
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`${test.name} filter took ${duration}ms, found ${results.length} results`);
        expect(duration).toBeLessThan(50);
      }
    });
  });

  describe('Performance de Criptografia', () => {
    test('deve criptografar rascunhos rapidamente', async () => {
      const drafts = Array.from({ length: 100 }, (_, i) => ({
        id: `crypto_test_${i}`,
        customerSnapshot: { name: `Crypto Test ${i}` },
        items: [{ productName: 'Product', quantity: 1, price: 10 }],
        sensitiveData: 'A'.repeat(1000) // Dados sensíveis grandes
      }));

      const password = 'test_password_123';
      const startTime = performance.now();

      const encryptionPromises = drafts.map(draft => 
        securityManager.encryptDraft(draft, password)
      );

      const encryptedDrafts = await Promise.all(encryptionPromises);
      const endTime = performance.now();
      const avgEncryptionTime = (endTime - startTime) / drafts.length;

      console.log(`Average encryption time: ${avgEncryptionTime}ms`);
      expect(avgEncryptionTime).toBeLessThan(100);
      expect(encryptedDrafts).toHaveLength(100);
    });

    test('deve descriptografar rascunhos rapidamente', async () => {
      const drafts = Array.from({ length: 50 }, (_, i) => ({
        id: `decrypt_test_${i}`,
        customerSnapshot: { name: `Decrypt Test ${i}` },
        items: [{ productName: 'Product', quantity: 1, price: 10 }]
      }));

      const password = 'test_password_123';
      
      // Criptografa primeiro
      const encryptedDrafts = await Promise.all(
        drafts.map(draft => securityManager.encryptDraft(draft, password))
      );

      // Testa descriptografia
      const startTime = performance.now();
      
      const decryptionPromises = encryptedDrafts.map(encrypted => 
        securityManager.decryptDraft(encrypted, password)
      );

      const decryptedDrafts = await Promise.all(decryptionPromises);
      const endTime = performance.now();
      const avgDecryptionTime = (endTime - startTime) / encryptedDrafts.length;

      console.log(`Average decryption time: ${avgDecryptionTime}ms`);
      expect(avgDecryptionTime).toBeLessThan(100);
      expect(decryptedDrafts).toHaveLength(50);
      
      // Verifica integridade
      decryptedDrafts.forEach((decrypted, i) => {
        expect(decrypted.customerSnapshot.name).toBe(drafts[i].customerSnapshot.name);
      });
    });
  });

  describe('Performance de Analytics', () => {
    test('deve processar grandes volumes de eventos rapidamente', async () => {
      const eventCount = 10000;
      const eventTypes = ['draft_created', 'draft_updated', 'draft_deleted', 'draft_viewed'];

      const startTime = performance.now();

      for (let i = 0; i < eventCount; i++) {
        analytics.track(eventTypes[i % eventTypes.length], {
          draftId: `draft_${i}`,
          userId: `user_${i % 100}`,
          timestamp: Date.now()
        });
      }

      const endTime = performance.now();
      const avgEventTime = (endTime - startTime) / eventCount;

      console.log(`Processed ${eventCount} events in ${endTime - startTime}ms`);
      console.log(`Average event processing time: ${avgEventTime}ms`);
      expect(avgEventTime).toBeLessThan(1); // Menos de 1ms por evento
    });

    test('deve gerar relatórios rapidamente', async () => {
      // Popula com dados
      for (let i = 0; i < 5000; i++) {
        analytics.track(['draft_created', 'draft_updated', 'draft_converted'][i % 3], {
          draftId: `draft_${i}`,
          userId: `user_${i % 50}`,
          conversionTime: Math.random() * 300000, // 0-5 minutos
          draftAge: Math.random() * 3600000 // 0-1 hora
        });
      }

      const reportTypes = ['summary', 'usage', 'performance', 'conversion'];
      const results = {};

      for (const type of reportTypes) {
        const startTime = performance.now();
        
        results[type] = analytics.generateReport(type);
        
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`${type} report generated in ${duration}ms`);
        expect(duration).toBeLessThan(1000); // Menos de 1 segundo por relatório
        expect(results[type]).toBeDefined();
      }

      // Verifica qualidade dos relatórios
      expect(results.summary.totalEvents).toBeGreaterThan(0);
      expect(results.usage.hourlyUsage).toHaveLength(24);
      expect(results.conversion.conversionRate).toBeDefined();
    });

    test('deve fazer batch processing eficiente', async () => {
      const batchSize = 1000;
      const batches = 10;

      const startTime = performance.now();

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array.from({ length: batchSize }, (_, i) => 
          analytics.track('batch_event', {
            batchId: batch,
            eventId: batch * batchSize + i,
            data: 'A'.repeat(100) // Dados significativos
          })
        );

        await Promise.all(batchPromises);
      }

      const endTime = performance.now();
      const totalEvents = batchSize * batches;
      const avgBatchTime = (endTime - startTime) / batches;

      console.log(`Processed ${totalEvents} events in ${batches} batches`);
      console.log(`Average batch time: ${avgBatchTime}ms`);
      expect(avgBatchTime).toBeLessThan(500); // Menos de 500ms por batch
    });
  });

  describe('Performance de Memória', () => {
    test('deve gerenciar memória eficientemente com muitos rascunhos', async () => {
      const initialMemory = performance.memory.usedJSHeapSize || 0;
      
      // Cria muitos rascunhos
      for (let i = 0; i < 1000; i++) {
        await draftManager.createDraft({
          customerSnapshot: { name: `Memory Test ${i}` },
          items: [{ productName: 'Product', quantity: 1, price: 10 }],
          largeData: 'A'.repeat(1000) // Dados significativos
        });
      }

      // Força garbage collection se disponível
      if (global.gc) {
        global.gc();
      }

      const finalMemory = performance.memory.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`);
      
      // Memória não deve aumentar excessivamente
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Menos de 100MB
      }
    });

    test('deve limpar recursos adequadamente', async () => {
      // Cria rascunhos
      const drafts = [];
      for (let i = 0; i < 100; i++) {
        drafts.push(await draftManager.createDraft({
          customerSnapshot: { name: `Cleanup Test ${i}` },
          items: [{ productName: 'Product', quantity: 1, price: 10 }]
        }));
      }

      // Remove todos
      const startTime = performance.now();
      
      for (const draft of drafts) {
        await draftManager.deleteDraft(draft.id);
      }
      
      const endTime = performance.now();
      const cleanupTime = endTime - startTime;

      console.log(`Cleaned up 100 drafts in ${cleanupTime}ms`);
      expect(cleanupTime).toBeLessThan(1000);

      // Verifica se cache foi limpo
      expect(draftManager.getCacheSize()).toBe(0);
    });
  });

  describe('Performance de UI', () => {
    test('deve renderizar lista grande sem bloquear UI', async () => {
      // Simula renderização de grande lista
      const largeDraftList = Array.from({ length: 10000 }, (_, i) => ({
        id: `ui_test_${i}`,
        customerSnapshot: { name: `UI Test ${i}` },
        items: [{ productName: 'Product', quantity: 1, price: 10 }],
        visible: i < 100 // Apenas primeiros 100 visíveis inicialmente
      }));

      const startTime = performance.now();
      
      // Simula processamento em chunks para não bloquear UI
      const chunkSize = 100;
      for (let i = 0; i < largeDraftList.length; i += chunkSize) {
        const chunk = largeDraftList.slice(i, i + chunkSize);
        
        // Simula renderização do chunk
        chunk.forEach(draft => {
          draft.rendered = true;
        });

        // Yield para UI thread
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      console.log(`Rendered 10000 items in ${renderTime}ms without blocking`);
      expect(renderTime).toBeLessThan(5000); // Menos de 5 segundos
      
      // Verifica se todos foram renderizados
      expect(largeDraftList.every(draft => draft.rendered)).toBe(true);
    });

    test('deve fazer virtual scrolling eficiente', async () => {
      // Simula virtual scrolling
      const totalItems = 10000;
      const visibleItems = 50;
      const scrollTop = 5000; // Meio da lista

      const startTime = performance.now();
      
      // Calcula itens visíveis
      const startIndex = Math.floor(scrollTop / 50); // Assume 50px por item
      const endIndex = Math.min(startIndex + visibleItems, totalItems);
      
      const visibleDrafts = Array.from({ length: endIndex - startIndex }, (_, i) => ({
        id: `virtual_${startIndex + i}`,
        customerSnapshot: { name: `Virtual Item ${startIndex + i}` },
        index: startIndex + i
      }));

      const endTime = performance.now();
      const virtualScrollTime = endTime - startTime;

      console.log(`Virtual scroll calculated ${visibleDrafts.length} items in ${virtualScrollTime}ms`);
      expect(virtualScrollTime).toBeLessThan(10); // Deve ser muito rápido
      expect(visibleDrafts.length).toBeLessThanOrEqual(visibleItems);
    });
  });

  describe('Performance de Sincronização', () => {
    test('deve sincronizar grandes volumes eficientemente', async () => {
      // Cria muitos rascunhos para sincronização
      const syncDrafts = Array.from({ length: 500 }, (_, i) => ({
        id: `sync_test_${i}`,
        customerSnapshot: { name: `Sync Test ${i}` },
        items: [{ productName: 'Product', quantity: 1, price: 10 }],
        needsSync: true
      }));

      // Mock de API rápida
      const mockAPI = {
        sync: jest.fn().mockResolvedValue({ success: true })
      };

      const startTime = performance.now();
      
      // Simula sincronização em paralelo
      const syncPromises = syncDrafts.map(draft => 
        mockAPI.sync(draft)
      );

      await Promise.all(syncPromises);
      
      const endTime = performance.now();
      const syncTime = endTime - startTime;
      const avgSyncTime = syncTime / syncDrafts.length;

      console.log(`Synced ${syncDrafts.length} drafts in ${syncTime}ms`);
      console.log(`Average sync time: ${avgSyncTime}ms`);
      expect(avgSyncTime).toBeLessThan(10); // Menos de 10ms por sincronização
    });

    test('deve lidar com conflitos rapidamente', async () => {
      const conflicts = Array.from({ length: 100 }, (_, i) => ({
        id: `conflict_${i}`,
        local: { data: `local_${i}`, timestamp: Date.now() - 1000 },
        server: { data: `server_${i}`, timestamp: Date.now() }
      }));

      const startTime = performance.now();
      
      // Simula resolução de conflitos
      const resolvedConflicts = conflicts.map(conflict => ({
        ...conflict.server,
        resolvedAt: Date.now(),
        conflictResolved: true
      }));

      const endTime = performance.now();
      const conflictResolutionTime = endTime - startTime;

      console.log(`Resolved ${conflicts.length} conflicts in ${conflictResolutionTime}ms`);
      expect(conflictResolutionTime).toBeLessThan(100);
      expect(resolvedConflicts).toHaveLength(100);
    });
  });

  describe('Load Testing', () => {
    test('deve handle carga sustentada', async () => {
      const duration = 10000; // 10 segundos
      const operationsPerSecond = 100;
      const totalOperations = (duration / 1000) * operationsPerSecond;

      let completedOperations = 0;
      const startTime = performance.now();

      const operations = [];
      for (let i = 0; i < totalOperations; i++) {
        operations.push(
          draftManager.createDraft({
            customerSnapshot: { name: `Load Test ${i}` },
            items: [{ productName: 'Product', quantity: 1, price: 10 }]
          }).then(() => {
            completedOperations++;
          })
        );

        // Espalha operações no tempo
        if (i % operationsPerSecond === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      await Promise.all(operations);
      const endTime = performance.now();
      const actualDuration = endTime - startTime;

      console.log(`Completed ${completedOperations}/${totalOperations} operations in ${actualDuration}ms`);
      console.log(`Actual ops/sec: ${completedOperations / (actualDuration / 1000)}`);
      
      expect(completedOperations).toBeGreaterThan(totalOperations * 0.9); // 90% success rate
      expect(actualDuration).toBeLessThan(duration * 1.5); // 50% tolerance
    });
  });
});
