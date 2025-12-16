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

// Status alinhados com site + desktop
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

const PAYMENT_LABELS = {
  money: "Dinheiro",
  pix: "Pix",
  credit: "Cartão crédito",
  debit: "Cartão débito",
  ifood: "iFood",
};

function normalizeCustomer(order) {
  const snap = order?.customerSnapshot || order?.customer || {};
  return {
    name: snap.name || order?.customerName || "Cliente",
    phone: snap.phone || order?.customerPhone || order?.phone || "",
    address:
      order?.delivery?.address ||
      snap.address || {
        street: order?.street,
        number: order?.number,
        neighborhood: order?.neighborhood,
        city: order?.city,
        state: order?.state,
        cep: order?.cep,
        reference: order?.reference,
        complement: order?.complement,
      },
  };
}

function formatAddress(addr = {}) {
  const parts = [];
  if (addr.street) {
    parts.push(addr.number ? `${addr.street}, ${addr.number}` : addr.street);
  }
  if (addr.neighborhood) parts.push(addr.neighborhood);
  if (addr.city) parts.push(addr.city);
  if (addr.state) parts.push(addr.state);
  if (addr.cep) parts.push(`CEP ${addr.cep}`);
  return parts.filter(Boolean).join(" - ") || "Sem endereço";
}

function normalizeItems(rawItems = []) {
  return rawItems.map((it, idx) => {
    const quantity = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit =
      it.unitPrice ??
      it.price ??
      (it.total || it.lineTotal
        ? Number(it.total || it.lineTotal) / quantity
        : 0);
    const total =
      Number(it.total ?? it.lineTotal ?? it.line_total ?? 0) ||
      Number(unit || 0) * quantity;

    const flavor1 =
      it.name || it.title || it.flavor1Name || it.productName || "Item";
    const flavor2 = it.halfDescription || it.flavor2Name || "";
    const flavor3 = it.flavor3Name || "";

    const title =
      flavor2 || flavor3
        ? [flavor1, flavor2, flavor3].filter(Boolean).join(" / ")
        : flavor1;

    const sizeLabel = it.sizeLabel || it.size || it.sizeName || "";

    const extras = Array.isArray(it.extras) ? it.extras : [];

    const notes = it.kitchenNotes || it.obs || it.observacao || "";

    const details = [
      sizeLabel ? `Tamanho: ${sizeLabel}` : "",
      it.details || "",
      it.description || "",
      notes ? `Obs: ${notes}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      id: it.id || it.lineId || idx,
      title,
      details,
      extras,
      quantity,
      unitPrice: Number(unit || 0),
      total,
      sizeLabel,
      multiFlavor: Boolean(flavor2 || flavor3),
      kind: it.kind || (it.productName ? "drink" : "pizza"),
    };
  });
}

const OrderDetailsModal = ({
  isOpen,
  onClose,
  order,
  onChangeStatus,
  onChangePayment,
  onEditOrder, // novo fluxo de edição
  onPrintKitchen,
  onPrintCounter,
  onPrint,
  onDelete,
  onDuplicate,
}) => {
  if (!order) {
    return null;
  }

  const customer = normalizeCustomer(order);
  const orderId = order.id || order._id;
  const paymentMethod = (order?.payment?.method || order?.paymentMethod || "").toLowerCase();
  const paymentLabel =
    PAYMENT_LABELS[paymentMethod] ||
    order.paymentLabel ||
    order.payment?.label ||
    "Não definido";

  const paymentNotes = order.payment?.notes || order.paymentNotes || "";
  const changeFor =
    order.payment?.changeFor ??
    order.changeFor ??
    order.payment?.troco ??
    null;

  const items = normalizeItems(order.items || []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [items]
  );

  const deliveryFee = Number(
    order.delivery?.fee ??
      order.deliveryFee ??
      order.totals?.deliveryFee ??
      0
  );

  const discount = Number(order.totals?.discount ?? order.discount ?? 0);

  const grandTotal = subtotal + deliveryFee - discount;

  const handleStatusClick = (key) => {
    if (onChangeStatus) onChangeStatus(orderId, key);
  };

  const handlePaymentChange = (evt) => {
    const value = evt.target.value;
    if (onChangePayment) onChangePayment(orderId, value);
  };

  const paymentTagClass =
    PAYMENT_TAG_COLORS[paymentMethod] || "tag--default";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pedido #${order.shortId || order.id || order._id || "–"}`}
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
                <span className="order-kv__value">{customer.name}</span>
              </div>
              <div>
                <span className="order-kv__label">Telefone</span>
                <span className="order-kv__value">
                  {customer.phone || "Não informado"}
                </span>
              </div>
            </div>

            <div className="order-kv">
              <div>
                <span className="order-kv__label">Endereço</span>
                <span className="order-kv__value">
                  {formatAddress(customer.address)}
                </span>
              </div>
              {(customer.address?.reference || customer.address?.complement) && (
                <div>
                  <span className="order-kv__label">Ref. / Compl.</span>
                  <span className="order-kv__value">
                    {[customer.address?.reference, customer.address?.complement]
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
                  {paymentLabel}
                </span>
              </div>
              <div className="order-kv__inline">
                <label className="order-kv__label">Alterar forma</label>
                <select
                  value={paymentMethod || ""}
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
                  {changeFor ? formatCurrency(changeFor) : "Não informado"}
                </span>
              </div>
              <div>
                <span className="order-kv__label">Observações</span>
                <span className="order-kv__value">
                  {paymentNotes || "Nenhuma observação"}
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
              {items.map((item) => (
                <div key={item.id} className="order-item-row">
                  <div className="order-item-row__main">
                    <div className="order-item-row__header">
                      <div className="order-item-row__title">{item.title}</div>
                      <div className="order-item-row__tags">
                        {item.sizeLabel && (
                          <span className="chip">{item.sizeLabel}</span>
                        )}
                        <span className="chip chip--outline">
                          Unitário {formatCurrency(item.unitPrice)}
                        </span>
                      </div>
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
                    <span className="order-item-row__qty">x{item.quantity}</span>
                    <span className="order-item-row__price">
                      {formatCurrency(item.total)}
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
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="order-summary__row">
                <span>Taxa de entrega</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
              <div className="order-summary__row">
                <span>Desconto</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
              <div className="order-summary__row order-summary__row--total">
                <span>Total geral</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </section>

          <section className="order-section order-section--compact">
            <div className="order-actions">
              {typeof onDuplicate === "function" && (
                <Button
                  variant="secondary"
                  onClick={() => onDuplicate(order)}
                >
                  Duplicar
                </Button>
              )}
              {typeof onPrint === "function" && (
                <Button variant="outline" onClick={() => onPrint(order)}>
                  Imprimir pedido
                </Button>
              )}
              {typeof onPrintKitchen === "function" && (
                <Button variant="outline" onClick={onPrintKitchen}>
                  Imprimir cozinha
                </Button>
              )}
              {typeof onPrintCounter === "function" && (
                <Button variant="outline" onClick={onPrintCounter}>
                  Imprimir balcão
                </Button>
              )}
              {typeof onDelete === "function" && (
                <Button variant="outline" onClick={() => onDelete(order)}>
                  Excluir
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="order-details__footer">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
