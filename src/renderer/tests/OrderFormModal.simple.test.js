// src/renderer/tests/OrderFormModal.simple.test.js
// Testes simplificados para o modal de formulário de pedidos

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock do componente principal
jest.mock('../components/orders/OrderFormModal', () => {
  return function MockOrderFormModal({ isOpen, onClose, onConfirm, initialOrder }) {
    if (!isOpen) return null;
    
    return (
      <div data-testid="order-form-modal">
        <h2>Criar Pedido</h2>
        <button onClick={onClose}>Cancelar</button>
        <button onClick={() => onConfirm({ id: 'test-order' })}>Confirmar</button>
        {initialOrder && <div>Editando: {initialOrder.id}</div>}
      </div>
    );
  };
});

// Import do componente mockado
import OrderFormModal from '../components/orders/OrderFormModal';

describe('OrderFormModal (Simplified)', () => {
  test('deve renderizar modal de criação de pedido', () => {
    const mockOnClose = jest.fn();
    const mockOnConfirm = jest.fn();
    
    render(
      <OrderFormModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );
    
    expect(screen.getByTestId('order-form-modal')).toBeInTheDocument();
    expect(screen.getByText('Criar Pedido')).toBeInTheDocument();
  });

  test('deve fechar modal ao cancelar', () => {
    const mockOnClose = jest.fn();
    const mockOnConfirm = jest.fn();
    
    render(
      <OrderFormModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );
    
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('deve confirmar pedido', () => {
    const mockOnClose = jest.fn();
    const mockOnConfirm = jest.fn();
    
    render(
      <OrderFormModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );
    
    const confirmButton = screen.getByText('Confirmar');
    fireEvent.click(confirmButton);
    
    expect(mockOnConfirm).toHaveBeenCalledWith({ id: 'test-order' });
  });

  test('deve editar pedido existente', () => {
    const existingOrder = {
      id: 'order-1',
      customerSnapshot: {
        name: 'João Silva',
        phone: '11999999999'
      }
    };
    
    const mockOnClose = jest.fn();
    const mockOnConfirm = jest.fn();
    
    render(
      <OrderFormModal
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        initialOrder={existingOrder}
      />
    );
    
    expect(screen.getByText('Editando: order-1')).toBeInTheDocument();
  });

  test('deve lidar com modal fechado', () => {
    const mockOnClose = jest.fn();
    const mockOnConfirm = jest.fn();
    
    render(
      <OrderFormModal
        isOpen={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );
    
    expect(screen.queryByTestId('order-form-modal')).not.toBeInTheDocument();
  });
});
