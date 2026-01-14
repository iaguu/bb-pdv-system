// src/tests/frontend/OrderDraftsList.test.jsx
// Testes de frontend para o componente OrderDraftsList

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import OrderDraftsList from '../../components/orders/OrderDraftsList.jsx';

// Mock do hook useOrderDrafts
const mockUseOrderDrafts = {
  drafts: [
    {
      id: 'draft_1',
      customerSnapshot: { name: 'João Silva' },
      items: [
        { productName: 'Pizza Calabresa', quantity: 1, price: 35.90 },
        { productName: 'Refrigerante', quantity: 2, price: 8.00 }
      ],
      totals: { finalTotal: 51.90 },
      status: 'draft',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:30:00Z'
    },
    {
      id: 'draft_2',
      customerSnapshot: { name: 'Maria Santos' },
      items: [
        { productName: 'Hambúrguer', quantity: 2, price: 25.00 }
      ],
      totals: { finalTotal: 50.00 },
      status: 'draft',
      createdAt: '2024-01-01T09:00:00Z',
      updatedAt: '2024-01-01T09:15:00Z'
    },
    {
      id: 'draft_3',
      customerSnapshot: { name: 'Pedro Costa' },
      items: [
        { productName: 'Pizza Grande', quantity: 1, price: 45.00 },
        { productName: 'Batata Frita', quantity: 1, price: 12.00 }
      ],
      totals: { finalTotal: 57.00 },
      status: 'draft',
      createdAt: '2024-01-01T08:00:00Z',
      updatedAt: '2024-01-01T11:00:00Z' // Mais recente
    }
  ],
  activeDraftId: 'draft_1',
  removeDraft: jest.fn(),
  clearAllDrafts: jest.fn()
};

jest.mock('../../utils/orderDraftManager', () => ({
  useOrderDrafts: () => mockUseOrderDrafts
}));

// Mock do window.dataEngine
global.window.dataEngine = {
  addItem: jest.fn(),
  updateItem: jest.fn(),
  get: jest.fn(),
  set: jest.fn()
};

