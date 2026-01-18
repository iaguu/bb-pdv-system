import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import Modal from "../../common/Modal";
import { OrderIcon } from "../OrderIcons";

function InfoIcon({ text }) {
  if (!text) return null;
  return (
    <span className="info-icon" data-tooltip={text} aria-label={text}>
      i
    </span>
  );
}

export default function OrderItemsModal({
  isOpen,
  onClose,
  orderItems,
  setOrderItems,
  pizzaCatalog,
  drinkCatalog,
  extraCatalog,
  formatCurrency,
  onEditItem,
  // Pizza editor props from parent
  showPizzaModal,
  setShowPizzaModal,
  showDrinkModal,
  setShowDrinkModal,
}) {
  const [activeTab, setActiveTab] = useState("pizzas");
  const [showPizzaEditor, setShowPizzaEditor] = useState(false);
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  const hasPizzas = pizzaCatalog.length > 0;
  const hasDrinks = drinkCatalog.length > 0;
  const hasExtras = extraCatalog.length > 0;

  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (item.total || 0), 0);
  }, [orderItems]);

  const totalItems = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [orderItems]);

  const pizzaItems = useMemo(() => {
    return orderItems.filter((item) => item.kind === "pizza");
  }, [orderItems]);

  const drinkItems = useMemo(() => {
    return orderItems.filter((item) => item.kind === "drink");
  }, [orderItems]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("pizzas");
    setShowPizzaEditor(false);
  }, [isOpen]);

  const handleRemoveItem = (lineId) => {
    setOrderItems((prev) => prev.filter((item) => item.lineId !== lineId));
  };

  const handleEditItem = (item) => {
    if (onEditItem) {
      onEditItem(item);
      return;
    }
    if (item.kind === "pizza") {
      setShowPizzaModal && setShowPizzaModal(true);
    } else {
      setShowDrinkModal && setShowDrinkModal(true);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="orderform-modal" size="lg">
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">Gerenciar Itens</div>
          <div className="modal-title">Itens do Pedido</div>
          <div className="modal-subtitle">
            {orderItems.length} linha(s)  -  {totalItems} itens  -  Total: {formatCurrency(subtotal)}
          </div>
          <div className="modal-badge-row">
            <span className="modal-badge modal-badge--info">Pizzas: {pizzaItems.length}</span>
            <span className="modal-badge modal-badge--info">Bebidas: {drinkItems.length}</span>
            {hasExtras && <span className="modal-badge">Extras ativos</span>}
          </div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <OrderIcon name="close" />
        </button>
      </div>

      <motion.div className="modal-body" {...bodyMotion}>
        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === "pizzas" ? "active" : ""}`}
            onClick={() => setActiveTab("pizzas")}
          >
            <OrderIcon name="pizza" />
            Pizzas
          </button>
          <button
            className={`tab ${activeTab === "drinks" ? "active" : ""}`}
            onClick={() => setActiveTab("drinks")}
          >
            <OrderIcon name="drink" />
            Bebidas
          </button>
          <button
            className={`tab ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            <OrderIcon name="summary" />
            Resumo
          </button>
        </div>

        {activeTab === "pizzas" && (
          <div className="tab-content">
            <div className="modal-section">
              <div className="modal-section-header-row">
                <div className="modal-section-title">
                  Adicionar Pizza
                  <span className="hint-dot" data-tooltip="Escolha pizzas do catalogo e edite antes de adicionar.">?</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowPizzaModal && setShowPizzaModal(true)}
                  disabled={!hasPizzas}
                >
                  <OrderIcon name="plus" />
                  Nova Pizza
                </button>
              </div>

              {!hasPizzas && (
                <div className="modal-notice modal-notice--warning">
                  <span className="modal-notice__icon">!</span>
                  Cadastre pizzas na tela de Produtos para montar pedidos.
                </div>
              )}

              <div className="items-grid">
                {pizzaItems.map((item) => (
                  <div key={item.lineId} className="item-card">
                    <div className="item-header">
                      <div className="item-title">
                        {item.quantity}x {item.flavor1Name}
                        {item.twoFlavors && item.flavor2Name && ` / ${item.flavor2Name}`}
                        {item.threeFlavors && item.flavor3Name && ` / ${item.flavor3Name}`}
                      </div>
                      <div className="item-price">{formatCurrency(item.total)}</div>
                    </div>
                    <div className="item-details">
                      <span className="chip">{item.sizeLabel}</span>
                      <span className="chip chip-outline">Unitario: {formatCurrency(item.unitPrice)}</span>
                    </div>
                    <div className="item-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => handleEditItem(item)}
                      >
                        <OrderIcon name="edit" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveItem(item.lineId)}
                      >
                        <OrderIcon name="trash" />
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "drinks" && (
          <div className="tab-content">
            <div className="modal-section">
              <div className="modal-section-header-row">
                <div className="modal-section-title">
                  Adicionar Bebida
                  <span className="hint-dot" data-tooltip="Bebidas usam o preco unitario do catalogo.">?</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowDrinkModal && setShowDrinkModal(true)}
                  disabled={!hasDrinks}
                >
                  <OrderIcon name="plus" />
                  Nova Bebida
                </button>
              </div>

              {!hasDrinks && (
                <div className="modal-notice modal-notice--warning">
                  <span className="modal-notice__icon">!</span>
                  Cadastre bebidas na tela de Produtos para aparecerem aqui.
                </div>
              )}

              <div className="items-grid">
                {drinkItems.map((item) => (
                  <div key={item.lineId} className="item-card">
                    <div className="item-header">
                      <div className="item-title">
                        {item.quantity}x {item.productName}
                      </div>
                      <div className="item-price">{formatCurrency(item.total)}</div>
                    </div>
                    <div className="item-details">
                      <span className="chip">Bebida</span>
                      <span className="chip chip-outline">Unitario: {formatCurrency(item.unitPrice)}</span>
                    </div>
                    <div className="item-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => handleEditItem(item)}
                      >
                        <OrderIcon name="edit" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveItem(item.lineId)}
                      >
                        <OrderIcon name="trash" />
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "summary" && (
          <div className="tab-content">
            <div className="modal-section">
              <div className="modal-section-title">
                Resumo do Pedido
                <span className="hint-dot" data-tooltip="Confira o total e os itens antes de fechar.">?</span>
              </div>
              
              <div className="order-summary">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>

              <div className="items-list">
                {orderItems.map((item) => (
                  <div key={item.lineId} className="summary-item">
                    <div className="summary-item-info">
                      <span className="summary-item-name">
                        {item.quantity}x {item.kind === "pizza" ? item.flavor1Name : item.productName}
                      </span>
                      <span className="summary-item-price">{formatCurrency(item.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Fechar
        </button>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Aplicar Alteracoes
        </button>
      </div>
    </Modal>
  );
}

