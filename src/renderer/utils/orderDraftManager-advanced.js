// src/renderer/utils/orderDraftManager-advanced.js
// Melhorias de Arquitetura: Event-driven, state machine, dependency injection

// Event-driven architecture
class DraftEventBus {
  constructor() {
    this.listeners = new Map();
    this.middlewares = [];
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }

  // Middleware system
  use(middleware) {
    this.middlewares.push(middleware);
  }

  // Event emission with middleware pipeline
  async emit(event, data) {
    const eventData = {
      type: event,
      data,
      timestamp: Date.now(),
      id: this.generateEventId()
    };

    // Add to history
    this.eventHistory.push(eventData);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Run middleware pipeline
    let processedData = data;
    for (const middleware of this.middlewares) {
      try {
        processedData = await middleware(event, processedData);
      } catch (error) {
        console.error('Middleware error:', error);
      }
    }

    // Notify listeners
    const listeners = this.listeners.get(event) || [];
    await Promise.allSettled(
      listeners.map(listener => 
        Promise.resolve().then(() => listener(processedData))
      )
    );

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*') || [];
    await Promise.allSettled(
      wildcardListeners.map(listener => 
        Promise.resolve().then(() => listener(event, processedData))
      )
    );

    return eventData;
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  once(event, listener) {
    const onceListener = (data) => {
      listener(data);
      this.off(event, onceListener);
    };
    this.on(event, onceListener);
  }

  getEventHistory(eventType = null) {
    return eventType 
       this.eventHistory.filter(e => e.type === eventType)
      : this.eventHistory;
  }

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  clear() {
    this.listeners.clear();
    this.middlewares = [];
    this.eventHistory = [];
  }
}

// State Machine para gerenciamento de rascunhos
class DraftStateMachine {
  constructor() {
    this.states = {
      IDLE: 'idle',
      CREATING: 'creating', 
      EDITING: 'editing',
      SAVING: 'saving',
      LOADING: 'loading',
      ERROR: 'error',
      DELETING: 'deleting'
    };
    
    this.currentState = this.states.IDLE;
    this.transitions = this.setupTransitions();
    this.stateHistory = [];
    this.eventBus = new DraftEventBus();
  }

  setupTransitions() {
    return {
      [this.states.IDLE]: {
        create: this.states.CREATING,
        edit: this.states.EDITING,
        load: this.states.LOADING,
        delete: this.states.DELETING
      },
      [this.states.CREATING]: {
        save: this.states.SAVING,
        cancel: this.states.IDLE,
        error: this.states.ERROR
      },
      [this.states.EDITING]: {
        save: this.states.SAVING,
        cancel: this.states.IDLE,
        delete: this.states.DELETING,
        error: this.states.ERROR
      },
      [this.states.SAVING]: {
        success: this.states.IDLE,
        error: this.states.ERROR
      },
      [this.states.LOADING]: {
        success: this.states.IDLE,
        error: this.states.ERROR
      },
      [this.states.DELETING]: {
        success: this.states.IDLE,
        error: this.states.ERROR
      },
      [this.states.ERROR]: {
        retry: this.states.IDLE,
        clear: this.states.IDLE
      }
    };
  }

  async transition(action, data = null) {
    const currentStateTransitions = this.transitions[this.currentState];
    const nextState = currentStateTransitions.[action];
    
    if (!nextState) {
      throw new Error(`Invalid transition: ${action} from ${this.currentState}`);
    }

    const previousState = this.currentState;
    this.currentState = nextState;
    
    this.stateHistory.push({
      from: previousState,
      to: nextState,
      action,
      data,
      timestamp: Date.now()
    });

    await this.eventBus.emit('state-change', {
      from: previousState,
      to: nextState,
      action,
      data
    });

    return nextState;
  }

  canTransition(action) {
    return action in (this.transitions[this.currentState] || {});
  }

  getCurrentState() {
    return this.currentState;
  }

  getStateHistory() {
    return this.stateHistory;
  }
}

// Dependency Injection Container
class DraftDIContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
  }

  register(name, factory, options = {}) {
    if (options.singleton) {
      this.singletons.set(name, factory);
    } else {
      this.factories.set(name, factory);
    }
  }

  get(name) {
    // Check singleton cache first
    if (this.singletons.has(name)) {
      if (!this.services.has(name)) {
        const factory = this.singletons.get(name);
        this.services.set(name, factory(this));
      }
      return this.services.get(name);
    }

    // Check factories
    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      return factory(this);
    }

    throw new Error(`Service ${name} not found`);
  }

  has(name) {
    return this.singletons.has(name) || this.factories.has(name);
  }

  clear() {
    this.services.clear();
    this.singletons.clear();
    this.factories.clear();
  }
}

// Repository Pattern
class DraftRepository {
  constructor(storage, eventBus) {
    this.storage = storage;
    this.eventBus = eventBus;
  }

