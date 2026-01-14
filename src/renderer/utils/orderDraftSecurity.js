// src/renderer/utils/orderDraftSecurity.js
// Melhorias de Segurança: Criptografia, validação, auditoria

// Crypto utilities
class DraftCrypto {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12;
    this.saltLength = 16;
  }

  // Gera chave derivada de senha
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Criptografa dados
  async encrypt(data, password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
    
    const key = await this.deriveKey(password, salt);
    const encrypted = await crypto.subtle.encrypt(
      { name: this.algorithm, iv },
      key,
      encoder.encode(JSON.stringify(data))
    );

    return {
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
      salt: Array.from(salt)
    };
  }

  // Descriptografa dados
  async decrypt(encryptedData, password) {
    const { encrypted, iv, salt } = encryptedData;
    
    const key = await this.deriveKey(password, new Uint8Array(salt));
    const decrypted = await crypto.subtle.decrypt(
      { name: this.algorithm, iv: new Uint8Array(iv) },
      key,
      new Uint8Array(encrypted)
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }
}

// Input sanitization
class DraftSanitizer {
  constructor() {
    this.allowedTags = ['p', 'br', 'strong', 'em', 'span'];
    this.allowedAttributes = ['class', 'id'];
    this.maxStringLength = 1000;
    this.maxItems = 50;
  }

  // Sanitiza string
  sanitizeString(input) {
    if (typeof input !== 'string') return '';
    
    // Remove caracteres perigosos
    const sanitized = input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .substring(0, this.maxStringLength);
    
    return sanitized.trim();
  }

  // Sanitiza objeto de rascunho
  sanitizeDraft(draft) {
    if (!draft || typeof draft !== 'object') return null;

    const sanitized = {
      id: this.sanitizeString(draft.id || ''),
      customerSnapshot: draft.customerSnapshot  {
        name: this.sanitizeString(draft.customerSnapshot.name || ''),
        phone: this.sanitizeString(draft.customerSnapshot.phone || ''),
        address: this.sanitizeString(draft.customerSnapshot.address || '')
      } : null,
      items: Array.isArray(draft.items) 
         draft.items.slice(0, this.maxItems).map(item => ({
            productName: this.sanitizeString(item.productName || ''),
            quantity: Math.max(0, Math.min(999, parseInt(item.quantity) || 0)),
            price: Math.max(0, parseFloat(item.price) || 0)
          }))
        : [],
      orderNotes: this.sanitizeString(draft.orderNotes || ''),
      kitchenNotes: this.sanitizeString(draft.kitchenNotes || ''),
      totals: {
        subtotal: Math.max(0, parseFloat(draft.totals.subtotal) || 0),
        deliveryFee: Math.max(0, parseFloat(draft.totals.deliveryFee) || 0),
        discount: Math.max(0, parseFloat(draft.totals.discount) || 0),
        finalTotal: Math.max(0, parseFloat(draft.totals.finalTotal) || 0)
      },
      createdAt: draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft'
    };

    return sanitized;
  }

