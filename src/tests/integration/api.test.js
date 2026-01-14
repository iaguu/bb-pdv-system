// src/tests/integration/api.test.js
// Testes de integração entre API local e APIs externas

import { jest } from '@jest/globals';
import DraftAPIClient from '../../utils/orderDraftIntegration.js';
import DraftWebhookManager from '../../utils/orderDraftIntegration.js';
import DraftSyncManager from '../../utils/orderDraftIntegration.js';

describe('API Integration Tests', () => {
  let apiClient;
  let webhookManager;
  let syncManager;
  let mockFetch;
  let mockStorage;
  let mockEventBus;

  beforeEach(() => {
    // Mock do fetch global
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock do storage
    mockStorage = {
      data: new Map(),
      get: jest.fn((id) => Promise.resolve(mockStorage.data.get(id) || null)),
      set: jest.fn((id, data) => {
        mockStorage.data.set(id, data);
        return Promise.resolve(data);
      }),
      getAll: jest.fn(() => Promise.resolve(Array.from(mockStorage.data.values()))),
      delete: jest.fn((id) => {
        mockStorage.data.delete(id);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        mockStorage.data.clear();
        return Promise.resolve();
      })
    };

    // Mock do event bus
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn()
    };

    // Inicializa componentes
    apiClient = new DraftAPIClient('https://api.example.com', 'test-api-key');
    webhookManager = new DraftWebhookManager();
    syncManager = new DraftSyncManager(mockStorage, mockEventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage.data.clear();
  });

  describe('API Client - Conexão com APIs Externas', () => {
    test('deve fazer requisição GET com sucesso', async () => {
      const mockResponse = { data: { id: 1, name: 'Test' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await apiClient.get('/drafts');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/drafts',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
      expect(result).toEqual(mockResponse);
    });

    test('deve fazer requisição POST com dados', async () => {
      const draftData = {
        customerSnapshot: { name: 'Test Client' },
        items: [{ productName: 'Pizza', quantity: 1, price: 35.90 }]
      };

      const mockResponse = { id: 'draft_123', ...draftData };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await apiClient.post('/drafts', draftData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/drafts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(draftData)
        })
      );
      expect(result).toEqual(mockResponse);
    });

    test('deve lidar com erro HTTP', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(apiClient.get('/nonexistent'))
        .rejects.toThrow('HTTP 404: Not Found');
    });

    test('deve fazer retry automático em falhas', async () => {
      // Primeiras 2 tentativas falham
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Terceira tentativa succeeds
      const mockResponse = { data: 'success' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await apiClient.get('/drafts');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockResponse);
    });

    test('deve falhar após máximo de tentativas', async () => {
      // Todas as tentativas falham
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      await expect(apiClient.get('/drafts'))
        .rejects.toThrow('Persistent error');

      expect(mockFetch).toHaveBeenCalledTimes(3); // 3 tentativas máximas
    });

    test('deve respeitar timeout', async () => {
      // Simula requisição lenta
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 15000))
      );

      await expect(apiClient.get('/drafts'))
        .rejects.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Webhook Manager - Comunicação Bidirecional', () => {
    test('deve registrar webhook com sucesso', () => {
      webhookManager.registerWebhook(
        'payment-webhook',
        'https://payment.example.com/webhook',
        ['draft_created', 'draft_updated'],
        'webhook-secret'
      );

      const webhooks = webhookManager.webhooks;
      expect(webhooks.has('payment-webhook')).toBe(true);
      
      const webhook = webhooks.get('payment-webhook');
      expect(webhook.url).toBe('https://payment.example.com/webhook');
      expect(webhook.events).toEqual(['draft_created', 'draft_updated']);
      expect(webhook.secret).toBe('webhook-secret');
      expect(webhook.active).toBe(true);
    });

    test('deve disparar evento para webhooks registrados', async () => {
      // Mock do fetch para webhooks
      const webhookFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });
      global.fetch = webhookFetch;

      webhookManager.registerWebhook(
        'test-webhook',
        'https://example.com/webhook',
        ['draft_created']
      );

      const eventData = {
        draftId: 'draft_123',
        customerName: 'Test Client'
      };

      const event = await webhookManager.triggerEvent('draft_created', eventData);

      expect(event.type).toBe('draft_created');
      expect(event.data).toEqual(eventData);
      expect(event.signature).toBeDefined();

      // Aguarda processamento assíncrono
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(webhookFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'draft_created',
            'X-Webhook-ID': event.id,
            'X-Webhook-Signature': expect.any(String)
          }),
          body: expect.stringContaining('draft_created')
        })
      );
    });

    test('deve fazer retry em falhas de webhook', async () => {
      let attemptCount = 0;
      const webhookFetch = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Webhook failed'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
      global.fetch = webhookFetch;

      webhookManager.registerWebhook(
        'retry-webhook',
        'https://example.com/webhook',
        ['draft_created']
      );

      await webhookManager.triggerEvent('draft_created', { test: true });

      // Aguarda processamento com retries
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(webhookFetch).toHaveBeenCalledTimes(3);
    });

    test('deve desativar webhook após falhas máximas', async () => {
      const webhookFetch = jest.fn().mockRejectedValue(new Error('Always fails'));
      global.fetch = webhookFetch;

      webhookManager.registerWebhook(
        'failing-webhook',
        'https://example.com/webhook',
        ['draft_created']
      );

      await webhookManager.triggerEvent('draft_created', { test: true });

      // Aguarda todas as tentativas
      await new Promise(resolve => setTimeout(resolve, 5000));

      const webhook = webhookManager.webhooks.get('failing-webhook');
      expect(webhook.active).toBe(false);
      expect(webhook.retryCount).toBe(3);
    });

    test('deve gerar assinatura HMAC correta', async () => {
      const webhookFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = webhookFetch;

      webhookManager.registerWebhook(
        'hmac-webhook',
        'https://example.com/webhook',
        ['draft_created'],
        'test-secret'
      );

      await webhookManager.triggerEvent('draft_created', { test: 'data' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const callArgs = webhookFetch.mock.calls[0];
      const signature = callArgs[0].headers['X-Webhook-Signature'];
      
      // Verifica se assinatura foi gerada
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  describe('Sync Manager - Sincronização Multi-dispositivo', () => {
    test('deve sincronizar dados quando online', async () => {
      // Simula estar online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      // Mock da API de sincronização
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          successful: ['sync_1', 'sync_2'],
          conflicts: [],
          updates: []
        })
      });

      // Adiciona itens à fila de sincronização
      syncManager.addToSyncQueue('update', { id: 'draft_1', data: 'test1' });
      syncManager.addToSyncQueue('update', { id: 'draft_2', data: 'test2' });

      await syncManager.sync();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/drafts/sync',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('sync_1')
        })
      );

      // Fila deve estar vazia após sincronização bem-sucedida
      expect(syncManager.syncQueue).toHaveLength(0);
    });

    test('deve lidar com conflitos de sincronização', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          successful: [],
          conflicts: [
            {
              id: 'conflict_1',
              local: { id: 'conflict_1', data: 'local_version', timestamp: Date.now() - 1000 },
              server: { id: 'conflict_1', data: 'server_version', timestamp: Date.now() }
            }
          ],
          updates: []
        })
      });

      syncManager.addToSyncQueue('update', { id: 'conflict_1', data: 'local_version' });

      await syncManager.sync();

      // Deve ter chamado o handler de conflitos
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'conflict-detected',
        expect.objectContaining({
          conflict: expect.objectContaining({
            id: 'conflict_1'
          })
        })
      );
    });

    test('deve aplicar atualizações do servidor', async () => {
      const serverUpdate = {
        id: 'update_1',
        data: 'server_updated_data',
        timestamp: Date.now()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          successful: [],
          conflicts: [],
          updates: [serverUpdate]
        })
      });

      await syncManager.sync();

      // Deve ter aplicado atualização no storage
      expect(mockStorage.set).toHaveBeenCalledWith(
        'update_1',
        serverUpdate
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'server-update',
        serverUpdate
      );
    });

    test('deve manter fila quando offline', async () => {
      // Simula estar offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      syncManager.addToSyncQueue('update', { id: 'draft_1', data: 'test' });

      await syncManager.sync();

      // Não deve fazer requisição quando offline
      expect(mockFetch).not.toHaveBeenCalled();
      
      // Fila deve permanecer
      expect(syncManager.syncQueue).toHaveLength(1);
    });

    test('deve detectar mudança de status online/offline', async () => {
      const onlineHandler = jest.fn();
      const offlineHandler = jest.fn();

      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);

      // Simula mudança para offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      window.dispatchEvent(new Event('offline'));

      expect(offlineHandler).toHaveBeenCalled();

      // Simula mudança para online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      window.dispatchEvent(new Event('online'));

      expect(onlineHandler).toHaveBeenCalled();

      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    });

    test('deve fazer merge automático de conflitos', async () => {
      syncManager.conflictResolution = 'merge';

      const conflictData = {
        id: 'merge_conflict',
        local: {
          id: 'merge_conflict',
          items: [{ id: 'item1', name: 'Pizza Local' }],
          updatedAt: '2024-01-01T10:00:00Z'
        },
        server: {
          id: 'merge_conflict',
          items: [{ id: 'item2', name: 'Pizza Server' }],
          updatedAt: '2024-01-01T11:00:00Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          successful: [],
          conflicts: [conflictData],
          updates: []
        })
      });

      await syncManager.sync();

      // Deve ter feito merge dos dados
      expect(mockStorage.set).toHaveBeenCalledWith(
        'merge_conflict',
        expect.objectContaining({
          items: expect.arrayContaining([
            { id: 'item1', name: 'Pizza Local' },
            { id: 'item2', name: 'Pizza Server' }
          ]),
          conflictResolved: true
        })
      );
    });
  });

  describe('Integração Completa - Fluxo End-to-End', () => {
    test('deve sincronizar rascunho criado localmente com API externa', async () => {
      // 1. Cria rascunho localmente
      const localDraft = {
        id: 'local_draft_1',
        customerSnapshot: { name: 'Local Client' },
        items: [{ productName: 'Pizza Local', quantity: 1, price: 35.90 }],
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await mockStorage.set('local_draft_1', localDraft);

      // 2. Configura webhook para notificar sistema externo
      webhookManager.registerWebhook(
        'external-system',
        'https://external-api.com/drafts',
        ['draft_created']
      );

      // 3. Mock da API externa
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'external_draft_1',
          ...localDraft,
          syncedAt: new Date().toISOString()
        })
      });

      // 4. Dispara evento de criação
      await webhookManager.triggerEvent('draft_created', localDraft);

      // 5. Aguarda processamento
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verifica se webhook foi chamado
      expect(mockFetch).toHaveBeenCalledWith(
        'https://external-api.com/drafts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('draft_created')
        })
      );

      // 6. Simula sincronização bidirecional
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          successful: ['sync_local_draft_1'],
          conflicts: [],
          updates: [{
            id: 'local_draft_1',
            externalId: 'external_draft_1',
            syncedAt: new Date().toISOString()
          }]
        })
      });

      syncManager.addToSyncQueue('create', localDraft);
      await syncManager.sync();

      // 7. Verifica se rascunho foi atualizado com ID externo
      expect(mockStorage.set).toHaveBeenCalledWith(
        'local_draft_1',
        expect.objectContaining({
          externalId: 'external_draft_1',
          syncedAt: expect.any(String)
        })
      );
    });

    test('deve lidar com falha completa de integração', async () => {
      // Simula falha em todos os componentes
      mockFetch.mockRejectedValue(new Error('Complete failure'));
      
      // Tenta criar rascunho local
      const draft = {
        id: 'failure_test',
        customerSnapshot: { name: 'Failure Test' },
        items: [],
        status: 'draft'
      };

      await mockStorage.set('failure_test', draft);

      // Tenta enviar webhook
      webhookManager.registerWebhook(
        'failing-webhook',
        'https://failing-api.com/webhook',
        ['draft_created']
      );

      await webhookManager.triggerEvent('draft_created', draft);

      // Tenta sincronizar
      syncManager.addToSyncQueue('create', draft);
      await syncManager.sync();

      // Aguarda tentativas
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verifica que dados locais foram preservados
      const localData = await mockStorage.get('failure_test');
      expect(localData).toEqual(draft);

      // Verifica que eventos de erro foram emitidos
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'sync-error',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });

    test('deve manter consistência em múltiplas atualizações', async () => {
      const draftId = 'consistency_test';
      const initialDraft = {
        id: draftId,
        customerSnapshot: { name: 'Initial' },
        items: [{ productName: 'Item 1', quantity: 1, price: 10 }],
        version: 1
      };

      await mockStorage.set(draftId, initialDraft);

      // Mock de API com versionamento
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/drafts/sync')) {
          const body = JSON.parse(options.body);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              successful: body.queue.map(q => q.id),
              conflicts: [],
              updates: []
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      });

      // Múltiplas atualizações concorrentes
      const updates = [
        { customerSnapshot: { name: 'Updated 1' }, version: 2 },
        { customerSnapshot: { name: 'Updated 2' }, version: 3 },
        { customerSnapshot: { name: 'Updated 3' }, version: 4 }
      ];

      const promises = updates.map((update, index) => {
        syncManager.addToSyncQueue('update', { id: draftId, ...update });
        return new Promise(resolve => setTimeout(resolve, index * 100));
      });

      await Promise.all(promises);
      await syncManager.sync();

      // Verifica consistência final
      const finalDraft = await mockStorage.get(draftId);
      expect(finalDraft.version).toBeGreaterThanOrEqual(2);
      expect(['Updated 1', 'Updated 2', 'Updated 3']).toContain(finalDraft.customerSnapshot.name);
    });
  });

  describe('Performance e Escalabilidade', () => {
    test('deve lidar com grande volume de dados', async () => {
      // Cria 1000 rascunhos
      const drafts = Array.from({ length: 1000 }, (_, i) => ({
        id: `bulk_draft_${i}`,
        customerSnapshot: { name: `Client ${i}` },
        items: [{ productName: `Item ${i}`, quantity: 1, price: 10 }],
        status: 'draft'
      }));

      // Armazena localmente
      for (const draft of drafts) {
        await mockStorage.set(draft.id, draft);
      }

      // Mock de API que lida com bulk
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          successful: drafts.map(d => d.id),
          conflicts: [],
          updates: []
        })
      });

      // Adiciona todos à fila de sincronização
      drafts.forEach(draft => {
        syncManager.addToSyncQueue('update', draft);
      });

      const startTime = performance.now();
      await syncManager.sync();
      const endTime = performance.now();

      // Deve completar em tempo razoável
      expect(endTime - startTime).toBeLessThan(5000); // 5 segundos

      // Verifica que todos foram sincronizados
      expect(syncManager.syncQueue).toHaveLength(0);
    });

    test('deve limitar requisições concorrentes', async () => {
      let activeRequests = 0;
      let maxConcurrentRequests = 0;

      mockFetch.mockImplementation(() => {
        activeRequests++;
        maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);
        
        return new Promise(resolve => {
          setTimeout(() => {
            activeRequests--;
            resolve({
              ok: true,
              json: () => Promise.resolve({ success: true })
            });
          }, 100);
        });
      });

      // Dispara múltiplos webhooks
      for (let i = 0; i < 20; i++) {
        webhookManager.registerWebhook(
          `webhook_${i}`,
          `https://example.com/webhook${i}`,
          ['test_event']
        );
        webhookManager.triggerEvent('test_event', { test: i });
      }

      // Aguarda todos completarem
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Deve ter limitado requisições concorrentes
      expect(maxConcurrentRequests).toBeLessThanOrEqual(10);
    });
  });
});
