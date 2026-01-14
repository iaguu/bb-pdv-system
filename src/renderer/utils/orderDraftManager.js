import React from "react";

/**
 * Gerenciador de rascunhos de pedidos
 * Permite mÃºltiplos pedidos simultÃ¢neos com salvamento automÃ¡tico
 */

const DRAFTS_STORAGE_KEY = "orderDraftsV1";
const ACTIVE_DRAFT_KEY = "activeOrderDraftId";

class OrderDraftManager {
  constructor() {
    this.storageKey = DRAFTS_STORAGE_KEY;
    this.activeDraftKey = ACTIVE_DRAFT_KEY;
    this.drafts = new Map();
    this.activeDraftId = null;
    this.autoSaveTimer = null;
    this.saveDebounceTime = 500;
    this.lastSaveTime = 0;
    this.cache = new Map();
    this.pendingOperations = [];
    this.batchTimeout = null;
    this.batchDelay = 50;
    this.worker = null;
    this.listeners = new Set();
    this.loadFromStorage();
  }

  // Carrega rascunhos do localStorage
  loadFromStorage() {
    try {
      if (!window.localStorage) return;

      const draftsData = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (draftsData) {
        const drafts = JSON.parse(draftsData);
        if (Array.isArray(drafts)) {
          drafts.forEach(draft => {
            if (draft && draft.id) {
              this.drafts.set(draft.id, draft);
            }
          });
        }
      }

      const activeId = localStorage.getItem(ACTIVE_DRAFT_KEY);
      if (activeId && this.drafts.has(activeId)) {
        this.activeDraftId = activeId;
      }
    } catch (err) {
      console.warn("[OrderDraftManager] Erro ao carregar rascunhos:", err);
    }
  }

