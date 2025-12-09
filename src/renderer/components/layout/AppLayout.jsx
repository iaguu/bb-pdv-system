import React from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/orders", label: "Pedidos" },
  { to: "/catalog", label: "Catálogo" },
  { to: "/people", label: "Pessoas" },
  { to: "/estoque", label: "Estoque" },
  { to: "/finance", label: "Caixa & Financeiro" },
  { to: "/settings", label: "Configurações" },
];

const AppLayout = ({ children }) => {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span className="app-logo">🍕</span>
          <span className="app-brand-text">BB - PDV</span>
        </div>

        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                "app-nav-link" + (isActive ? " app-nav-link-active" : "")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">


        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
