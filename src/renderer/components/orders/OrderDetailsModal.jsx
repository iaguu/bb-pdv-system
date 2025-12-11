import React, { useMemo } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";

function formatCurrency(value) {
  const v = Number(value || 0);
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * ⚙️ STATUS – alinhado com site + desktop
 *   status: "open" | "preparing" | "out_for_delivery" | "done" | "cancelled"
 */
const STATUS_OPTIONS = [
  { key: "open", label: "Em aberto", tone: "open" },
  { key: "preparing", label: "Em preparo", tone: "preparing" },
  { key: "out_for_delivery", label: "Saiu p/ entrega", tone: "delivering" },
  { key: "done", label: "Finalizado", tone: "done" },
  { key: "cancelled", label: "Cancelado", tone: "cancelled" },
];

const PAYMENT_TAG_COLORS = {
  money: "tag--money",
  pix: "tag--pix",
  credit: "tag--card",
  debit: "tag--card",
  ifood: "tag--ifood",
};

const OrderDetailsModal = ({
  isOpen,
  onClose,
  order,
  onChangeStatus,
  onChangePayment,
  onEditOrder, // novo fluxo de edição
  onPrintKitchen,
  onPrintCounter,
}) => {
  const totalItems = useMemo(
    () =>
      (order?.items || []).reduce(
        (sum, item) => sum + Number(item.total || item.price || 0),
        0
      ),
    [order]
  );

  const grandTotal = useMemo(
    () => totalItems + Number(order?.deliveryFee || 0),
    [totalItems, order]
  );

  if (!order) {
    return null;
  }

  const handleStatusClick = (key) => {
    if (onChangeStatus) onChangeStatus(order.id, key);
  };

  const handlePaymentChange = (evt) => {
    const value = evt.target.value;
    if (onChangePayment) onChangePayment(order.id, value);
  };

  const paymentTagClass =
    PAYMENT_TAG_COLORS[order.paymentMethod] || "tag--default";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pedido #${order.shortId || order.id}`}
      className="order-details-modal"
    >
      <div className="order-details__body">
        <div className="order-details__column order-details__column--left">
          <section className="order-section">
            <div className="order-section__header">
              <h3 className="order-section__title">Cliente</h3>
              {order.createdAt && (
                <span className="order-section__sub">
                  {new Date(order.createdAt).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
            <div className="order-kv">
              <div>
                <span className="order-kv__label">Nome</span>
                <span className="order-kv__value">{order.customerName}</span>
              </div>
              <div>
                <span className="order-kv__label">Telefone</span>
                <span className="order-kv__value">{order.phone}</span>
              </div>
            </div>

            <div className="order-kv">
              <div>
                <span className="order-kv__label">Endereço</span>
                <span className="order-kv__value">
                  {order.street}, {order.number}
                  {order.neighborhood ? ` - ${order.neighborhood}` : ""}
                </span>
              </div>
              {(order.reference || order.complement) && (
                <div>
                  <span className="order-kv__label">Ref. / Compl.</span>
                  <span className="order-kv__value">
                    {[order.reference, order.complement]
                      .filter(Boolean)
                      .join(" • ")}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="order-section">
            <h3 className="order-section__title">Pagamento</h3>
            <div className="order-kv">
              <div>
                <span className="order-kv__label">Forma</span>
                <span className={`tag ${paymentTagClass}`}>
                  {order.paymentLabel || order.paymentMethod || "Não definido"}
                </span>
              </div>
              <div className="order-kv__inline">
                <label className="order-kv__label">Alterar forma</label>
                <select
                  value={order.paymentMethod || ""}
                  onChange={handlePaymentChange}
                >
                  <option value="">Selecione</option>
                  <option value="money">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="credit">Crédito</option>
                  <option value="debit">Débito</option>
                  <option value="ifood">iFood</option>
                </select>
              </div>
            </div>

            <div className="order-kv">
              <div>
                <span className="order-kv__label">Troco para</span>
                <span className="order-kv__value">
                  {order.changeFor
                    ? formatCurrency(order.changeFor)
                    : "Não informado"}
                </span>
              </div>
              <div>
                <span className="order-kv__label">Observações</span>
                <span className="order-kv__value">
                  {order.paymentNotes || "—"}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="order-details__column order-details__column--right">
          <section className="order-section">
            <div className="order-section__header">
              <h3 className="order-section__title">Itens</h3>
              <button
                type="button"
                className="order-section__link"
                onClick={() => onEditOrder && onEditOrder(order)}
              >
                Editar pedido
              </button>
            </div>
            <div className="order-items-list">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="order-item-row">
                  <div className="order-item-row__main">
                    <div className="order-item-row__title">
                      {item.name || item.title}
                    </div>
                    {item.details && (
                      <div className="order-item-row__details">
                        {item.details}
                      </div>
                    )}
                    {Array.isArray(item.extras) && item.extras.length > 0 && (
                      <div className="order-item-row__extras">
                        {item.extras.map((ex, i) => (
                          <span key={i} className="chip chip--extra">
                            {ex.label || ex.name}{" "}
                            {ex.price ? `+ ${formatCurrency(ex.price)}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="order-item-row__right">
                    <span className="order-item-row__qty">
                      x{item.quantity || 1}
                    </span>
                    <span className="order-item-row__price">
                      {formatCurrency(item.total || item.price || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="order-section">
            <h3 className="order-section__title">Status do pedido</h3>
            <div className="status-chips">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={
                    "status-chip " +
                    (order.status === s.key ? "status-chip--active" : "") +
                    " status-chip--" +
                    s.tone
                  }
                  onClick={() => handleStatusClick(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section className="order-section">
            <h3 className="order-section__title">Resumo</h3>
            <div className="order-summary">
              <div className="order-summary__row">
                <span>Subtotal itens</span>
                <span>{formatCurrency(totalItems)}</span>
              </div>
              <div className="order-summary__row">
                <span>Taxa de entrega</span>
                <span>
                  {order.deliveryFee != null
                    ? formatCurrency(order.deliveryFee)
                    : "—"}
                </span>
              </div>
              <div className="order-summary__row order-summary__row--total">
                <span>Total geral</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </section>

          <section className="order-section order-section--compact">
            <div className="order-actions">
              <Button variant="outline" onClick={onPrintKitchen}>
                Imprimir cozinha
              </Button>
              <Button variant="outline" onClick={onPrintCounter}>
                Imprimir balcão
              </Button>
            </div>
          </section>
        </div>
      </div>

      <div className="order-details__footer">
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
