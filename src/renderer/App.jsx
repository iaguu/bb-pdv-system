
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import CatalogPage from "./pages/CatalogPage";
import PeoplePage from "./pages/PeoplePage";
import FinancePage from "./pages/FinancePage";
import SettingsPage from "./pages/SettingsPage";
import StockPage from "./pages/StockPage";
import "./utils/errorMonitor"; // Inicializar monitoramento de erros
import "./utils/appHealthChecker"; // Inicializar verificao de sade
import "./styles/components/ErrorBoundary.scss"; // Importar estilos do ErrorBoundary

class ErrorBoundary extends React.Component {
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
    this.retryDelay = 2000; // 2 segundos
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(' ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Salvar erro no localStorage para anlise posterior
    try {
      const errorLog = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      errorLog.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      
      // Manter apenas ltimos 10 erros
      if (errorLog.length > 10) {
        errorLog.splice(0, errorLog.length - 10);
      }
      
      localStorage.setItem('errorLogs', JSON.stringify(errorLog));
    } catch (e) {
      console.warn('Failed to save error log:', e);
    }

    this.setState({ error, errorInfo });

    // Tentar reinicializao automtica se for erro crtico
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
      'ReferenceError: window is not defined'
    ];

    return criticalErrors.some(criticalError => 
      error.message && error.message.includes(criticalError)
    );
  }

  handleAutoRestart = async () => {
    this.setState({ isRetrying: true });
    
    console.log(` Tentando reinicializao automtica (${this.state.retryCount + 1}/${this.maxRetries})`);
    
    // Esperar antes de tentar reiniciar
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    
    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
      isRetrying: false,
      hasError: false,
      error: null,
      errorInfo: null
    }));

    // Forar reload completo
    window.location.reload(true);
  }

  handleManualRestart = () => {
    console.log(' Reinicializao manual solicitada');
    
    // Limpar caches possveis
    try {
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
    } catch (e) {
      console.warn('Failed to clear caches:', e);
    }

    // Forar reload completo
    window.location.reload(true);
  }

  handleClearErrors = () => {
    try {
      localStorage.removeItem('errorLogs');
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: 0
      });
    } catch (e) {
      console.warn('Failed to clear errors:', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: '#333',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f8f9fa',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}></div>
            <h2 style={{ 
              color: '#dc3545', 
              marginBottom: '15px',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              Ocorreu um erro crtico
            </h2>
            
            <p style={{ 
              color: '#6c757d', 
              marginBottom: '20px',
              lineHeight: '1.5'
            }}>
              {this.state.error?.message || 'Erro desconhecido na aplicao'}
            </p>

            {this.state.isRetrying && (
              <div style={{
                backgroundColor: '#e3f2fd',
                border: '1px solid #2196f3',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <div style={{ color: '#1976d2', fontWeight: '500' }}>
                   Tentando recuperar automaticamente...
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                  Tentativa {this.state.retryCount + 1} de {this.maxRetries}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <button
                onClick={this.handleManualRestart}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
              >
                 Reiniciar Aplicao
              </button>

              <button
                onClick={this.handleClearErrors}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                 Limpar Logs de Erro
              </button>
            </div>

            <details style={{ 
              marginTop: '20px', 
              textAlign: 'left',
              fontSize: '12px',
              color: '#6c757d'
            }}>
              <summary style={{ 
                cursor: 'pointer', 
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}>
                 Detalhes Tcnicos
              </summary>
              <div style={{ 
                padding: '15px', 
                backgroundColor: '#f8f9fa',
                marginTop: '10px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {this.state.error?.stack || 'Stack no disponvel'}
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false
    }
  }
});

const App = () => {
  const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/estoque" element={<StockPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppLayout>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;







