import React from 'react';

const pageNames = {
  dashboard: 'Visão geral',
  caixa: 'Caixa',
  orders: 'Pedidos',
  customers: 'Clientes',
  products: 'Produtos',
  deliveries: 'Entregas',
  settings: 'Configurações'
};

export default function Topbar({ currentPage }) {
  const title = pageNames[currentPage] || 'Painel';

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div className="topbar-subtitle">
          Ambiente de gestão da pizzaria.
        </div>
      </div>
      <div className="topbar-subtitle">Admin</div>
    </header>
  );
}
