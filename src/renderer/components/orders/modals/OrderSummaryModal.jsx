import React, { useMemo } from "react";
import { motion } from "framer-motion";
import Modal from "../../common/Modal";
import { OrderIcon } from "../OrderIcons";

export default function OrderSummaryModal({
  isOpen,
  onClose,
  orderItems,
  subtotal,
  deliveryFee,
  discountAmount,
  total,
  orderType,
  paymentMethod,
  customerInfo,
  addressInfo,
  formatCurrency,
}) {
  const totalItems = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [orderItems]);
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  const orderTypeLabel =
    orderType === "delivery" ? "Delivery" :
    orderType === "pickup" ? "Retirada" :
    "Balcao";

  const paymentLabel =
    paymentMethod === "money" ? "Dinheiro" :
    paymentMethod === "pix" ? "PIX" :
    paymentMethod === "card" ? "Cartao" :
    "A definir";

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const message = ` *PEDIDO CONFIRMADO*\n\n` +
      `*Cliente:* ${customerInfo?.name || 'Nao informado'}\n` +
      `*Total:* ${formatCurrency(total)}\n` +
      `*Forma de Pagamento:* ${paymentMethod || 'A definir'}\n\n` +
      `Acompanhe seu pedido!`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEmail = () => {
    const subject = `Confirmacao de Pedido - ${customerInfo?.name || 'Cliente'}`;
    const body = `Ola ${customerInfo?.name || 'cliente'},\n\n` +
      `Seu pedido foi confirmado com os seguintes detalhes:\n\n` +
      `Total: ${formatCurrency(total)}\n` +
      `Forma de Pagamento: ${paymentMethod || 'A definir'}\n\n` +
      `Agradecemos sua preferencia!`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="orderform-modal" size="lg">
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">Resumo do Pedido</div>
          <div className="modal-title">Confirmar Pedido</div>
          <div className="modal-subtitle">
            Verifique todas as informacoes antes de finalizar
          </div>
          <div className="modal-badge-row">
            <span className="modal-badge modal-badge--accent">{orderTypeLabel}</span>
            <span className="modal-badge modal-badge--info">{paymentLabel}</span>
          </div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <OrderIcon name="close" />
        </button>
      </div>

      <motion.div className="modal-body" {...bodyMotion}>
        {/* Customer Information */}
        <div className="modal-section">
          <div className="modal-section-title">Dados do Cliente</div>
          <div className="summary-customer-info">
            <div className="info-row">
              <span className="info-label">Nome:</span>
              <span className="info-value">{customerInfo?.name || "Nao informado"}</span>
            </div>
            {customerInfo?.phone && (
              <div className="info-row">
                <span className="info-label">Telefone:</span>
                <span className="info-value">{customerInfo.phone}</span>
              </div>
            )}
            {customerInfo?.id && (
              <div className="info-row">
                <span className="info-label">ID:</span>
                <span className="info-value">{customerInfo.id}</span>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Information */}
        {orderType === "delivery" && (
          <div className="modal-section">
            <div className="modal-section-title">Endereco de Entrega</div>
            <div className="summary-address-info">
              {addressInfo ? (
                <>
                  <div className="info-row">
                    <span className="info-label">Endereco:</span>
                    <span className="info-value">
                      {addressInfo.street}, {addressInfo.number}
                      {addressInfo.complement && ` (${addressInfo.complement})`}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Bairro:</span>
                    <span className="info-value">{addressInfo.neighborhood}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Cidade/UF:</span>
                    <span className="info-value">{addressInfo.city}/{addressInfo.state}</span>
                  </div>
                  {addressInfo.cep && (
                    <div className="info-row">
                      <span className="info-label">CEP:</span>
                      <span className="info-value">{addressInfo.cep}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="info-row">
                  <span className="info-value">Endereco nao definido</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="modal-section">
          <div className="modal-section-title">Itens do Pedido<span className="hint-dot" data-tooltip="Revise sabores, tamanhos e quantidades.">?</span></div>
          <div className="summary-items">
            {orderItems.map(item => (
              <div key={item.lineId} className="summary-item">
                <div className="summary-item-main">
                  <div className="summary-item-quantity">{item.quantity}x</div>
                  <div className="summary-item-name">
                    {item.kind === "pizza" ? item.flavor1Name : item.productName}
                    {item.kind === "pizza" && item.twoFlavors && item.flavor2Name && (
                      <span> / {item.flavor2Name}</span>
                    )}
                    {item.kind === "pizza" && item.threeFlavors && item.flavor3Name && (
                      <span> / {item.flavor3Name}</span>
                    )}
                  </div>
                  <div className="summary-item-price">{formatCurrency(item.total)}</div>
                </div>
                <div className="summary-item-details">
                  <span className="chip">
                    {item.kind === "pizza" ? item.sizeLabel : "Bebida"}
                  </span>
                  <span className="chip chip-outline">
                    Unitario: {formatCurrency(item.unitPrice)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="modal-section">
          <div className="modal-section-title">Resumo Financeiro<span className="hint-dot" data-tooltip="Impostos nao estao incluidos.">?</span></div>
          <div className="financial-summary">
            <div className="summary-row">
              <span className="summary-label">Subtotal:</span>
              <span className="summary-value">{formatCurrency(subtotal)}</span>
            </div>
            
            {orderType === "delivery" && (
              <div className="summary-row">
                <span className="summary-label">Taxa de Entrega:</span>
                <span className="summary-value">{formatCurrency(deliveryFee)}</span>
              </div>
            )}
            
            {discountAmount > 0 && (
              <div className="summary-row discount-row">
                <span className="summary-label">Desconto:</span>
                <span className="summary-value discount-value">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            
            <div className="summary-row total-row">
              <span className="summary-label total-label">Total do Pedido:</span>
              <span className="summary-value total-value">{formatCurrency(total)}</span>
            </div>
            
            <div className="summary-row">
              <span className="summary-label">Forma de Pagamento:</span>
              <span className="summary-value">
                {paymentLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Order Statistics */}
        <div className="modal-section">
          <div className="modal-section-title">Estatisticas do Pedido</div>
          <div className="order-stats">
            <div className="stat-card">
              <div className="stat-value">{orderItems.length}</div>
              <div className="stat-label">Itens Diferentes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalItems}</div>
              <div className="stat-label">Quantidade Total</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {orderItems.filter(item => item.kind === "pizza").length}
              </div>
              <div className="stat-label">Pizzas</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {orderItems.filter(item => item.kind === "drink").length}
              </div>
              <div className="stat-label">Bebidas</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-section">
          <div className="modal-section-title">Acoes<span className="hint-dot" data-tooltip="Imprima ou compartilhe o resumo.">?</span></div>
          <div className="action-buttons">
            <button
              type="button"
              className="btn btn-outline action-btn"
              onClick={handlePrint}
            >
              <OrderIcon name="print" />
              Imprimir Resumo
            </button>
            <button
              type="button"
              className="btn btn-outline action-btn"
              onClick={handleWhatsApp}
            >
              <OrderIcon name="send" />
              Enviar por WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-outline action-btn"
              onClick={handleEmail}
            >
              <OrderIcon name="mail" />
              Enviar por E-mail
            </button>
          </div>
        </div>
      </motion.div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Voltar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onClose}
        >
          Confirmar Pedido
        </button>
      </div>
    </Modal>
  );
}

