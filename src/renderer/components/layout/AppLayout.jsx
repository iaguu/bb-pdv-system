import React from "react";
import { NavLink } from "react-router-dom";

const AppLayout = ({ children }) => {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span className="app-logo">🍕</span>
          <span className="app-brand-text">Anne & Tom</span>
        </div>
        <nav className="app-nav">
          <NavLink to="/dashboard" className="app-nav-link">
            Dashboard
          </NavLink>
          <NavLink to="/orders" className="app-nav-link">
            Pedidos
          </NavLink>
          <NavLink to="/catalog" className="app-nav-link">
            Catálogo
          </NavLink>
          <NavLink to="/people" className="app-nav-link">
            Pessoas
          </NavLink>
          <NavLink to="/finance" className="app-nav-link">
            Caixa & Financeiro
          </NavLink>
          <NavLink to="/settings" className="app-nav-link">
            Configurações
          </NavLink>
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-left">
            <h1 className="app-title">Painel de Controle</h1>
          </div>
          <div className="app-topbar-right">

          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
