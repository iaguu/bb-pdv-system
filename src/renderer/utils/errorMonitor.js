// src/renderer/utils/errorMonitor.js
class ErrorMonitor {
  constructor() {
    this.errors = [];
    this.maxErrors = 50;
    this.criticalErrors = [
      'ChunkLoadError',
      'Loading CSS chunk',
      'Failed to fetch dynamically imported module',
      'Network Error',
      'TypeError: Cannot read prop',
      'ReferenceError: window is not defined',
      'SyntaxError',
      'Unexpected token',
      'Cannot access property',
      'Cannot read property',
      'is not a function'
    ];
    
    this.init();
  }

  init() {
    // Capturar erros não tratados globalmente
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Monitorar recursos que falharam
    window.addEventListener('error', this.handleResourceError.bind(this), true);
    
    // Verificar erros anteriores
    this.loadStoredErrors();
    
    // Limpar erros antigos periodicamente
    setInterval(() => this.cleanupOldErrors(), 60000); // 1 minuto
  }

  handleGlobalError(event) {
    const error = {
      type: 'javascript',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      page: window.location.pathname
    };

    this.logError(error);
    
    // Reiniciar automaticamente se for erro crítico
    if (this.isCriticalError(error)) {
      this.handleCriticalError(error);
    }
  }

  handleUnhandledRejection(event) {
    const error = {
      type: 'promise_rejection',
      message: event.reason?.message || event.reason || 'Unhandled Promise Rejection',
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      page: window.location.pathname
    };

    this.logError(error);
    
    if (this.isCriticalError(error)) {
      this.handleCriticalError(error);
    }
  }

  handleResourceError(event) {
    if (event.target !== window) {
      const error = {
        type: 'resource',
        message: `Failed to load resource: ${event.target.src || event.target.href}`,
        resource: event.target.src || event.target.href,
        resourceType: event.target.tagName,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        page: window.location.pathname
      };

      this.logError(error);
    }
  }

  isCriticalError(error) {
    return this.criticalErrors.some(criticalError => 
      error.message && error.message.includes(criticalError)
    );
  }

  logError(error) {
    console.error('🚨 ErrorMonitor:', error);
    
    this.errors.push(error);
    
    // Manter apenas os erros mais recentes
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
    
    // Salvar no localStorage
    this.saveErrors();
    
    // Disparar evento para outros componentes
    window.dispatchEvent(new CustomEvent('appError', { detail: error }));
  }

  handleCriticalError(error) {
    console.warn('🔄 Critical error detected, attempting recovery...');
    
    // Tentar recuperação automática
    setTimeout(() => {
      this.attemptRecovery();
    }, 2000);
  }

  attemptRecovery() {
    const recentErrors = this.errors.slice(-5); // Últimos 5 erros
    const criticalCount = recentErrors.filter(e => this.isCriticalError(e)).length;
    
    if (criticalCount >= 3) {
      console.log('🔄 Multiple critical errors detected, forcing restart...');
      this.forceRestart();
    } else {
      console.log('🔄 Attempting soft recovery...');
      this.softRecovery();
    }
  }

  forceRestart() {
    // Limpar caches e dados corrompidos
    try {
      localStorage.setItem('forceRestart', Date.now().toString());
      
      // Limpar caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      
      // Limpar sessionStorage
      sessionStorage.clear();
    } catch (e) {
      console.warn('Failed to prepare restart:', e);
    }
    
    // Forçar reload completo
    window.location.reload(true);
  }

  softRecovery() {
    try {
      // Tentar limpar dados problemáticos
      const keysToRemove = ['appErrorLogs', 'errorLogs', 'corruptedData'];
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key}:`, e);
        }
      });
      
      // Recarregar componentes específicos
      window.dispatchEvent(new CustomEvent('softRecovery'));
    } catch (e) {
      console.warn('Soft recovery failed:', e);
      this.forceRestart();
    }
  }

  saveErrors() {
    try {
      const errorData = {
        errors: this.errors.slice(-20), // Últimos 20 erros
        lastSaved: new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem('errorMonitorData', JSON.stringify(errorData));
    } catch (e) {
      console.warn('Failed to save error monitor data:', e);
    }
  }

  loadStoredErrors() {
    try {
      const stored = localStorage.getItem('errorMonitorData');
      if (stored) {
        const data = JSON.parse(stored);
        this.errors = data.errors || [];
        console.log(`📋 Loaded ${this.errors.length} previous errors`);
      }
    } catch (e) {
      console.warn('Failed to load stored errors:', e);
    }
  }

  cleanupOldErrors() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.errors = this.errors.filter(error => {
      return new Date(error.timestamp).getTime() > oneHourAgo;
    });
    
    this.saveErrors();
  }

  getErrorStats() {
    const last24Hours = this.errors.filter(error => {
      return new Date(error.timestamp).getTime() > (Date.now() - 24 * 60 * 60 * 1000);
    });
    
    const errorTypes = {};
    last24Hours.forEach(error => {
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
    });
    
    return {
      total: this.errors.length,
      last24Hours: last24Hours.length,
      types: errorTypes,
      critical: last24Hours.filter(e => this.isCriticalError(e)).length
    };
  }

  clearErrors() {
    this.errors = [];
    try {
      localStorage.removeItem('errorMonitorData');
      localStorage.removeItem('appErrorLogs');
      localStorage.removeItem('errorLogs');
    } catch (e) {
      console.warn('Failed to clear errors:', e);
    }
  }
}

// Criar instância global
window.errorMonitor = new ErrorMonitor();

export default window.errorMonitor;