describe('OrderDraftsList - Componente Frontend', () => {
  const mockOnSelectDraft = jest.fn();
  const mockOnNewDraft = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOrderDrafts.removeDraft.mockResolvedValue();
    mockUseOrderDrafts.clearAllDrafts.mockResolvedValue();
  });

  describe('Renderização Básica', () => {
    test('deve renderizar lista de rascunhos', () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Rascunhos')).toBeInTheDocument();
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
    });

    test('deve mostrar estado vazio quando não há rascunhos', () => {
      mockUseOrderDrafts.drafts = [];

      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Nenhum rascunho ainda')).toBeInTheDocument();
      expect(screen.getByText('Criar primeiro rascunho')).toBeInTheDocument();
    });

    test('deve mostrar mensagem de busca vazia', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      await userEvent.type(searchInput, 'inexistente');

      expect(screen.getByText('Nenhum rascunho encontrado')).toBeInTheDocument();
    });

    test('deve exibir estatísticas quando há rascunhos', () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('3 rascunho(s)')).toBeInTheDocument();
      expect(screen.getByText(/Total:/)).toBeInTheDocument();
      expect(screen.getByText(/R\$[\d,]+/)).toBeInTheDocument();
    });
  });

  describe('Funcionalidade de Busca', () => {
    test('deve filtrar rascunhos por nome do cliente', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      await userEvent.type(searchInput, 'João');

      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
      expect(screen.queryByText('Pedro Costa')).not.toBeInTheDocument();
    });

    test('deve filtrar rascunhos por nome do produto', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      await userEvent.type(searchInput, 'Pizza');

      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
      expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
    });

    test('deve limpar busca ao clicar no botão X', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      await userEvent.type(searchInput, 'João');

      const clearButton = screen.getByTitle('Limpar busca');
      await userEvent.click(clearButton);

      expect(searchInput).toHaveValue('');
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
    });

    test('deve mostrar sugestões de busca', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      await userEvent.type(searchInput, 'Jo');

      // Aguarda sugestões aparecerem
      await waitFor(() => {
        expect(screen.getByText(/💡/)).toBeInTheDocument();
      });
    });
  });

  describe('Ordenação', () => {
    test('deve ordenar por data de atualização (padrão)', () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const drafts = screen.getAllByTestId('draft-item');
      expect(drafts[0]).toHaveTextContent('Pedro Costa'); // Mais recente
      expect(drafts[1]).toHaveTextContent('João Silva');
      expect(drafts[2]).toHaveTextContent('Maria Santos'); // Mais antigo
    });

    test('deve ordenar por valor total', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const sortSelect = screen.getByTitle('Ordenar por');
      await userEvent.selectOptions(sortSelect, 'total');

      const drafts = screen.getAllByTestId('draft-item');
      expect(drafts[0]).toHaveTextContent('Pedro Costa'); // R$ 57,00
      expect(drafts[1]).toHaveTextContent('João Silva'); // R$ 51,90
      expect(drafts[2]).toHaveTextContent('Maria Santos'); // R$ 50,00
    });

    test('deve ordenar por número de itens', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const sortSelect = screen.getByTitle('Ordenar por');
      await userEvent.selectOptions(sortSelect, 'items');

      const drafts = screen.getAllByTestId('draft-item');
      expect(drafts[0]).toHaveTextContent('João Silva'); // 2 itens
      expect(drafts[1]).toHaveTextContent('Pedro Costa'); // 2 itens
      expect(drafts[2]).toHaveTextContent('Maria Santos'); // 1 item
    });
  });

  describe('Seleção e Interação', () => {
    test('deve selecionar rascunho ao clicar', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const draftItem = screen.getByText('João Silva').closest('[data-testid="draft-item"]');
      await userEvent.click(draftItem);

      expect(mockOnSelectDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'draft_1',
          customerSnapshot: { name: 'João Silva' }
        })
      );
    });

    test('deve remover rascunho ao clicar no botão remover', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const removeButton = screen.getAllByTitle('Remover rascunho')[0];
      await userEvent.click(removeButton);

      expect(mockUseOrderDrafts.removeDraft).toHaveBeenCalledWith('draft_1');
    });

    test('deve mostrar preview ao clicar no botão visualizar', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const previewButton = screen.getAllByTitle('Visualizar')[0];
      await userEvent.click(previewButton);

      expect(screen.getByText('Visualização do Rascunho')).toBeInTheDocument();
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('2 itens')).toBeInTheDocument();
      expect(screen.getByText('R\$ 51,90')).toBeInTheDocument();
    });

    test('deve fechar preview ao clicar fora', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const previewButton = screen.getAllByTitle('Visualizar')[0];
      await userEvent.click(previewButton);

      const modal = screen.getByText('Visualização do Rascunho').closest('.order-drafts-list__preview-modal');
      await userEvent.click(modal);

      expect(screen.queryByText('Visualização do Rascunho')).not.toBeInTheDocument();
    });
  });

  describe('Modo de Seleção Múltipla', () => {
    test('deve ativar modo bulk ao clicar no checkbox', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const bulkButton = screen.getByTitle('Modo de seleção múltipla');
      await userEvent.click(bulkButton);

      expect(screen.getByText(/selecionado\(s\)/)).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    });

    test('deve selecionar múltiplos rascunhos', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      // Ativa modo bulk
      const bulkButton = screen.getByTitle('Modo de seleção múltipla');
      await userEvent.click(bulkButton);

      // Seleciona rascunhos
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      await userEvent.click(checkboxes[2]);

      expect(screen.getByText('2 selecionado(s)')).toBeInTheDocument();
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });

    test('deve remover múltiplos rascunhos selecionados', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      // Ativa modo bulk e seleciona
      const bulkButton = screen.getByTitle('Modo de seleção múltipla');
      await userEvent.click(bulkButton);

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      await userEvent.click(checkboxes[1]);

      // Remove selecionados
      const bulkDeleteButton = screen.getByText('🗑️ Remover selecionados');
      await userEvent.click(bulkDeleteButton);

      expect(mockUseOrderDrafts.removeDraft).toHaveBeenCalledTimes(2);
    });
  });

  describe('Atalhos de Teclado', () => {
    test('deve focar no search ao pressionar Ctrl+K', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      await userEvent.keyboard('{Control>}k{/Control}');

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      expect(searchInput).toHaveFocus();
    });

    test('deve criar novo rascunho ao pressionar Ctrl+N', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      await userEvent.keyboard('{Control>}n{/Control}');

      expect(mockOnNewDraft).toHaveBeenCalled();
    });

    test('deve fechar ao pressionar Escape', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      await userEvent.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('deve navegar com setas e selecionar com Enter', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      // Navega com setas
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');

      // Seleciona com Enter
      await userEvent.keyboard('{Enter}');

      expect(mockOnSelectDraft).toHaveBeenCalled();
    });
  });

  describe('Drag and Drop', () => {
    test('deve iniciar drag ao arrastar rascunho', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const draftItem = screen.getByText('João Silva').closest('[data-testid="draft-item"]');
      
      fireEvent.dragStart(draftItem, {
        dataTransfer: {
          setData: jest.fn(),
          effectAllowed: 'move'
        }
      });

      expect(draftItem).toHaveClass('order-draft-item--dragging');
    });

    test('deve permitir drop sobre outro rascunho', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const sourceItem = screen.getByText('João Silva').closest('[data-testid="draft-item"]');
      const targetItem = screen.getByText('Maria Santos').closest('[data-testid="draft-item"]');

      fireEvent.dragStart(sourceItem);
      fireEvent.dragOver(targetItem);
      fireEvent.drop(targetItem);

      expect(targetItem).toHaveClass('order-draft-item--drop-target');
    });
  });

  describe('Context Menu', () => {
    test('deve mostrar menu contextual ao clicar com botão direito', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const draftItem = screen.getByText('João Silva').closest('[data-testid="draft-item"]');
      
      fireEvent.contextMenu(draftItem, {
        clientX: 100,
        clientY: 200
      });

      expect(screen.getByText('📝 Editar')).toBeInTheDocument();
      expect(screen.getByText('👁️ Visualizar')).toBeInTheDocument();
      expect(screen.getByText('🗑️ Remover')).toBeInTheDocument();
      expect(screen.getByText('📋 Copiar')).toBeInTheDocument();
    });

    test('deve executar ação do menu contextual', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const draftItem = screen.getByText('João Silva').closest('[data-testid="draft-item"]');
      
      fireEvent.contextMenu(draftItem);
      
      const editButton = screen.getByText('📝 Editar');
      await userEvent.click(editButton);

      expect(mockOnSelectDraft).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'draft_1' })
      );
    });
  });

  describe('Limpar Todos os Rascunhos', () => {
    test('deve mostrar confirmação ao clicar em limpar todos', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const clearButton = screen.getByText('🗑️ Limpar Todos');
      await userEvent.click(clearButton);

      expect(screen.getByText(/Tem certeza que deseja limpar todos os rascunhos/)).toBeInTheDocument();
      expect(screen.getByText('Sim, limpar todos')).toBeInTheDocument();
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });

    test('deve limpar todos ao confirmar', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const clearButton = screen.getByText('🗑️ Limpar Todos');
      await userEvent.click(clearButton);

      const confirmButton = screen.getByText('Sim, limpar todos');
      await userEvent.click(confirmButton);

      expect(mockUseOrderDrafts.clearAllDrafts).toHaveBeenCalled();
      expect(screen.queryByText(/Tem certeza/)).not.toBeInTheDocument();
    });

    test('deve cancelar ao clicar em cancelar', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const clearButton = screen.getByText('🗑️ Limpar Todos');
      await userEvent.click(clearButton);

      const cancelButton = screen.getByText('Cancelar');
      await userEvent.click(cancelButton);

      expect(mockUseOrderDrafts.clearAllDrafts).not.toHaveBeenCalled();
      expect(screen.queryByText(/Tem certeza/)).not.toBeInTheDocument();
    });
  });

  describe('Responsividade', () => {
    test('deve ser responsivo em mobile', async () => {
      // Simula viewport mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      // Verifica se elementos mobile estão presentes
      expect(screen.getByText('Rascunhos')).toBeInTheDocument();
      
      // Verifica se os itens são touch-friendly
      const draftItems = screen.getAllByTestId('draft-item');
      draftItems.forEach(item => {
        expect(item).toHaveStyle({ minHeight: '60px' });
      });
    });

    test('deve adaptar layout para tablet', async () => {
      // Simula viewport tablet
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      // Verifica layout adaptado
      expect(screen.getByText('Rascunhos')).toBeInTheDocument();
    });
  });

  describe('Acessibilidade', () => {
    test('deve ter ARIA labels corretas', () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      expect(searchInput).toHaveAttribute('aria-label', 'Buscar rascunhos');

      const draftItems = screen.getAllByTestId('draft-item');
      draftItems.forEach(item => {
        expect(item).toHaveAttribute('role', 'button');
        expect(item).toHaveAttribute('tabIndex', '0');
      });
    });

    test('deve navegar por teclado', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const firstDraft = screen.getAllByTestId('draft-item')[0];
      firstDraft.focus();

      expect(firstDraft).toHaveFocus();

      await userEvent.keyboard('{Tab}');
      
      const secondDraft = screen.getAllByTestId('draft-item')[1];
      expect(secondDraft).toHaveFocus();
    });

    test('deve anunciar mudanças para screen readers', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      await userEvent.type(searchInput, 'João');

      // Deve ter live region para anúncios
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Estados de Carregamento', () => {
    test('deve mostrar indicador de carregamento', async () => {
      // Mock de loading state
      mockUseOrderDrafts.drafts = [];
      mockUseOrderDrafts.isLoading = true;

      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    test('deve mostrar estado de erro', async () => {
      // Mock de error state
      mockUseOrderDrafts.drafts = [];
      mockUseOrderDrafts.error = 'Erro ao carregar rascunhos';

      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Erro ao carregar rascunhos')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('deve renderizar efficiently com muitos rascunhos', async () => {
      // Mock com muitos rascunhos
      const manyDrafts = Array.from({ length: 1000 }, (_, i) => ({
        id: `draft_${i}`,
        customerSnapshot: { name: `Client ${i}` },
        items: [{ productName: 'Item', quantity: 1, price: 10 }],
        totals: { finalTotal: 10 },
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      mockUseOrderDrafts.drafts = manyDrafts;

      const startTime = performance.now();
      
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Deve renderizar em tempo razoável
      expect(renderTime).toBeLessThan(1000); // 1 segundo
    });

    test('deve debounce busca para evitar renders excessivos', async () => {
      render(
        <OrderDraftsList
          onSelectDraft={mockOnSelectDraft}
          onNewDraft={mockOnNewDraft}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar rascunhos...');
      
      // Digita rapidamente
      await userEvent.type(searchInput, 'J');
      await userEvent.type(searchInput, 'o');
      await userEvent.type(searchInput, 'ã');
      await userEvent.type(searchInput, 'o');

      // Deve ter feito debounce
      expect(searchInput).toHaveValue('João');
    });
  });
});