  // Salva rascunhos no localStorage
  saveToStorage() {
    try {
      if (!window.localStorage) return;

      const draftsArray = Array.from(this.drafts.values());
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(draftsArray));

      if (this.activeDraftId) {
        localStorage.setItem(ACTIVE_DRAFT_KEY, this.activeDraftId);
      } else {
        localStorage.removeItem(ACTIVE_DRAFT_KEY);
      }
    } catch (err) {
      console.warn("[OrderDraftManager] Erro ao salvar rascunhos:", err);
    }
  }

  // Gera ID Ãºnico para rascunho
  generateDraftId() {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cria novo rascunho
  createDraft(initialData = {}) {
    const draftId = this.generateDraftId();
    const now = new Date().toISOString();
    
    const draft = {
      id: draftId,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      ...initialData,
      // Garante campos bÃ¡sicos
      items: initialData.items || [],
      customerSnapshot: initialData.customerSnapshot || null,
      orderType: initialData.orderType || 'delivery',
      paymentMethod: initialData.paymentMethod || '',
      orderNotes: initialData.orderNotes || '',
      kitchenNotes: initialData.kitchenNotes || '',
      totals: initialData.totals || {
        subtotal: 0,
        deliveryFee: 0,
        discount: 0,
        finalTotal: 0
      }
    };

    this.drafts.set(draftId, draft);
    this.activeDraftId = draftId;
    this.saveToStorage();
    this.notifyListeners('draft-created', draft);
    return draft;
  }

  updateDraft(draftId, updates) {
    const existingDraft = this.drafts.get(draftId);
    if (!existingDraft) return null;

    const updatedDraft = {
      ...existingDraft,
      ...updates,
      id: draftId,
      updatedAt: new Date().toISOString(),
      _version: (existingDraft._version || 1) + 1
    };

    // Melhoria: OperaÃ§Ã£o em lote
    this.addToBatch({
      type: 'update',
      execute: () => {
        this.drafts.set(draftId, updatedDraft);
        this.setCache(`draft_${draftId}`, updatedDraft);
      }
    });

    this.notifyListeners('draft-updated', updatedDraft);
    return updatedDraft;
  }

  addToBatch(operation) {
    if (!operation || typeof operation.execute !== 'function') return;
    this.pendingOperations.push(operation);
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushBatch();
      }, this.batchDelay);
    }
  }

  flushBatch() {
    const operations = this.pendingOperations.splice(0, this.pendingOperations.length);
    this.batchTimeout = null;
    operations.forEach((operation) => {
      try {
        operation.execute();
      } catch (error) {
        console.error('Error executing batch operation:', error);
      }
    });
    this.saveToStorage();
  }

  setCache(key, value) {
    if (!key) return;
    this.cache.set(key, value);
  }

  loadDraftWithLazyLoading(draftId) {
    if (!draftId) return null;
    if (this.cache.has(`draft_${draftId}`)) {
      return this.cache.get(`draft_${draftId}`);
    }
    const draft = this.drafts.get(draftId) || null;
    if (draft) {
      this.cache.set(`draft_${draftId}`, draft);
    }
    return draft;
  }

  getDraft(draftId) {
    return this.loadDraftWithLazyLoading(draftId);
  }

  getAllDrafts() {
    return Array.from(this.drafts.values());
  }

  removeDraft(draftId) {
    // Melhoria: OperaÃ§Ã£o em lote
    this.addToBatch({
      type: 'remove',
      execute: () => {
        this.drafts.delete(draftId);
        this.cache.delete(`draft_${draftId}`);
        if (this.activeDraftId === draftId) {
          this.activeDraftId = null;
        }
      }
    });

    this.notifyListeners('draft-removed', { draftId });
  }

  clearAllDrafts() {
    const draftIds = Array.from(this.drafts.keys());
    
    // Melhoria: OperaÃ§Ã£o em lote
    this.addToBatch({
      type: 'clear',
      execute: () => {
        this.drafts.clear();
        this.cache.clear();
        this.activeDraftId = null;
      }
    });

    this.notifyListeners('all-drafts-cleared', { draftIds });
  }

  setActiveDraft(draftId) {
    const draft = this.drafts.get(draftId);
    if (draft) {
      this.activeDraftId = draftId;
      localStorage.setItem(this.activeDraftKey, draftId);
      this.notifyListeners('active-draft-changed', { draftId, draft });
    }
  }

  getActiveDraft() {
    if (this.activeDraftId) {
      return this.getDraft(this.activeDraftId);
    }
    return null;
  }

  // Melhoria: Salvamento otimizado
  saveToStorage() {
    const now = Date.now();
    
    // Evita salvamentos muito frequentes
    if (now - this.lastSaveTime < this.saveDebounceTime) {
      return;
    }
    
    this.lastSaveTime = now;
    
    try {
      const draftsArray = this.getAllDrafts();
      const compressed = this.compressData(draftsArray);
      
      localStorage.setItem(this.storageKey, compressed);
      
      if (this.activeDraftId) {
        localStorage.setItem(this.activeDraftKey, this.activeDraftId);
      }
    } catch (error) {
      console.error('Error saving drafts to storage:', error);
      // Melhoria: Fallback para armazenamento reduzido
      this.saveToStorageFallback();
    }
  }

  // Melhoria: CompressÃ£o de dados
  compressData(data) {
    try {
      // Remove campos desnecessÃ¡rios para economizar espaÃ§o
      const compressed = data.map(draft => {
        const { _version, _fullyLoaded, ...cleanDraft } = draft;
        return cleanDraft;
      });
      
      return JSON.stringify(compressed);
    } catch (error) {
      return JSON.stringify(data);
    }
  }

  // Melhoria: Fallback de armazenamento
  saveToStorageFallback() {
    try {
      const drafts = this.getAllDrafts().slice(0, 10); // Limita a 10 rascunhos
      localStorage.setItem(this.storageKey + '_fallback', JSON.stringify(drafts));
    } catch (error) {
      console.error('Fallback storage also failed:', error);
    }
  }

  loadFromStorage() {
    try {
      let stored = localStorage.getItem(this.storageKey);
      
      // Tenta fallback se principal falhar
      if (!stored) {
        stored = localStorage.getItem(this.storageKey + '_fallback');
      }
      
      if (stored) {
        const drafts = JSON.parse(stored);
        if (Array.isArray(drafts)) {
          drafts.forEach(draft => {
            this.drafts.set(draft.id, draft);
          });
        }
      }
      
      const activeDraftId = localStorage.getItem(this.activeDraftKey);
      if (activeDraftId && this.drafts.has(activeDraftId)) {
        this.activeDraftId = activeDraftId;
      }
    } catch (error) {
      console.error('Error loading drafts from storage:', error);
    }
  }

  // Melhoria: OperaÃ§Ãµes assÃ­ncronas com Web Worker
  async sortDrafts(drafts, sortBy) {
    if (this.worker) {
      return new Promise((resolve) => {
        const handler = (e) => {
          if (e.data.type === 'sorted') {
            this.worker.removeEventListener('message', handler);
            resolve(e.data.data);
          }
        };
        this.worker.addEventListener('message', handler);
        this.worker.postMessage({ type: 'sort', data: { drafts, sortBy } });
      });
    }
    
    // Fallback sÃ­ncrono
    return drafts.sort((a, b) => {
      switch (sortBy) {
        case 'updatedAt':
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        case 'total':
          return (b.totals.finalTotal || 0) - (a.totals.finalTotal || 0);
        default:
          return 0;
      }
    });
  }

  async filterDrafts(drafts, searchTerm) {
    if (this.worker) {
      return new Promise((resolve) => {
        const handler = (e) => {
          if (e.data.type === 'filtered') {
            this.worker.removeEventListener('message', handler);
            resolve(e.data.data);
          }
        };
        this.worker.addEventListener('message', handler);
        this.worker.postMessage({ type: 'filter', data: { drafts, searchTerm } });
      });
    }
    
    // Fallback sÃ­ncrono
    return drafts.filter(draft => 
      draft.customerSnapshot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      draft.items.some(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Melhoria: Otimistic updates
  optimisticUpdate(draftId, updates) {
    const currentDraft = this.getDraft(draftId);
    if (!currentDraft) return null;

    const optimisticDraft = { ...currentDraft, ...updates };
    
    // Atualiza imediatamente na UI
    this.setCache(`draft_${draftId}`, optimisticDraft);
    this.notifyListeners('draft-optimistic-updated', optimisticDraft);
    
    // Enfileira para persistÃªncia
    this.addToBatch({
      type: 'update',
      execute: () => {
        this.drafts.set(draftId, optimisticDraft);
      }
    });
    
    return optimisticDraft;
  }

  // Melhoria: Limpeza de memÃ³ria
  cleanup() {
    if (this.worker) {
      this.worker.terminate();
    }
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.cache.clear();
    this.listeners.clear();
    this.pendingOperations = [];
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in draft listener:', error);
      }
    });
  }

  // Melhoria: ConversÃ£o otimizada
  convertDraftToOrder(draftId) {
    const draft = this.getDraft(draftId);
    if (!draft) return null;

    const order = {
      ...draft,
      id: undefined, // SerÃ¡ gerado pelo backend
      status: 'open',
      createdAt: new Date().toISOString(),
      history: [{
        status: 'open',
        at: new Date().toISOString()
      }]
    };

    // Remove campos internos
    delete order._version;
    delete order._fullyLoaded;

    // Remove o rascunho apÃ³s conversÃ£o
    this.removeDraft(draftId);
    
    return order;
  }

  getDraftStats() {
    const drafts = this.getAllDrafts();
    const total = drafts.length;
    const byStatus = drafts.reduce((acc, draft) => {
      const status = draft.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    return {
      total,
      byStatus,
      activeDraftId: this.activeDraftId
    };
  }
}

// Melhoria: Singleton com lazy initialization
let instance = null;

export function getOrderDraftManager() {
  if (!instance) {
    instance = new OrderDraftManager();
  }
  return instance;
}

// Melhoria: Hook otimizado com memoizaÃ§Ã£o
export function useOrderDrafts() {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  const manager = getOrderDraftManager();
  
  const draftsRef = React.useRef(manager.getAllDrafts());
  const activeDraftIdRef = React.useRef(manager.activeDraftId);
  const drafts = draftsRef.current;
  const activeDraftId = activeDraftIdRef.current;
  
  React.useEffect(() => {
    const unsubscribe = manager.addListener((event, data) => {
      // Atualiza apenas se houver mudanÃ§a real
      const currentDrafts = manager.getAllDrafts();
      const currentActiveId = manager.activeDraftId;
      
      if (JSON.stringify(draftsRef.current) !== JSON.stringify(currentDrafts) ||
          activeDraftIdRef.current !== currentActiveId) {
        draftsRef.current = currentDrafts;
        activeDraftIdRef.current = currentActiveId;
        forceUpdate();
      }
    });

    return unsubscribe;
  }, []);

  return {
    drafts,
    activeDraftId,
    activeDraft: manager.getActiveDraft(),
    createDraft: manager.createDraft.bind(manager),
    updateDraft: manager.updateDraft.bind(manager),
    removeDraft: manager.removeDraft.bind(manager),
    setActiveDraft: manager.setActiveDraft.bind(manager),
    convertDraftToOrder: manager.convertDraftToOrder.bind(manager),
    clearAllDrafts: manager.clearAllDrafts.bind(manager),
    getDraftStats: manager.getDraftStats.bind(manager)
  };
}

export default OrderDraftManager;


