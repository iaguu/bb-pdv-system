import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderFormModal from '../components/orders/OrderFormModal';

// Mock do OrderIcon para evitar erros de importação no teste
jest.mock('../components/orders/OrderIcons', () => ({
  OrderIcon: () => <span>Icon</span>
}));

// Mock do toast
jest.mock('../../utils/toast', () => ({
  emitToast: jest.fn()
}));

describe('OrderFormModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockFormatCurrency = (val) => `R$ ${val}`;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock do DataEngine para evitar erros de busca de produtos
    window.dataEngine = {
      get: jest.fn().mockResolvedValue([])
    };
  });

  test('deve renderizar corretamente quando aberto', () => {
    render(
      <OrderFormModal 
        isOpen={true} 
        onClose={mockOnClose} 
        onConfirm={mockOnConfirm}
        formatCurrency={mockFormatCurrency}
      />
    );
    expect(screen.getByText('Novo Pedido')).toBeTruthy();
    expect(screen.getByText('Cliente')).toBeTruthy();
  });

  test('botão cancelar deve chamar onClose', () => {
    render(
      <OrderFormModal 
        isOpen={true} 
        onClose={mockOnClose} 
        onConfirm={mockOnConfirm}
        formatCurrency={mockFormatCurrency}
      />
    );
    
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('não deve salvar sem nome do cliente', () => {
    render(
      <OrderFormModal 
        isOpen={true} 
        onClose={mockOnClose} 
        onConfirm={mockOnConfirm}
        formatCurrency={mockFormatCurrency}
      />
    );
    
    const saveButton = screen.getByText('Criar Pedido');
    fireEvent.click(saveButton);
    
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});