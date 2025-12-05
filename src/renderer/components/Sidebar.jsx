import React from 'react';

const items = [
  { key: 'dashboard', label: 'Início' },
  { key: 'caixa', label: 'Caixa' },
  { key: 'orders', label: 'Pedidos' },
  { key: 'customers', label: 'Clientes' },
  { key: 'products', label: 'Produtos' },
  { key: 'deliveries', label: 'Entregas' },
  { key: 'settings', label: 'Configurações' }
];

export default function Sidebar({ current, onChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <h3 className="sidebar-logo">Anne &amp; Tom</h3>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={
                'sidebar-link' + (current === item.key ? ' active' : '')
              }
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
