// src/renderer/components/PageHealthChecker.jsx
import React, { useState, useEffect } from 'react';

const PageHealthChecker = ({ children }) => {
  const [isHealthy, setIsHealthy] = useState(true);
  const [healthIssues, setHealthIssues] = useState([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkPageHealth = () => {
      setIsChecking(true);
      const issues = [];

      // Verificar elementos críticos
      const criticalElements = document.querySelectorAll('h1, h2, button, input, [role="button"]');
      if (criticalElements.length === 0) {
        issues.push('Nenhum elemento crítico encontrado');
      }

      // Verificar CSS carregado
      const computedStyle = getComputedStyle(document.body);
      if (!computedStyle || computedStyle.display === 'none') {
        issues.push('CSS não carregado corretamente');
      }

      // Verificar imagens quebradas
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          issues.push(`Imagem quebrada: ${img.src}`);
        }
      });

      // Verificar console errors
      if (window.errorMonitor) {
        const errorStats = window.errorMonitor.getErrorStats();
        if (errorStats.critical > 0) {
          issues.push(`${errorStats.critical} erros críticos detectados`);
        }
        if (errorStats.last24Hours > 10) {
          issues.push(`${errorStats.last24Hours} erros nas últimas 24h`);
        }
      }

      // Verificar responsividade
      const isMobile = window.innerWidth < 768;
      if (isMobile && document.body.scrollWidth > window.innerWidth) {
        issues.push('Problema de responsividade detectado');
      }

      // Verificar performance
      const loadTime = performance.timing ? performance.timing.loadEventEnd - performance.timing.navigationStart : 0;
      if (loadTime > 5000) {
        issues.push(`Tempo de carregamento lento: ${Math.round(loadTime / 1000)}s`);
      }

      setHealthIssues(issues);
      setIsHealthy(issues.length === 0);
      setIsChecking(false);
    };

    // Verificar saúde inicial
    setTimeout(checkPageHealth, 1000);

    // Verificar periodicamente
    const healthInterval = setInterval(checkPageHealth, 30000); // 30 segundos

    // Verificar mudanças de rota
    const checkRoute = () => {
      setTimeout(checkPageHealth, 500);
    };
    window.addEventListener('popstate', checkRoute);

    return () => {
      clearInterval(healthInterval);
      window.removeEventListener('popstate', checkRoute);
    };
  }, []);

  const handleForceRefresh = () => {
    // Limpar caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Forçar reload com timestamp
    const timestamp = Date.now();
    window.location.href = `${window.location.pathname}${window.location.search}${window.location.search ? '&' : '?'}_t=${timestamp}`;
  };

  const handleReportIssue = () => {
    const issueData = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      issues: healthIssues,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      errorStats: window.errorMonitor ? window.errorMonitor.getErrorStats() : null
    };

    console.log('📋 Issue Report:', issueData);
    
    // Copiar para área de transferência
    navigator.clipboard.writeText(JSON.stringify(issueData, null, 2)).then(() => {
      alert('Relatório de problemas copiado para a área de transferência!\n\nCole em um email ou documento para análise.');
    }).catch(() => {
      console.log('Issue Report Data:', issueData);
      alert('Verifique o console para o relatório completo.');
    });
  };

  if (!isHealthy) {
    return (
      <div className="page-health-checker">
        <div className="health-warning-overlay">
          <div className="health-warning-card">
            <div className="health-icon">⚠️</div>
            <h3>Problemas Detectados na Página</h3>
            
            <div className="health-issues">
              {healthIssues.map((issue, index) => (
                <div key={index} className="health-issue">
                  • {issue}
                </div>
              ))}
            </div>

            <div className="health-actions">
              <button
                onClick={handleForceRefresh}
                className="health-button health-button-primary"
                disabled={isChecking}
              >
                🔄 Forçar Atualização
              </button>
              
              <button
                onClick={handleReportIssue}
                className="health-button health-button-secondary"
              >
                📋 Gerar Relatório
              </button>
              
              <button
                onClick={() => setIsHealthy(true)}
                className="health-button health-button-tertiary"
              >
                ✅ Ignorar Avisos
              </button>
            </div>

            {isChecking && (
              <div className="health-checking">
                🔍 Verificando saúde da página...
              </div>
            )}
          </div>
        </div>
        
        {/* Renderizar conteúdo com aviso sobreposto */}
        <div className="health-content-wrapper">
          {children}
        </div>
      </div>
    );
  }

  return children;
};

export default PageHealthChecker;
