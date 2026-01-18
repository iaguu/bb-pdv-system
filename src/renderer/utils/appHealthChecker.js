// src/renderer/utils/appHealthChecker.js
class AppHealthChecker {
  constructor() {
    this.healthChecks = [];
    this.isHealthy = true;
    this.lastCheck = Date.now();
    this.checkInterval = 30000; // 30 segundos
    this.criticalErrors = 0;
    this.maxCriticalErrors = 5;
    
    this.init();
  }

  init() {
    // Adicionar verificações de saúde
    this.addHealthCheck('DOM', this.checkDOMHealth.bind(this));
    this.addHealthCheck('CSS', this.checkCSSHealth.bind(this));
    this.addHealthCheck('JavaScript', this.checkJSHealth.bind(this));
    this.addHealthCheck('Performance', this.checkPerformance.bind(this));
    this.addHealthCheck('Memory', this.checkMemory.bind(this));
    this.addHealthCheck('Network', this.checkNetwork.bind(this));
    
    // Iniciar verificações periódicas
    this.startHealthChecks();
    
    // Verificar saúde inicial
    setTimeout(() => this.runAllHealthChecks(), 2000);
    
    // Adicionar listeners para eventos de erro
    this.setupErrorListeners();
  }

  addHealthCheck(name, checkFunction) {
    this.healthChecks.push({
      name,
      check: checkFunction,
      lastResult: null,
      consecutiveFailures: 0
    });
  }

  setupErrorListeners() {
    // Capturar erros globais
    window.addEventListener('error', (event) => {
      this.criticalErrors++;
      console.error(`Health Checker: Critical error #${this.criticalErrors}`, event.error);
      
      if (this.criticalErrors >= this.maxCriticalErrors) {
        this.handleCriticalFailure();
      }
    });

    // Capturar rejeições não tratadas
    window.addEventListener('unhandledrejection', (event) => {
      this.criticalErrors++;
      console.error(`Health Checker: Critical rejection #${this.criticalErrors}`, event.reason);
      
      if (this.criticalErrors >= this.maxCriticalErrors) {
        this.handleCriticalFailure();
      }
    });
  }

  handleCriticalFailure() {
    console.warn('🚨 Critical failure threshold reached, attempting recovery...');
    
    // Parar verificações automáticas
    this.stopHealthChecks();
    
    // Tentar recuperação
    setTimeout(() => {
      this.attemptRecovery();
    }, 1000);
  }

  attemptRecovery() {
    const recoveryAttempts = parseInt(localStorage.getItem('recoveryAttempts') || '0');
    
    if (recoveryAttempts < 3) {
      // Tentar recuperação suave
      localStorage.setItem('recoveryAttempts', (recoveryAttempts + 1).toString());
      
      // Limpar caches problemáticos
      this.clearProblematicData();
      
      // Recarregar página
      window.location.reload(true);
    } else {
      // Forçar reinicialização completa
      console.warn('🔄 Multiple recovery attempts failed, forcing hard restart...');
      this.forceHardRestart();
    }
  }

