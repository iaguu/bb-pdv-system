import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useOrderDrafts } from "../../utils/orderDraftManager";
import { OrderIcon } from "./OrderIcons";

export default function OrderDraftsList({ onSelectDraft, onNewDraft, onClose }) {
  const { drafts: allDrafts, activeDraftId, removeDraft, clearAllDrafts } = useOrderDrafts();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [draggedDraftId, setDraggedDraftId] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState(new Set());
  const [previewDraft, setPreviewDraft] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState("saved");
  
  const dragCounter = useRef(0);
  const searchInputRef = useRef(null);

  // Melhoria de desempenho: Memoização da lista filtrada e ordenada
  const filteredAndSortedDrafts = useMemo(() => {
    let filtered = allDrafts.filter(draft => 
      draft.customerSnapshot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      draft.items.some(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      draft.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "updatedAt":
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        case "createdAt":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "total":
          return (b.totals.finalTotal || 0) - (a.totals.finalTotal || 0);
        case "items":
          return (b.items.length || 0) - (a.items.length || 0);
        default:
          return 0;
      }
    });
  }, [allDrafts, searchTerm, sortBy]);

  // Melhoria de navegação: Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            searchInputRef.current.focus();
            break;
          case 'n':
            e.preventDefault();
            onNewDraft();
            break;
          case 'Escape':
            e.preventDefault();
            onClose();
            break;
        }
      }
      
      // Navegação com setas
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = filteredAndSortedDrafts.findIndex(d => d.id === selectedDraftId);
        let newIndex;
        
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < filteredAndSortedDrafts.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : filteredAndSortedDrafts.length - 1;
        }
        
        setSelectedDraftId(filteredAndSortedDrafts[newIndex].id || null);
      }
      
      // Selecionar com Enter
      if (e.key === 'Enter' && selectedDraftId) {
        const draft = filteredAndSortedDrafts.find(d => d.id === selectedDraftId);
        if (draft) {
          onSelectDraft(draft);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredAndSortedDrafts, selectedDraftId, onSelectDraft, onNewDraft, onClose]);

  const handleSelectDraft = useCallback((draft) => {
    setSelectedDraftId(draft.id);
    onSelectDraft(draft);
  }, [onSelectDraft]);

  const handleRemoveDraft = useCallback((e, draftId) => {
    e.stopPropagation();
    removeDraft(draftId);
    if (selectedDraftId === draftId) {
      setSelectedDraftId(null);
    }
  }, [removeDraft, selectedDraftId]);

  const handleClearAll = useCallback(() => {
    clearAllDrafts();
    setConfirmClearAll(false);
    setSelectedDraftId(null);
  }, [clearAllDrafts]);

  const formatRelativeTime = useCallback((dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours} h`;
    if (diffDays < 7) return `há ${diffDays} d`;
    return date.toLocaleDateString('pt-BR');
  }, []);

  const getDraftPriority = useCallback((draft) => {
    const total = draft.totals.finalTotal || 0;
    const itemCount = draft.items.length || 0;
    const age = Date.now() - new Date(draft.updatedAt).getTime();
    const ageHours = age / 3600000;

    // Rascunhos urgentes (mais de 2 horas ou alto valor)
    if (ageHours > 2 || total > 200) {
      return ageHours > 4 ? "urgent" : "high-value";
    }
    return "normal";
  }, []);

  const totalValue = useMemo(() => 
    filteredAndSortedDrafts.reduce((sum, draft) => sum + (draft.totals.finalTotal || 0), 0),
    [filteredAndSortedDrafts]
  );

  return (
    <div className="order-drafts-list">
      {/* Cabeçalho com busca e filtros */}
      <div className="order-drafts-list__header">
        <h3 className="order-drafts-list__title">Rascunhos</h3>
        <div className="order-drafts-list__actions">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="order-drafts-list__sort"
            title="Ordenar por"
          >
            <option value="updatedAt">Recentes</option>
            <option value="total">Valor</option>
            <option value="items">Itens</option>
            <option value="createdAt">Criação</option>
          </select>
        </div>
      </div>

      {/* Campo de busca com atalho */}
      <div className="order-drafts-list__search-wrapper">
        <input
          ref={searchInputRef}
          id="draft-search"
          type="text"
          placeholder="Buscar rascunhos... (Ctrl+K)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="order-drafts-list__search"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="order-drafts-list__clear-search"
            title="Limpar busca"
          >
            ✕
          </button>
        )}
      </div>

      {/* Estatísticas */}
      {filteredAndSortedDrafts.length > 0 && (
        <div className="order-drafts-list__stats">
          <span>{filteredAndSortedDrafts.length} rascunho(s)</span>
          <span>Total: {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
      )}

      {/* Lista de rascunhos */}
      {filteredAndSortedDrafts.length === 0 ? (
        <div className="order-drafts-list__empty">
          <div className="order-drafts-list__empty-icon"><OrderIcon name="summary" /></div>
          <div className="order-drafts-list__empty-text">
            {searchTerm ? "Nenhum rascunho encontrado" : "Nenhum rascunho ainda"}
          </div>
          {!searchTerm && (
            <button
              onClick={onNewDraft}
              className="order-drafts-list__empty-action"
            >
              Criar primeiro rascunho
            </button>
          )}
        </div>
      ) : (
        <div className="order-drafts-list__items">
          {filteredAndSortedDrafts.map((draft) => {
            const priority = getDraftPriority(draft);
            const isSelected = draft.id === selectedDraftId;
            const isActive = draft.id === activeDraftId;
            
            return (
              <div
                key={draft.id}
                className={`order-draft-item ${isActive ? 'order-draft-item--active' : ''} ${priority ? `order-draft-item--${priority}` : ''} ${isSelected ? 'order-draft-item--selected' : ''}`}
                onClick={() => handleSelectDraft(draft)}
                data-testid="draft-item"
              >
                <div className="order-draft-item__header">
                  <h4 className="order-draft-item__title">
                    {draft.customerSnapshot.name || "Cliente não informado"}
                    {isActive && <span className="order-draft-item__badge">Ativo</span>}
                  </h4>
                  <div className="order-draft-item__meta">
                    <span className="order-draft-item__time">
                      {formatRelativeTime(draft.updatedAt)}
                    </span>
                    <span className="order-draft-item__items">
                      {draft.items.length || 0} itens
                    </span>
                  </div>
                </div>
                
                <div className="order-draft-item__summary">
                  {draft.items.slice(0, 3).map((item, index) => (
                    <span key={index}>
                      {item.quantity}x {item.productName || item.flavor1Name || "Item"}
                      {index < Math.min(draft.items.length - 1, 2) && ", "}
                    </span>
                  ))}
                  {draft.items.length > 3 && ` +${draft.items.length - 3} itens`}
                </div>
                
                <div className="order-draft-item__footer">
                  <span className="order-draft-item__total">
                    {(draft.totals.finalTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <div className="order-draft-item__actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewDraft(draft);
                      }}
                      className="order-draft-item__action-btn"
                      title="Visualizar"
                    >
                      <OrderIcon name="search" />
                    </button>
                    <button
                      onClick={(e) => handleRemoveDraft(e, draft.id)}
                      className="order-draft-item__action-btn order-draft-item__action-btn--remove"
                      title="Remover rascunho"
                    >
                      <OrderIcon name="trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewDraft && (
        <div className="order-drafts-list__preview-modal" onClick={() => setPreviewDraft(null)}>
          <div className="order-drafts-list__preview-content" onClick={(e) => e.stopPropagation()}>
            <h3>Visualização do Rascunho</h3>
            <div className="order-drafts-list__preview-details">
              <p><strong>Cliente:</strong> {previewDraft.customerSnapshot.name || 'Não informado'}</p>
              <p><strong>Itens:</strong> {previewDraft.items.length || 0}</p>
              <p><strong>Total:</strong> {(previewDraft.totals.finalTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              <p><strong>Atualizado:</strong> {formatRelativeTime(previewDraft.updatedAt)}</p>
            </div>
            <button onClick={() => setPreviewDraft(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Ações globais */}
      {allDrafts.length > 0 && (
        <div className="order-drafts-list__global-actions">
          <button
            onClick={onNewDraft}
            className="order-drafts-list__btn order-drafts-list__btn--primary"
          >
            ➕ Novo Rascunho (Ctrl+N)
          </button>
          <button
            onClick={() => setConfirmClearAll(true)}
            className="order-drafts-list__btn order-drafts-list__btn--danger"
          >
            <OrderIcon name="trash" /> Limpar Todos
          </button>
        </div>
      )}

      {/* Confirmação para limpar todos */}
      {confirmClearAll && (
        <div className="order-drafts-list__confirm">
          <p className="order-drafts-list__confirm-text">
            Tem certeza que deseja limpar todos os rascunhos Esta ação não pode ser desfeita.
          </p>
          <div className="order-drafts-list__confirm-actions">
            <button
              onClick={handleClearAll}
              className="order-drafts-list__confirm-btn order-drafts-list__confirm-btn--yes"
            >
              Sim, limpar todos
            </button>
            <button
              onClick={() => setConfirmClearAll(false)}
              className="order-drafts-list__confirm-btn order-drafts-list__confirm-btn--no"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