  async findById(id) {
    try {
      const draft = await this.storage.get(id);
      await this.eventBus.emit('draft-retrieved', { id, draft });
      return draft;
    } catch (error) {
      await this.eventBus.emit('draft-retrieval-error', { id, error });
      throw error;
    }
  }

  async findAll() {
    try {
      const drafts = await this.storage.getAll();
      await this.eventBus.emit('drafts-retrieved', { drafts });
      return drafts;
    } catch (error) {
      await this.eventBus.emit('drafts-retrieval-error', { error });
      throw error;
    }
  }

  async save(draft) {
    try {
      const savedDraft = await this.storage.set(draft.id, draft);
      await this.eventBus.emit('draft-saved', { draft: savedDraft });
      return savedDraft;
    } catch (error) {
      await this.eventBus.emit('draft-save-error', { draft, error });
      throw error;
    }
  }

  async delete(id) {
    try {
      await this.storage.delete(id);
      await this.eventBus.emit('draft-deleted', { id });
    } catch (error) {
      await this.eventBus.emit('draft-deletion-error', { id, error });
      throw error;
    }
  }

  async clear() {
    try {
      await this.storage.clear();
      await this.eventBus.emit('drafts-cleared', {});
    } catch (error) {
      await this.eventBus.emit('drafts-clear-error', { error });
      throw error;
    }
  }
}

// Command Pattern
class DraftCommand {
  constructor(type, data, repository, eventBus) {
    this.type = type;
    this.data = data;
    this.repository = repository;
    this.eventBus = eventBus;
    this.timestamp = Date.now();
    this.id = this.generateCommandId();
  }

  generateCommandId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async execute() {
    throw new Error('Execute method must be implemented');
  }

  async undo() {
    throw new Error('Undo method must be implemented');
  }
}

class CreateDraftCommand extends DraftCommand {
  async execute() {
    const draft = await this.repository.save(this.data);
    await this.eventBus.emit('command-executed', { 
      command: this, 
      result: draft 
    });
    return draft;
  }

  async undo() {
    await this.repository.delete(this.data.id);
    await this.eventBus.emit('command-undone', { command: this });
  }
}

class UpdateDraftCommand extends DraftCommand {
  constructor(type, data, repository, eventBus, previousState) {
    super(type, data, repository, eventBus);
    this.previousState = previousState;
  }

  async execute() {
    const draft = await this.repository.save(this.data);
    await this.eventBus.emit('command-executed', { 
      command: this, 
      result: draft 
    });
    return draft;
  }

  async undo() {
    if (this.previousState) {
      await this.repository.save(this.previousState);
    }
    await this.eventBus.emit('command-undone', { command: this });
  }
}

class DeleteDraftCommand extends DraftCommand {
  constructor(type, data, repository, eventBus, deletedDraft) {
    super(type, data, repository, eventBus);
    this.deletedDraft = deletedDraft;
  }

  async execute() {
    await this.repository.delete(this.data.id);
    await this.eventBus.emit('command-executed', { 
      command: this, 
      result: null 
    });
  }

  async undo() {
    if (this.deletedDraft) {
      await this.repository.save(this.deletedDraft);
    }
    await this.eventBus.emit('command-undone', { command: this });
  }
}

// Command Invoker
class DraftCommandInvoker {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = 50;
  }

  async execute(command) {
    try {
      const result = await command.execute();
      
      // Clear redo history
      this.history = this.history.slice(0, this.currentIndex + 1);
      this.history.push(command);
      
      // Limit history size
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      } else {
        this.currentIndex++;
      }
      
      await this.eventBus.emit('command-executed', { command, result });
      return result;
    } catch (error) {
      await this.eventBus.emit('command-execution-error', { command, error });
      throw error;
    }
  }

  async undo() {
    if (this.canUndo()) {
      const command = this.history[this.currentIndex];
      await command.undo();
      this.currentIndex--;
      
      await this.eventBus.emit('command-undone', { command });
      return true;
    }
    return false;
  }

  async redo() {
    if (this.canRedo()) {
      const command = this.history[this.currentIndex + 1];
      await command.execute();
      this.currentIndex++;
      
      await this.eventBus.emit('command-redone', { command });
      return true;
    }
    return false;
  }

  canUndo() {
    return this.currentIndex >= 0;
  }

  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  getHistory() {
    return this.history;
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
  }
}

// Advanced Draft Manager com arquitetura melhorada
class AdvancedOrderDraftManager {
  constructor(container) {
    this.container = container;
    this.stateMachine = new DraftStateMachine();
    this.eventBus = container.get('eventBus');
    this.repository = container.get('repository');
    this.commandInvoker = container.get('commandInvoker');
    
    this.setupEventHandlers();
    this.setupMiddlewares();
  }

  setupEventHandlers() {
    this.eventBus.on('state-change', this.handleStateChange.bind(this));
    this.eventBus.on('error', this.handleError.bind(this));
  }