  clearProblematicData() {
    const problematicKeys = [
      'appErrorLogs',
      'errorLogs',
      'corruptedData',
      'failedRequests',
      'staleData'
    ];
    
    problematicKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key}:`, e);
      }
    });
  }

  forceHardRestart() {
    // Limpar tudo
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      // Limpar caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
    
    // Forçar reload com timestamp para evitar cache
    const timestamp = Date.now();
    window.location.href = `${window.location.pathname}?_hard_restart=${timestamp}`;
  }

  startHealthChecks() {
    this.healthCheckInterval = setInterval(() => {
      this.runAllHealthChecks();
    }, this.checkInterval);
  }

  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  runAllHealthChecks() {
    let overallHealthy = true;
    
    this.healthChecks.forEach(healthCheck => {
      try {
        const result = healthCheck.check();
        healthCheck.lastResult = result;
        
        if (!result.healthy) {
          healthCheck.consecutiveFailures++;
          overallHealthy = false;
          
          // Se falhar 3 vezes consecutivas, marcar como problema
          if (healthCheck.consecutiveFailures >= 3) {
            console.warn(`Health check failed: ${healthCheck.name}`, result);
            this.handleHealthIssue(healthCheck.name, result);
          }
        } else {
          healthCheck.consecutiveFailures = 0;
        }
      } catch (e) {
        console.error(`Health check error for ${healthCheck.name}:`, e);
        healthCheck.consecutiveFailures++;
        overallHealthy = false;
      }
    });
    
    this.isHealthy = overallHealthy;
    this.lastCheck = Date.now();
    
    // Atualizar UI com status de saúde
    this.updateHealthStatus(overallHealthy);
    
    // Disparar evento
    window.dispatchEvent(new CustomEvent('healthCheck', {
      detail: {
        healthy: overallHealthy,
        checks: this.healthChecks.map(hc => ({
          name: hc.name,
          healthy: hc.lastResult?.healthy || false,
          issues: hc.lastResult?.issues || []
        }))
      }
    }));
  }

  updateHealthStatus(healthy) {
    // Feedback visual desativado para evitar popups de erro
    // O monitoramento continua rodando em background
  }

  handleHealthIssue(checkName, result) {
    console.warn(`Health issue detected in ${checkName}:`, result);
    
    // Salvar problema para análise
    try {
      const issues = JSON.parse(localStorage.getItem('healthIssues') || '[]');
      issues.push({
        timestamp: new Date().toISOString(),
        check: checkName,
        issues: result.issues,
        severity: result.severity || 'warning'
      });
      
      // Manter apenas últimos 20 problemas
      if (issues.length > 20) {
        issues.splice(0, issues.length - 20);
      }
      
      localStorage.setItem('healthIssues', JSON.stringify(issues));
    } catch (e) {
      console.warn('Failed to save health issues:', e);
    }
  }

  // Métodos de verificação de saúde
  checkDOMHealth() {
    const issues = [];
    let healthy = true;
    
    // Verificar elementos críticos
    const criticalElements = document.querySelectorAll('h1, h2, h3, button, [role="button"], input');
    if (criticalElements.length === 0) {
      issues.push('Nenhum elemento crítico encontrado');
      healthy = false;
    }
    
    // Verificar se o body está acessível
    if (document.body && document.body.children.length === 0) {
      issues.push('Body vazio ou inacessível');
      healthy = false;
    }
    
    return { healthy, issues, severity: healthy ? 'ok' : 'critical' };
  }

  checkCSSHealth() {
    const issues = [];
    let healthy = true;
    
    // Verificar se CSS foi carregado
    const testElement = document.createElement('div');
    testElement.style.display = 'flex';
    document.body.appendChild(testElement);
    
    const computedStyle = getComputedStyle(testElement);
    if (computedStyle.display !== 'flex') {
      issues.push('CSS não aplicado corretamente');
      healthy = false;
    }
    
    document.body.removeChild(testElement);
    
    return { healthy, issues, severity: healthy ? 'ok' : 'critical' };
  }

  checkJSHealth() {
    const issues = [];
    let healthy = true;
    
    // Verificar funcionalidades críticas
    if (typeof window.React === 'undefined') {
      issues.push('React não carregado');
      healthy = false;
    }
    
    if (typeof window.errorMonitor === 'undefined') {
      issues.push('Error monitor não inicializado');
      healthy = false;
    }
    
    return { healthy, issues, severity: healthy ? 'ok' : 'critical' };
  }

  checkPerformance() {
    const issues = [];
    let healthy = true;
    
    // Verificar tempo de carregamento
    if (performance.timing) {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      if (loadTime > 5000) {
        issues.push(`Tempo de carregamento lento: ${Math.round(loadTime / 1000)}s`);
        healthy = false;
      }
    }
    
    // Verificar memory usage
    if (performance.memory) {
      const usedMemory = performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize;
      if (usedMemory > 0.8) {
        issues.push(`Uso de memória elevado: ${Math.round(usedMemory * 100)}%`);
        healthy = false;
      }
    }
    
    return { healthy, issues, severity: healthy ? 'ok' : 'warning' };
  }

  checkMemory() {
    const issues = [];
    let healthy = true;
    
    try {
      // Testar localStorage
      localStorage.setItem('healthTest', 'test');
      if (localStorage.getItem('healthTest') !== 'test') {
        issues.push('LocalStorage não funcional');
        healthy = false;
      }
      localStorage.removeItem('healthTest');
      
      // Verificar espaço disponível
      const testString = 'x'.repeat(1000);
      localStorage.setItem('spaceTest', testString);
      localStorage.removeItem('spaceTest');
      
    } catch (e) {
      issues.push('Erro de acesso ao armazenamento');
      healthy = false;
    }
    
    return { healthy, issues, severity: healthy ? 'ok' : 'critical' };
  }

  checkNetwork() {
    const issues = [];
    let healthy = true;
    
    // Verificar se estamos online
    if (!navigator.onLine) {
      issues.push('Conexão de rede indisponível');
      healthy = false;
    }
    
    return { healthy, issues, severity: healthy ? 'ok' : 'warning' };
  }

  getHealthReport() {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastCheck,
      criticalErrors: this.criticalErrors,
      checks: this.healthChecks.map(hc => ({
        name: hc.name,
        healthy: hc.lastResult?.healthy || false,
        issues: hc.lastResult?.issues || [],
        consecutiveFailures: hc.consecutiveFailures
      }))
    };
  }
}

// Criar instância global
window.appHealthChecker = new AppHealthChecker();

export default window.appHealthChecker;