  // Valida estrutura de dados
  validateDraftStructure(draft) {
    const errors = [];

    if (!draft.id || typeof draft.id !== 'string') {
      errors.push('ID inválido');
    }

    if (!Array.isArray(draft.items)) {
      errors.push('Items deve ser um array');
    }

    if (draft.items && draft.items.length > this.maxItems) {
      errors.push(`Número máximo de itens excedido (${this.maxItems})`);
    }

    if (draft.customerSnapshot && typeof draft.customerSnapshot !== 'object') {
      errors.push('Customer snapshot inválido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Rate limiting
class DraftRateLimiter {
  constructor() {
    this.limits = new Map();
    this.defaultLimit = {
      requests: 100,
      window: 60000 // 1 minuto
    };
  }

  // Verifica se requisição é permitida
  isAllowed(key, customLimit = null) {
    const limit = customLimit || this.defaultLimit;
    const now = Date.now();
    const windowStart = now - limit.window;

    if (!this.limits.has(key)) {
      this.limits.set(key, []);
    }

    const requests = this.limits.get(key);
    
    // Remove requisições antigas
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    this.limits.set(key, validRequests);

    // Verifica limite
    if (validRequests.length >= limit.requests) {
      return false;
    }

    // Adiciona requisição atual
    validRequests.push(now);
    return true;
  }

  // Limpa registros antigos
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.defaultLimit.window;

    for (const [key, requests] of this.limits.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      if (validRequests.length === 0) {
        this.limits.delete(key);
      } else {
        this.limits.set(key, validRequests);
      }
    }
  }
}

// Audit trail
class DraftAuditLogger {
  constructor() {
    this.events = [];
    this.maxEvents = 1000;
    this.storageKey = 'draftAuditTrail';
    this.loadEvents();
  }

  // Registra evento de auditoria
  log(event, data, userId = null) {
    const auditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      event,
      data: this.sanitizeAuditData(data),
      userId: userId || 'anonymous',
      userAgent: navigator.userAgent,
      ip: this.getClientIP()
    };

    this.events.push(auditEvent);
    
    // Limita tamanho do log
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    this.saveEvents();
    return auditEvent;
  }

  // Sanitiza dados de auditoria
  sanitizeAuditData(data) {
    if (!data) return null;

    const sanitized = { ...data };
    
    // Remove informações sensíveis
    if (sanitized.password) delete sanitized.password;
    if (sanitized.creditCard) delete sanitized.creditCard;
    if (sanitized.ssn) delete sanitized.ssn;
    
    return sanitized;
  }

  // Gera ID único para evento
  generateEventId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Obtém IP do cliente (simulado)
  getClientIP() {
    // Em produção, isso viria do servidor
    return 'client-ip';
  }

  // Salva eventos no storage
  saveEvents() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch (error) {
      console.error('Error saving audit events:', error);
    }
  }

  // Carrega eventos do storage
  loadEvents() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading audit events:', error);
      this.events = [];
    }
  }

  // Busca eventos por critérios
  query(criteria = {}) {
    let filtered = [...this.events];

    if (criteria.event) {
      filtered = filtered.filter(e => e.event === criteria.event);
    }

    if (criteria.userId) {
      filtered = filtered.filter(e => e.userId === criteria.userId);
    }

    if (criteria.startDate) {
      const start = new Date(criteria.startDate);
      filtered = filtered.filter(e => new Date(e.timestamp) >= start);
    }

    if (criteria.endDate) {
      const end = new Date(criteria.endDate);
      filtered = filtered.filter(e => new Date(e.timestamp) <= end);
    }

    return filtered;
  }

  // Limpa eventos antigos
  cleanup(olderThanDays = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    this.events = this.events.filter(e => new Date(e.timestamp) > cutoff);
    this.saveEvents();
  }
}

// Session management
class DraftSessionManager {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutos
    this.maxSessions = 10;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // 1 minuto
  }

  // Cria nova sessão
  createSession(userId) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      data: {}
    };

    this.sessions.set(sessionId, session);
    
    // Limita número de sessões
    if (this.sessions.size > this.maxSessions) {
      this.removeOldestSession();
    }

    return session;
  }

  // Obtém sessão
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      return session;
    }
    return null;
  }

  // Remove sessão
  removeSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  // Limpa sessões expiradas
  cleanup() {
    const now = Date.now();
    const expired = [];

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        expired.push(id);
      }
    }

    expired.forEach(id => this.sessions.delete(id));
  }

  // Remove sessão mais antiga
  removeOldestSession() {
    let oldestId = null;
    let oldestTime = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      if (session.createdAt < oldestTime) {
        oldestTime = session.createdAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.sessions.delete(oldestId);
    }
  }

  // Gera ID de sessão
  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Destrói manager
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}

// Access control
class DraftAccessControl {
  constructor() {
    this.permissions = new Map();
    this.roles = new Map();
    this.setupDefaultRoles();
  }

  // Configura roles padrão
  setupDefaultRoles() {
    this.roles.set('admin', ['create', 'read', 'update', 'delete', 'manage_users']);
    this.roles.set('manager', ['create', 'read', 'update', 'delete']);
    this.roles.set('employee', ['create', 'read', 'update']);
    this.roles.set('viewer', ['read']);
  }

  // Adiciona permissão para usuário
  addPermission(userId, permission) {
    if (!this.permissions.has(userId)) {
      this.permissions.set(userId, new Set());
    }
    this.permissions.get(userId).add(permission);
  }

  // Remove permissão de usuário
  removePermission(userId, permission) {
    const userPermissions = this.permissions.get(userId);
    if (userPermissions) {
      userPermissions.delete(permission);
    }
  }

  // Verifica se usuário tem permissão
  hasPermission(userId, permission) {
    const userPermissions = this.permissions.get(userId);
    return userPermissions && userPermissions.has(permission);
  }

