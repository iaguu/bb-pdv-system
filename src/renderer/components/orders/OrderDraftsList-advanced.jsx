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
  const [voiceMode, setVoiceMode] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  
  const dragCounter = useRef(0);
  const searchInputRef = useRef(null);

  // Melhoria UX 1: Smart suggestions baseadas em histórico
  useEffect(() => {
    if (searchTerm.length > 2) {
      const generateSuggestions = () => {
        const recentCustomers = allDrafts
          .filter(d => d.customerSnapshot.name)
          .map(d => d.customerSnapshot.name)
          .filter((name, index, arr) => arr.indexOf(name) === index)
          .slice(0, 5);
        
        const popularItems = allDrafts
          .flatMap(d => d.items || [])
          .reduce((acc, item) => {
            const name = item.productName || item.flavor1Name;
            if (name) {
              acc[name] = (acc[name] || 0) + (item.quantity || 1);
            }
            return acc;
          }, {})
          .sort((a, b) => b - a)
          .slice(0, 5)
          .map(([name]) => name);

        setSuggestions([...recentCustomers, ...popularItems]);
      };

      generateSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [searchTerm, allDrafts]);

  // Melhoria UX 2: Auto-save visual indicator
  useEffect(() => {
    setAutoSaveStatus("saving");
    const timer = setTimeout(() => {
      setAutoSaveStatus("saved");
    }, 1000);
    return () => clearTimeout(timer);
  }, [allDrafts]);

  // Melhoria UX 3: Voice commands
  useEffect(() => {
    if (!voiceMode || !('webkitSpeechRecognition' in window)) return;

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      
      if (transcript.includes('novo rascunho')) {
        onNewDraft();
      } else if (transcript.includes('buscar')) {
        searchInputRef.current.focus();
      } else if (transcript.includes('limpar tudo')) {
        setConfirmClearAll(true);
      } else if (transcript.includes('fechar')) {
        onClose();
      }
    };

    recognition.start();
    return () => recognition.stop();
  }, [voiceMode, onNewDraft, onClose]);

  // Melhoria UX 4: Drag & Drop handlers
  const handleDragStart = useCallback((e, draftId) => {
    setDraggedDraftId(draftId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draftId);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetDraftId) => {
    e.preventDefault();
    if (draggedDraftId && draggedDraftId !== targetDraftId) {
      // Adiciona ao undo stack
      setUndoStack(prev => [...prev, { type: 'reorder', from: draggedDraftId, to: targetDraftId }]);
    }
    setDraggedDraftId(null);
  }, [draggedDraftId]);

  // Melhoria UX 5: Bulk operations
  const toggleBulkMode = useCallback(() => {
    setBulkMode(!bulkMode);
    setSelectedDrafts(new Set());
  }, [bulkMode]);

  const toggleDraftSelection = useCallback((draftId) => {
    const newSelection = new Set(selectedDrafts);
    if (newSelection.has(draftId)) {
      newSelection.delete(draftId);
    } else {
      newSelection.add(draftId);
    }
    setSelectedDrafts(newSelection);
  }, [selectedDrafts]);

  const bulkDelete = useCallback(() => {
    if (selectedDrafts.size > 0) {
      setUndoStack(prev => [...prev, { type: 'bulk-delete', drafts: Array.from(selectedDrafts) }]);
      selectedDrafts.forEach(draftId => removeDraft(draftId));
      setSelectedDrafts(new Set());
    }
  }, [selectedDrafts, removeDraft]);

  // Melhoria UX 6: Undo/Redo
  const undo = useCallback(() => {
    if (undoStack.length > 0) {
      const lastAction = undoStack[undoStack.length - 1];
      // Implementar lógica de undo baseada no tipo de ação
      setUndoStack(prev => prev.slice(0, -1));
    }
  }, [undoStack]);

  // Melhoria UX 7: Quick actions menu
  const [contextMenu, setContextMenu] = useState(null);
  
  const handleContextMenu = useCallback((e, draft) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      draft
    });
  }, []);

  // Melhoria UX 8: Preview mode
  const handlePreview = useCallback((draft) => {
    setPreviewDraft(draft);
  }, []);

  // Melhoria UX 9: Smart search com autocomplete
  const handleSuggestionClick = useCallback((suggestion) => {
    setSearchTerm(suggestion);
    searchInputRef.current.focus();
  }, []);

  // Melhoria UX 10: Swipe gestures para mobile
  const [touchStart, setTouchStart] = useState(null);
  
  const handleTouchStart = useCallback((e, draftId) => {
    setTouchStart({ x: e.touches[0].clientX, draftId });
  }, []);

  const handleTouchEnd = useCallback((e, draftId) => {
    if (!touchStart) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart.x - touchEnd;
    
    if (Math.abs(diff) > 100) {
      if (diff > 0) {
        // Swipe left - remove
        removeDraft(draftId);
      } else {
        // Swipe right - select
        handleSelectDraft(allDrafts.find(d => d.id === draftId));
      }
    }
    setTouchStart(null);
  }, [touchStart, removeDraft, allDrafts, handleSelectDraft]);

  // Memoização da lista filtrada e ordenada
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

  // Atalhos de teclado
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
          case 'z':
            e.preventDefault();
            undo();
            break;
          case 'v':
            e.preventDefault();
            setVoiceMode(!voiceMode);
            break;
          case 'Escape':
            e.preventDefault();
            onClose();
            break;
        }
      }
      
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
      
      if (e.key === 'Enter' && selectedDraftId) {
        const draft = filteredAndSortedDrafts.find(d => d.id === selectedDraftId);
        if (draft) {
          onSelectDraft(draft);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredAndSortedDrafts, selectedDraftId, onSelectDraft, onNewDraft, onClose, undo, voiceMode]);

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
      {/* Header com bulk actions e voice mode */}
      <div className="order-drafts-list__header">
        <h3 className="order-drafts-list__title">
          Rascunhos
          <span className={`order-drafts-list__auto-save ${autoSaveStatus}`}>
            {autoSaveStatus === "saving" ? <OrderIcon name="refresh" /> : <OrderIcon name="check" />}
          </span>
        </h3>
        <div className="order-drafts-list__actions">
          <button
            onClick={toggleBulkMode}
            className={`order-drafts-list__btn ${bulkMode ? 'active' : ''}`}
            title="Modo de seleção múltipla"
          >
            <OrderIcon name="check" />
          </button>
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="order-drafts-list__btn"
            title="Desfazer (Ctrl+Z)"
          >
            <OrderIcon name="back" />
          </button>
          <button
            onClick={() => setVoiceMode(!voiceMode)}
            className={`order-drafts-list__btn ${voiceMode ? 'active' : ''}`}
            title="Comandos de voz (Ctrl+V)"
          >
            <OrderIcon name="mic" />
          </button>
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

      {/* Smart search com suggestions */}
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
        
        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="order-drafts-list__suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="order-drafts-list__suggestion"
              >
                <OrderIcon name="summary" /> 
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk actions toolbar */}
      {bulkMode && selectedDrafts.size > 0 && (
        <div className="order-drafts-list__bulk-toolbar">
          <span>{selectedDrafts.size} selecionado(s)</span>
          <button onClick={bulkDelete} className="order-drafts-list__btn danger">
            <OrderIcon name="trash" />
            Remover selecionados
          </button>
        </div>
      )}

      {/* Estatísticas */}
      {filteredAndSortedDrafts.length > 0 && (
        <div className="order-drafts-list__stats">
          <span>{filteredAndSortedDrafts.length} rascunho(s)</span>
          <span>Total: {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
      )}

      {/* Lista de rascunhos com drag & drop */}
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
            const isBulkSelected = selectedDrafts.has(draft.id);
            
            return (
              <div
                key={draft.id}
                className={`order-draft-item ${isActive ? 'order-draft-item--active' : ''} ${priority ? `order-draft-item--${priority}` : ''} ${isSelected ? 'order-draft-item--selected' : ''} ${isBulkSelected ? 'order-draft-item--bulk-selected' : ''} ${draggedDraftId === draft.id ? 'order-draft-item--dragging' : ''}`}
                onClick={() => bulkMode ? toggleDraftSelection(draft.id) : handleSelectDraft(draft)}
                onContextMenu={(e) => handleContextMenu(e, draft)}
                draggable={!bulkMode}
                onDragStart={(e) => handleDragStart(e, draft.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, draft.id)}
                onTouchStart={(e) => handleTouchStart(e, draft.id)}
                onTouchEnd={(e) => handleTouchEnd(e, draft.id)}
                tabIndex={0}
                role="button"
                aria-selected={isSelected}
              >
                {/* Bulk selection checkbox */}
                {bulkMode && (
                  <div className="order-draft-item__bulk-checkbox">
                    <input
                      type="checkbox"
                      checked={isBulkSelected}
                      onChange={() => toggleDraftSelection(draft.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                
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
                        handlePreview(draft);
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

      {/* Context menu */}
      {contextMenu && (
        <div
          className="order-drafts-list__context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button onClick={() => {
            handleSelectDraft(contextMenu.draft);
            setContextMenu(null);
          }}>
            <OrderIcon name="edit" /> Editar
          </button>
          <button onClick={() => {
            handlePreview(contextMenu.draft);
            setContextMenu(null);
          }}>
            <OrderIcon name="search" /> Visualizar
          </button>
          <button onClick={() => {
            handleRemoveDraft({ stopPropagation: () => {} }, contextMenu.draft.id);
            setContextMenu(null);
          }}>
            <OrderIcon name="trash" /> Remover
          </button>
          <button onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(contextMenu.draft, null, 2));
            setContextMenu(null);
          }}>
            <OrderIcon name="copy" /> Copiar
          </button>
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

      {/* Global actions */}
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

      {/* Confirmation dialog */}
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
