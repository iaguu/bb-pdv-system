import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import Modal from "../../common/Modal";
import { OrderIcon } from "../OrderIcons";

const PAYMENT_METHODS = [
  { id: "money", label: "Dinheiro", icon: "cash" },
  { id: "pix", label: "PIX", icon: "pix" },
  { id: "card", label: "Cartao", icon: "card" },
  { id: "to_define", label: "A Definir", icon: "help" },
];

export default function PaymentModal({
  isOpen,
  onClose,
  paymentMethod,
  onPaymentMethodChange,
  total,
  cashGiven,
  onCashGivenChange,
  formatCurrency,
}) {
  const [selectedMethod, setSelectedMethod] = useState(paymentMethod || "to_define");
  const selectedMethodLabel = PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label || "A Definir";
  const [cashAmount, setCashAmount] = useState(cashGiven || "");
  const [showDetails, setShowDetails] = useState(false);
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMethod(paymentMethod || "to_define");
    setCashAmount(cashGiven || "");
    setShowDetails(false);
  }, [isOpen, paymentMethod, cashGiven]);

  const changeAmount = useMemo(() => {
    if (selectedMethod !== "money") return 0;
    const cash = parseFloat(cashAmount) || 0;
    return Math.max(0, cash - total);
  }, [selectedMethod, cashAmount, total]);

  const handleMethodSelect = (methodId) => {
    setSelectedMethod(methodId);
    onPaymentMethodChange(methodId);
  };

  const handleConfirm = () => {
    if (selectedMethod === "money" && (!cashAmount || parseFloat(cashAmount) < total)) {
      alert("Valor recebido deve ser maior ou igual ao total do pedido");
      return;
    }
    onCashGivenChange(cashAmount);
    onClose();
  };

  const handleQuickAmount = (amount) => {
    setCashAmount(amount.toString());
  };

  const getMethodDescription = (methodId) => {
    const method = PAYMENT_METHODS.find(m => m.id === methodId);
    return method ? method.description : "";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="orderform-modal" size="md">
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">Pagamento</div>
          <div className="modal-title">Gerenciar Pagamento</div>
          <div className="modal-subtitle">
            Total do pedido: <strong>{formatCurrency(total)}</strong>
          </div>
          <div className="modal-badge-row">
            <span className="modal-badge modal-badge--accent">{selectedMethodLabel}</span>
            <span className="modal-badge">Total: {formatCurrency(total)}</span>
          </div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <OrderIcon name="close" />
        </button>
      </div>

      <motion.div className="modal-body" {...bodyMotion}>
        {/* Payment Method Selection */}
        <div className="modal-section">
          <div className="modal-section-title">Forma de Pagamento<span className="hint-dot" data-tooltip="Selecione a forma principal deste pedido.">?</span></div>
          <div className="payment-methods-grid">
            {PAYMENT_METHODS.map(method => (
              <button
                key={method.id}
                type="button"
                className={`payment-method-option ${
                  selectedMethod === method.id ? "payment-method-active" : ""
                }`}
                onClick={() => handleMethodSelect(method.id)}
              >
                <div className="payment-method-icon">
                  <OrderIcon name={method.icon} />
                </div>
                <div className="payment-method-label">{method.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cash Payment Details */}
        {selectedMethod === "money" && (
          <div className="modal-section">
            <div className="modal-section-title">Pagamento em Dinheiro<span className="hint-dot" data-tooltip="Informe o valor recebido para calcular troco.">?</span></div>
            
            <div className="cash-payment-section">
              <label className="field">
                <span className="field-label">Valor Recebido *</span>
                <input
                  type="number"
                  className="field-input cash-input"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                />
              </label>

              {/* Quick Amount Buttons */}
              <div className="quick-amounts">
                <div className="field-label">Valores Rapidos</div>
                <div className="quick-amount-buttons">
                  {[10, 20, 50, 100].map(amount => (
                    <button
                      key={amount}
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleQuickAmount(amount)}
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Calculation */}
              {changeAmount > 0 && (
                <div className="change-display">
                  <div className="change-row">
                    <span className="change-label">Total do Pedido:</span>
                    <span className="change-value">{formatCurrency(total)}</span>
                  </div>
                  <div className="change-row">
                    <span className="change-label">Valor Recebido:</span>
                    <span className="change-value">{formatCurrency(parseFloat(cashAmount) || 0)}</span>
                  </div>
                  <div className="change-row change-row-total">
                    <span className="change-label">Troco:</span>
                    <span className="change-value change-amount">{formatCurrency(changeAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Other Payment Methods */}
        {selectedMethod !== "money" && selectedMethod !== "to_define" && (
          <div className="modal-section">
            <div className="modal-section-title">Detalhes do Pagamento</div>
            
            <div className="payment-details">
              <div className="payment-info-card">
                <div className="payment-info-header">
                  <span className="payment-info-icon">
                    <OrderIcon name={PAYMENT_METHODS.find(m => m.id === selectedMethod)?.icon} />
                  </span>
                  <span className="payment-info-title">
                    {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}
                  </span>
                </div>
                <div className="payment-info-content">
                  {selectedMethod === "pix" && (
                    <div className="pix-info">
                      <div className="pix-qr-placeholder">
                        [QR Code PIX sera exibido aqui]
                      </div>
                      <div className="pix-key">
                        <span className="field-label">Chave PIX:</span>
                        <span className="pix-key-value">sua-chave-pix@aqui.com</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedMethod === "card" && (
                    <div className="card-info">
                      <div className="card-machine-placeholder">
                        [Maquina de cartao sera integrada aqui]
                      </div>
                      <div className="alert alert-info">
                        Aguarde as instrucoes na maquina de cartao para finalizar o pagamento.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* To Define Method */}
        {selectedMethod === "to_define" && (
          <div className="modal-section">
            <div className="modal-section-title">Pagamento a Definir</div>
            <div className="alert alert-warning">
              <strong>Atencao:</strong> Esta opcao permite finalizar o pedido sem definir a forma de pagamento. 
              O pagamento devera ser registrado posteriormente.
            </div>
            <div className="payment-todo">
              <div className="todo-item">
                <span className="todo-icon"><OrderIcon name="status" /></span>
                <span>Definir forma de pagamento posteriormente</span>
              </div>
              <div className="todo-item">
                <span className="todo-icon"><OrderIcon name="cash" /></span>
                <span>Registrar valor recebido quando definido</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Summary */}
        <div className="modal-section">
          <div className="modal-section-title">Resumo</div>
          <div className="payment-summary">
            <div className="summary-row">
              <span>Forma de Pagamento:</span>
              <span>{PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}</span>
            </div>
            <div className="summary-row">
              <span>Total do Pedido:</span>
              <span className="highlight">{formatCurrency(total)}</span>
            </div>
            {selectedMethod === "money" && changeAmount > 0 && (
              <div className="summary-row">
                <span>Troco a Devolver:</span>
                <span className="highlight">{formatCurrency(changeAmount)}</span>
              </div>
            )}
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
          Confirmar Pagamento
        </button>
      </div>
    </Modal>
  );
}