  // Adiciona role ao usuário
  addRole(userId, role) {
    const rolePermissions = this.roles.get(role);
    if (rolePermissions) {
      if (!this.permissions.has(userId)) {
        this.permissions.set(userId, new Set());
      }
      rolePermissions.forEach(permission => {
        this.permissions.get(userId).add(permission);
      });
    }
  }

  // Remove role do usuário
  removeRole(userId, role) {
    const rolePermissions = this.roles.get(role);
    if (rolePermissions) {
      const userPermissions = this.permissions.get(userId);
      if (userPermissions) {
        rolePermissions.forEach(permission => {
          userPermissions.delete(permission);
        });
      }
    }
  }
}

// Security headers generator
class DraftSecurityHeaders {
  static generateHeaders() {
    return {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
  }
}

// Main security manager
class DraftSecurityManager {
  constructor() {
    this.crypto = new DraftCrypto();
    this.sanitizer = new DraftSanitizer();
    this.rateLimiter = new DraftRateLimiter();
    this.auditLogger = new DraftAuditLogger();
    this.sessionManager = new DraftSessionManager();
    this.accessControl = new DraftAccessControl();
    
    this.setupSecurityMonitoring();
  }

  // Setup monitoramento de segurança
  setupSecurityMonitoring() {
    // Monitora tentativas de acesso suspeitas
    setInterval(() => {
      this.rateLimiter.cleanup();
      this.auditLogger.cleanup();
    }, 300000); // 5 minutos
  }

  // Criptografa rascunho
  async encryptDraft(draft, password) {
    try {
      const sanitizedDraft = this.sanitizer.sanitizeDraft(draft);
      const validation = this.sanitizer.validateDraftStructure(sanitizedDraft);
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const encrypted = await this.crypto.encrypt(sanitizedDraft, password);
      
      this.auditLogger.log('draft_encrypted', { draftId: draft.id });
      
      return encrypted;
    } catch (error) {
      this.auditLogger.log('encryption_failed', { draftId: draft.id, error: error.message });
      throw error;
    }
  }

  // Descriptografa rascunho
  async decryptDraft(encryptedData, password) {
    try {
      const decrypted = await this.crypto.decrypt(encryptedData, password);
      const sanitized = this.sanitizer.sanitizeDraft(decrypted);
      
      this.auditLogger.log('draft_decrypted', { draftId: sanitized.id });
      
      return sanitized;
    } catch (error) {
      this.auditLogger.log('decryption_failed', { error: error.message });
      throw error;
    }
  }

  // Verifica rate limiting
  checkRateLimit(userId, action) {
    const key = `${userId}:${action}`;
    const isAllowed = this.rateLimiter.isAllowed(key);
    
    if (!isAllowed) {
      this.auditLogger.log('rate_limit_exceeded', { userId, action });
    }
    
    return isAllowed;
  }

  // Verifica permissão
  checkPermission(userId, permission) {
    const hasPermission = this.accessControl.hasPermission(userId, permission);
    
    if (!hasPermission) {
      this.auditLogger.log('access_denied', { userId, permission });
    }
    
    return hasPermission;
  }

  // Cria sessão segura
  createSecureSession(userId) {
    const session = this.sessionManager.createSession(userId);
    this.auditLogger.log('session_created', { sessionId: session.id, userId });
    return session;
  }

  // Valida sessão
  validateSession(sessionId) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      this.auditLogger.log('invalid_session', { sessionId });
    }
    return session;
  }

  // Sanitiza entrada
  sanitizeInput(input, type = 'string') {
    switch (type) {
      case 'draft':
        return this.sanitizer.sanitizeDraft(input);
      case 'string':
        return this.sanitizer.sanitizeString(input);
      default:
        return input;
    }
  }

  // Obtém logs de auditoria
  getAuditLogs(criteria = {}) {
    return this.auditLogger.query(criteria);
  }

  // Limpa recursos
  cleanup() {
    this.sessionManager.destroy();
    this.rateLimiter.cleanup();
    this.auditLogger.cleanup();
  }
}

export {
  DraftSecurityManager,
  DraftCrypto,
  DraftSanitizer,
  DraftRateLimiter,
  DraftAuditLogger,
  DraftSessionManager,
  DraftAccessControl,
  DraftSecurityHeaders
};

export default DraftSecurityManager;
