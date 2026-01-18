import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Modal from "../../common/Modal";
import { OrderIcon } from "../OrderIcons";

const ORDER_TYPES = [
  { id: "delivery", label: "Delivery", icon: "truck" },
  { id: "pickup", label: "Retirada", icon: "bag" },
  { id: "counter", label: "Balcao", icon: "store" },
];

const DISCOUNT_TYPES = [
  { id: "none", label: "Sem Desconto" },
  { id: "value", label: "Valor (R$)" },
  { id: "percent", label: "Porcentagem (%)" },
];

export default function OrderOptionsModal({
  isOpen,
  onClose,
  orderType,
  onOrderTypeChange,
  discountType,
  discountValue,
  onDiscountChange,
  onDiscountValueChange,
  deliveryFee,
  onDeliveryFeeChange,
  orderNotes,
  kitchenNotes,
  onOrderNotesChange,
  onKitchenNotesChange,
}) {
  const [selectedOrderType, setSelectedOrderType] = useState(orderType || "delivery");
  const [selectedDiscountType, setSelectedDiscountType] = useState(discountType || "none");
  const [discountAmount, setDiscountAmount] = useState(discountValue || "0");
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState(
    deliveryFee !== undefined && deliveryFee !== null ? String(deliveryFee) : "0"
  );
  const [notes, setNotes] = useState(orderNotes || "");
  const [kitchenObs, setKitchenObs] = useState(kitchenNotes || "");
  const selectedOrderTypeLabel = ORDER_TYPES.find(t => t.id === selectedOrderType)?.label || "Delivery";
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedOrderType(orderType || "delivery");
    setSelectedDiscountType(discountType || "none");
    setDiscountAmount(discountValue || "0");
    setDeliveryFeeAmount(
      deliveryFee !== undefined && deliveryFee !== null ? String(deliveryFee) : "0"
    );
    setNotes(orderNotes || "");
    setKitchenObs(kitchenNotes || "");
  }, [isOpen, orderType, discountType, discountValue, deliveryFee, orderNotes, kitchenNotes]);

  const handleOrderTypeSelect = (typeId) => {
    setSelectedOrderType(typeId);
    onOrderTypeChange(typeId);
  };

  const handleDiscountTypeSelect = (typeId) => {
    setSelectedDiscountType(typeId);
    onDiscountChange(typeId);
    if (typeId === "none") {
      setDiscountAmount("0");
      onDiscountValueChange("0");
    }
  };

  const handleConfirm = () => {
    onOrderNotesChange(notes);
    onKitchenNotesChange(kitchenObs);
    onDiscountValueChange(discountAmount);
    if (onDeliveryFeeChange) {
      const parsed = Number(deliveryFeeAmount);
      onDeliveryFeeChange(Number.isNaN(parsed) ? 0 : parsed);
    }
    onClose();
  };

  const getDiscountLabel = () => {
    if (selectedDiscountType === "none") return "Sem desconto aplicado";
    if (selectedDiscountType === "value") return `Desconto de R$ ${discountAmount || "0"}`;
    if (selectedDiscountType === "percent") return `Desconto de ${discountAmount || "0"}%`;
    return "";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="orderform-modal" size="lg">
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">Opcoes do Pedido</div>
          <div className="modal-title">Configurar Pedido</div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <OrderIcon name="close" />
        </button>
      </div>

      <motion.div className="modal-body" {...bodyMotion}>
        {/* Order Type */}
        <div className="modal-section">
          <div className="modal-section-title">Tipo de Pedido<span className="hint-dot" data-tooltip="Define entrega, retirada ou balcao.">?</span></div>
          <div className="order-types-grid">
            {ORDER_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                className={`order-type-option ${
                  selectedOrderType === type.id ? "order-type-active" : ""
                }`}
                onClick={() => handleOrderTypeSelect(type.id)}
              >
                <div className="order-type-icon">
                  <OrderIcon name={type.icon} />
                </div>
                <div className="order-type-label">{type.label}</div>
              </button>
            ))}
          </div>
          
          <div className="order-type-info">
            {selectedOrderType === "delivery" && (
              <div className="info-box">
                <strong>Delivery:</strong> Pedido sera entregue no endereco do cliente. Taxa de entrega sera aplicada.
              </div>
            )}
            {selectedOrderType === "pickup" && (
              <div className="info-box">
                <strong>Retirada:</strong> Cliente vira buscar o pedido no estabelecimento. Sem taxa de entrega.
              </div>
            )}
            {selectedOrderType === "counter" && (
              <div className="info-box">
                <strong>Balcao:</strong> Pedido consumido no local. Sem taxa de entrega.
              </div>
            )}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Taxa de Entrega</div>
          {selectedOrderType !== "delivery" ? (
            <div className="alert alert-info">
              Taxa de entrega nao aplicada para este tipo de pedido.
            </div>
          ) : (
            <label className="field">
              <span className="field-label">Valor da taxa (R$)</span>
              <input
                type="number"
                className="field-input"
                value={deliveryFeeAmount}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setDeliveryFeeAmount(nextValue);
                  if (onDeliveryFeeChange) {
                    const parsed = Number(nextValue);
                    onDeliveryFeeChange(Number.isNaN(parsed) ? 0 : parsed);
                  }
                }}
                placeholder="0,00"
                step="0.01"
                min="0"
              />
            </label>
          )}
        </div>

        {/* Discount */}
        <div className="modal-section">
          <div className="modal-section-title">Desconto<span className="hint-dot" data-tooltip="Escolha tipo e valor do desconto.">?</span></div>
          <div className="discount-section">
            {/* Discount Type Selection */}
            <div className="discount-types">
              {DISCOUNT_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  className={`discount-type-btn ${
                    selectedDiscountType === type.id ? "discount-type-active" : ""
                  }`}
                  onClick={() => handleDiscountTypeSelect(type.id)}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Discount Amount */}
            {selectedDiscountType !== "none" && (
              <div className="discount-amount-section">
                <label className="field">
                  <span className="field-label">
                    {selectedDiscountType === "value" ? "Valor do Desconto (R$)" : "Percentual de Desconto (%)"}
                  </span>
                  <input
                    type="number"
                    className="field-input"
                    value={discountAmount}
                    onChange={(e) => {
                      setDiscountAmount(e.target.value);
                      onDiscountValueChange(e.target.value);
                    }}
                    placeholder={selectedDiscountType === "value" ? "0,00" : "0"}
                    step={selectedDiscountType === "value" ? "0.01" : "1"}
                    min="0"
                    max={selectedDiscountType === "percent" ? "100" : undefined}
                  />
                </label>
                
                {/* Quick Discount Buttons */}
                <div className="quick-discounts">
                  <div className="field-label">Descontos Rapidos</div>
                  <div className="quick-discount-buttons">
                    {selectedDiscountType === "value" && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const amount = "5";
                            setDiscountAmount(amount);
                            onDiscountValueChange(amount);
                          }}
                        >
                          R$ 5
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const amount = "10";
                            setDiscountAmount(amount);
                            onDiscountValueChange(amount);
                          }}
                        >
                          R$ 10
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const amount = "15";
                            setDiscountAmount(amount);
                            onDiscountValueChange(amount);
                          }}
                        >
                          R$ 15
                        </button>
                      </>
                    )}
                    
                    {selectedDiscountType === "percent" && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const amount = "5";
                            setDiscountAmount(amount);
                            onDiscountValueChange(amount);
                          }}
                        >
                          5%
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const amount = "10";
                            setDiscountAmount(amount);
                            onDiscountValueChange(amount);
                          }}
                        >
                          10%
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            const amount = "15";
                            setDiscountAmount(amount);
                            onDiscountValueChange(amount);
                          }}
                        >
                          15%
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Discount Summary */}
            <div className="discount-summary">
              <div className="discount-preview">
                <span className="discount-label">Status do Desconto:</span>
                <span className="discount-value">{getDiscountLabel()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="modal-section">
          <div className="modal-section-title">Observacoes</div>
          
          <div className="notes-grid">
            <div className="notes-column">
              <label className="field">
                <span className="field-label">Observacoes Gerais</span>
                <span className="field-helper">Visiveis para o cliente e equipe</span>
                <textarea
                  className="field-input"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Entregar no portao, troco para 100, pedido com urgencia..."
                />
              </label>
            </div>
            
            <div className="notes-column">
              <label className="field">
                <span className="field-label">Observacoes para Cozinha</span>
                <span className="field-helper">Apenas para a equipe de preparacao</span>
                <textarea
                  className="field-input"
                  rows={4}
                  value={kitchenObs}
                  onChange={(e) => setKitchenObs(e.target.value)}
                  placeholder="Ex: Sem cebola, ponto da massa bem passado, separar molhos..."
                />
              </label>
            </div>
          </div>

          {/* Quick Notes Templates */}
          <div className="quick-notes">
            <div className="field-label">Observacoes Rapidas</div>
            <div className="quick-note-buttons">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setNotes(prev => prev + (prev ? " " : "") + "Entregar no portao")}
              >
                <OrderIcon name="pin" />
                Entregar no portao
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setNotes(prev => prev + (prev ? " " : "") + "Troco para 50")}
              >
                <OrderIcon name="cash" />
                Troco para 50
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setNotes(prev => prev + (prev ? " " : "") + "Contato ao chegar")}
              >
                <OrderIcon name="phone" />
                Contato ao chegar
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setKitchenObs(prev => prev + (prev ? " " : "") + "Sem cebola")}
              >
                <OrderIcon name="check" />
                Sem cebola
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setKitchenObs(prev => prev + (prev ? " " : "") + "Ponto da massa bem passado")}
              >
                <OrderIcon name="cook" />
                Massa bem passada
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirm}
        >
          Aplicar Configuracoes
        </button>
      </div>
    </Modal>
  );
}

