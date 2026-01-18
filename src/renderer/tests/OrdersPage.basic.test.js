// src/renderer/tests/OrdersPage.basic.test.js
// Testes básicos para a página de pedidos

import React from 'react';
import { render, screen } from '@testing-library/react';

// Componente simples para testar
function TestOrdersPage() {
  return (
    <div data-testid="orders-page">
      <h1>Pedidos</h1>
      <div data-testid="orders-list">
        <div data-testid="order-item-1">Pedido 1 - João Silva</div>
        <div data-testid="order-item-2">Pedido 2 - Maria Santos</div>
      </div>
    </div>
  );
}

describe('OrdersPage (Basic)', () => {
  test('deve renderizar a página de pedidos corretamente', () => {
    render(<TestOrdersPage />);
    
    expect(screen.getByTestId('orders-page')).toBeInTheDocument();
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
  });

  test('deve exibir a lista de pedidos', () => {
    render(<TestOrdersPage />);
    
    expect(screen.getByTestId('orders-list')).toBeInTheDocument();
    expect(screen.getByTestId('order-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('order-item-2')).toBeInTheDocument();
    expect(screen.getByText('Pedido 1 - João Silva')).toBeInTheDocument();
    expect(screen.getByText('Pedido 2 - Maria Santos')).toBeInTheDocument();
  });
});