  setupMiddlewares() {
    // Logging middleware
    this.eventBus.use(async (event, data) => {
      console.log(`[DraftManager] Event: ${event}`, data);
      return data;
    });

    // Validation middleware
    this.eventBus.use(async (event, data) => {
      if (event.startsWith('draft-')) {
        this.validateDraftData(data);
      }
      return data;
    });

    // Performance monitoring middleware
    this.eventBus.use(async (event, data) => {
      const start = performance.now();
      return data;
    });
  }

  validateDraftData(data) {
    if (data.draft && !data.draft.id) {
      throw new Error('Draft must have an ID');
    }
  }

  async handleStateChange(stateChange) {
    console.log('State changed:', stateChange);
  }

  async handleError(error) {
    console.error('Draft manager error:', error);
    await this.stateMachine.transition('error', error);
  }

  async createDraft(initialData = {}) {
    await this.stateMachine.transition('create');
    
    try {
      const draftId = this.generateDraftId();
      const draft = {
        id: draftId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        ...initialData
      };

      const command = new CreateDraftCommand('create', draft, this.repository, this.eventBus);
      const result = await this.commandInvoker.execute(command);
      
      await this.stateMachine.transition('save');
      await this.stateMachine.transition('success');
      
      return result;
    } catch (error) {
      await this.stateMachine.transition('error', error);
      throw error;
    }
  }

  async updateDraft(draftId, updates) {
    await this.stateMachine.transition('edit');
    
    try {
      const currentDraft = await this.repository.findById(draftId);
      const updatedDraft = {
        ...currentDraft,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const command = new UpdateDraftCommand('update', updatedDraft, this.repository, this.eventBus, currentDraft);
      const result = await this.commandInvoker.execute(command);
      
      await this.stateMachine.transition('save');
      await this.stateMachine.transition('success');
      
      return result;
    } catch (error) {
      await this.stateMachine.transition('error', error);
      throw error;
    }
  }

  async deleteDraft(draftId) {
    await this.stateMachine.transition('delete');
    
    try {
      const draft = await this.repository.findById(draftId);
      const command = new DeleteDraftCommand('delete', { id: draftId }, this.repository, this.eventBus, draft);
      await this.commandInvoker.execute(command);
      
      await this.stateMachine.transition('success');
    } catch (error) {
      await this.stateMachine.transition('error', error);
      throw error;
    }
  }

  async undo() {
    return await this.commandInvoker.undo();
  }

  async redo() {
    return await this.commandInvoker.redo();
  }

  canUndo() {
    return this.commandInvoker.canUndo();
  }

  canRedo() {
    return this.commandInvoker.canRedo();
  }

  generateDraftId() {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getState() {
    return {
      currentState: this.stateMachine.getCurrentState(),
      stateHistory: this.stateMachine.getStateHistory(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      commandHistory: this.commandInvoker.getHistory()
    };
  }

  async cleanup() {
    this.eventBus.clear();
    this.stateMachine.eventBus.clear();
    this.commandInvoker.clear();
  }
}

// Factory function para setup do container
function createDraftContainer() {
  const container = new DraftDIContainer();
  
  // Register services
  container.register('eventBus', () => new DraftEventBus(), { singleton: true });
  container.register('storage', () => new LocalStorageDraftStorage(), { singleton: true });
  container.register('repository', (c) => new DraftRepository(c.get('storage'), c.get('eventBus')), { singleton: true });
  container.register('commandInvoker', (c) => new DraftCommandInvoker(c.get('eventBus')), { singleton: true });
  
  return container;
}

// Local Storage implementation
class LocalStorageDraftStorage {
  constructor() {
    this.storageKey = 'orderDraftsV2';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async get(id) {
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const all = await this.getAll();
    const draft = all.find(d => d.id === id);
    
    if (draft) {
      this.cache.set(id, { data: draft, timestamp: Date.now() });
    }
    
    return draft;
  }

  async getAll() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored  JSON.parse(stored) : [];
    } catch (error) {
      console.error('Storage error:', error);
      return [];
    }
  }

  async set(id, data) {
    const all = await this.getAll();
    const index = all.findIndex(d => d.id === id);
    
    if (index >= 0) {
      all[index] = data;
    } else {
      all.push(data);
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(all));
    this.cache.set(id, { data, timestamp: Date.now() });
    
    return data;
  }

  async delete(id) {
    const all = await this.getAll();
    const filtered = all.filter(d => d.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    this.cache.delete(id);
  }

  async clear() {
    localStorage.removeItem(this.storageKey);
    this.cache.clear();
  }
}

export {
  AdvancedOrderDraftManager,
  DraftEventBus,
  DraftStateMachine,
  DraftDIContainer,
  DraftRepository,
  DraftCommandInvoker,
  createDraftContainer
};

export default AdvancedOrderDraftManager;
