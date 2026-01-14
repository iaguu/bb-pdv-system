
import React from "react";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import CatalogPage from "./pages/CatalogPage";
import PeoplePage from "./pages/PeoplePage";
import FinancePage from "./pages/FinancePage";
import SettingsPage from "./pages/SettingsPage";
import StockPage from "./pages/StockPage";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
          <h2>❌ Ocorreu um erro na aplicação</h2>
          <p>Verifique o console para detalhes técnicos</p>
          <button onClick={() => window.location.reload()}>
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const Router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

  return (
    <ErrorBoundary><Router>
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
    </Router></ErrorBoundary>
  );
};

export default App;
