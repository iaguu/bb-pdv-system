import React from "react";

const items = [
  { key: "dashboard", label: "Início", icon: "🏠" },
  { key: "caixa", label: "Caixa", icon: "💵" },
  { key: "orders", label: "Pedidos", icon: "📦" },
  { key: "customers", label: "Clientes", icon: "👥" },
  { key: "products", label: "Produtos", icon: "🍕" },
  { key: "stock", label: "Estoque", icon: "📊" },
  { key: "deliveries", label: "Entregas", icon: "🛵" },
  { key: "settings", label: "Configurações", icon: "⚙️" },
];

export default function Sidebar({ current, onChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <h3 className="sidebar-logo">BB - PDV</h3>
        <nav className="sidebar-nav">
          {items.map((item) => {
            const isActive = item.key === current;
            return (
              <button
                key={item.key}
                type="button"
                className={
                  "sidebar-item" + (isActive ? " sidebar-item--active" : "")
                }
                onClick={() => onChange && onChange(item.key)}
              >
                <span className="sidebar-item__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="sidebar-item__label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
