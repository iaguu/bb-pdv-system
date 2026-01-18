// src/renderer/components/ErrorBoundary.jsx
import React from 'react';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false
    };
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GlobalErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Save error to localStorage
    try {
      const errorLog = JSON.parse(localStorage.getItem('appErrorLogs') || '[]');
      errorLog.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        page: window.location.pathname
      });

      if (errorLog.length > 20) {
        errorLog.splice(0, errorLog.length - 20);
      }

      localStorage.setItem('appErrorLogs', JSON.stringify(errorLog));
    } catch (e) {
      console.warn('Failed to save error log:', e);
    }

    this.setState({ error, errorInfo });

    // Automatic restart for critical errors
    if (this.isCriticalError(error) && this.state.retryCount < this.maxRetries) {
      this.handleAutoRestart();
    }
  }

  isCriticalError(error) {
    const criticalErrors = [
      'ChunkLoadError',
      'Loading CSS chunk',
      'Failed to fetch dynamically imported module',
      'Network Error',
      'TypeError: Cannot read prop',
      'ReferenceError: window is not defined',
      'SyntaxError',
      'Unexpected token'
    ];

    return criticalErrors.some(criticalError =>
      error.message && error.message.includes(criticalError)
    );
  }

  handleAutoRestart = async () => {
    this.setState({ isRetrying: true });

    console.log(`Auto-restart attempt (${this.state.retryCount + 1}/${this.maxRetries})`);

    await new Promise(resolve => setTimeout(resolve, this.retryDelay));

    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
      isRetrying: false,
      hasError: false,
      error: null,
      errorInfo: null
    }));

    window.location.reload(true);
  }

  handleManualRestart = () => {
    console.log('Manual restart requested');

    try {
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
    } catch (e) {
      console.warn('Failed to clear caches:', e);
    }

    window.location.reload(true);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-card">
            <div className="error-icon">!</div>
            <h2 className="error-title">Erro Critico Detectado</h2>

            <p className="error-message">
              {this.state.error?.message || 'Erro desconhecido na aplicacao'}
            </p>

            {this.state.isRetrying && (
              <div className="retry-section">
                <div className="retry-message">
                  Tentando recuperar automaticamente...
                </div>
                <div className="retry-count">
                  Tentativa {this.state.retryCount + 1} de {this.maxRetries}
                </div>
              </div>
            )}

            <div className="error-actions">
              <button
                onClick={this.handleManualRestart}
                className="restart-button"
              >
                Reiniciar Aplicacao
              </button>

              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('appErrorLogs');
                    this.setState({
                      hasError: false,
                      error: null,
                      errorInfo: null,
                      retryCount: 0
                    });
                  } catch (e) {
                    console.warn('Failed to clear errors:', e);
                  }
                }}
                className="clear-button"
              >
                Limpar Logs
              </button>
            </div>

            <details className="error-details">
              <summary>Detalhes Tecnicos</summary>
              <pre className="error-stack">
                {this.state.error?.stack || 'Stack nao disponivel'}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
