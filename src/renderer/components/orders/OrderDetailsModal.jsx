import React, { useMemo } from "react";
import { motion } from "framer-motion";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { OrderIcon } from "./OrderIcons";
import { normalizeStatus } from "../../utils/orderUtils";

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
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  pix: "PIX",
  credit: "Crédito",
  debit: "Débito",
  ifood: "iFood",
};

const SOURCE_LABELS = {
  website: "Site",
  web: "Site",
  local: "Balcão / Local",
  balcao: "Balcão / Local",
  "balcao": "Balcão / Local",
  counter: "Balcão / Local",
  desktop: "Balcão / Local",
  delivery: "Delivery",
  ifood: "iFood",
  whatsapp: "WhatsApp",
  phone: "Telefone",
};

const MOTOBOY_STATUS_MAP = {
  waiting_qr: "Aguardando motoboy",
  out_for_delivery: "Em rota",
  delivering: "Em rota",
  done: "Entrega finalizada",
};

function normalizeCustomer(order) {
  const snap = order.customerSnapshot || order.customer || {};
  return {
    name: snap.name || order.customerName || "Cliente",
    phone: snap.phone || order.customerPhone || order.phone || "",
    address:
      order.delivery.address ||
      snap.address || {
        street: order.street,
        number: order.number,
        neighborhood: order.neighborhood,
        city: order.city,
        state: order.state,
        cep: order.cep,
        reference: order.reference,
        complement: order.complement,
      },
  };
}

function normalizeAddressParts(addr = {}) {
  return {
    street: addr.street || addr.rua || "",
    number: addr.number || addr.numero || "",
    neighborhood: addr.neighborhood || addr.bairro || "",
    city: addr.city || addr.cidade || "",
    state: addr.state || addr.uf || "",
    cep: addr.cep || addr.CEP || "",
    reference: addr.reference || addr.referencia || "",
    complement: addr.complement || addr.complemento || "",
  };
}

function formatAddress(addr = {}) {
  const normalized = normalizeAddressParts(addr);
  const parts = [];
  if (normalized.street) {
    parts.push(
      normalized.number
        ? `${normalized.street}, ${normalized.number}`
        : normalized.street
    );
  }
  if (normalized.neighborhood) parts.push(normalized.neighborhood);
  if (normalized.city) parts.push(normalized.city);
  if (normalized.state) parts.push(normalized.state);
  if (normalized.cep) parts.push(`CEP ${normalized.cep}`);
  return parts.filter(Boolean).join(" - ") || "Sem endereço";
}

function buildMapsUrl(addr = {}) {
  const normalized = normalizeAddressParts(addr);
  const parts = [
    normalized.street &&
      (normalized.number
        ? `${normalized.street}, ${normalized.number}`
        : normalized.street),
    normalized.neighborhood,
    normalized.city,
    normalized.state,
    normalized.cep ? `CEP ${normalized.cep}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return "";
  return `https://www.google.com/maps/search/api=1&query=${encodeURIComponent(
    parts.join(" - ")
  )}`;
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

    const flavor1Raw =
      it.name ||
      it.title ||
      it.itemName ||
      it.description ||
      it.flavor1Name ||
      it.productName ||
      it.product.name ||
      it.label ||
      "";
    const flavor2 = it.halfDescription || it.flavor2Name || "";
    const flavor3 = it.flavor3Name || "";

    const flavor1 = String(flavor1Raw || "").trim();

    const titleBase = flavor1 || "Item sem nome";
    const title =
      flavor2 || flavor3
        ? [titleBase, flavor2, flavor3].filter(Boolean).join(" / ")
        : titleBase;

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
      .join("  -  ");

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
  onEditOrder, // novo fluxo de edicao
  onPrintKitchen,
  onPrintCounter,
  onPrint,
  onDelete,
  onDuplicate,
}) => {
  if (!order) {
    return null;
  }
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  const customer = normalizeCustomer(order);
  const orderId = order.id || order._id;
  const paymentMethod = (order.payment.method || order.paymentMethod || "").toLowerCase();
  const paymentLabel =
    PAYMENT_LABELS[paymentMethod] ||
    order.paymentLabel ||
    order.payment.label ||
    "Não definido";
  const paymentMethod = (order.payment.method || order.paymentMethod || "")
    .toString()
    .toLowerCase()
    .trim();
  const paymentLabel = paymentMethod
    ? PAYMENT_LABELS[paymentMethod] || paymentMethod
    : "A definir";
  const paymentStatusRaw = order.payment.status || order.paymentStatus || "";
  const paymentStatus =
    paymentStatusRaw && paymentStatusRaw !== "to_define"
      ? paymentStatusRaw
      : "A definir";

  const paymentNotes = order.payment.notes || order.paymentNotes || "";
  const changeFor =
    order.payment.changeFor ??
    order.changeFor ??
    order.payment.troco ??
    null;

  const items = normalizeItems(order.items || []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [items]
  );

  const deliveryFee = Number(
    order.delivery.fee ??
      order.deliveryFee ??
      order.totals.deliveryFee ??
      0
  );

  const discount = Number(order.totals.discount ?? order.discount ?? 0);

  const grandTotal = subtotal + deliveryFee - discount;

  const normalizedStatus = normalizeStatus(order.status || "open");
  const statusLabel = STATUS_OPTIONS.find((s) => s.key == normalizedStatus)?.label || "Em aberto";
  const sourceKey = (order.source || "local").toString().toLowerCase();
  const sourceLabel = SOURCE_LABELS[sourceKey] || SOURCE_LABELS.local;
  const mapsUrl = buildMapsUrl(customer.address);
  const motoboyName =
    order.motoboyName || order.delivery.motoboyName || null;
  const motoboyStatusKey = (
    order.motoboyStatus ||
    order.delivery.motoboyStatus ||
    ""
  )
    .toString()
    .toLowerCase()
    .trim();
  const motoboyStatus =
    MOTOBOY_STATUS_MAP[motoboyStatusKey] || motoboyStatusKey || "";
  const orderNotes = order.orderNotes || order.notes || "";
  const kitchenNotes = order.kitchenNotes || "";

  const handleStatusClick = (key) => {
    if (onChangeStatus) onChangeStatus(orderId, key);
  };

  const handlePaymentChange = (evt) => {
    const value = evt.target.value;
    if (onChangePayment) onChangePayment(orderId, value);
  };

  const handleEditSection = (section) => {
    if (onEditOrder) onEditOrder(order, section);
  };

  const handleCopyPhone = async () => {
    const phone = customer.phone || "";
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
    } catch (err) {
      window.prompt("Copie o telefone:", phone);
    }
  };

  const paymentTagClass =
    PAYMENT_TAG_COLORS[paymentMethod] || "tag--default";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pedido #${order.shortId || order.id || order._id || ""}`}
      className="order-details-modal"
    >
      <motion.div className="order-details__body" {...bodyMotion}>
        <div className="order-details__meta">
          <span className="modal-badge modal-badge--accent">{sourceLabel}</span>
          <span className="modal-badge modal-badge--info">{paymentLabel}</span>
          <span className="modal-badge">{statusLabel}</span>
          <span className="hint-dot" data-tooltip="Resumo rápido do pedido.">?</span>
        </div>
        <div className="order-details__column order-details__column--main">
          <section className="order-section">
            <div className="order-section__header">
              <h3 className="order-section__title">Cliente</h3>
              {order.createdAt && (
                <span className="order-section__sub">
                  {new Date(order.createdAt).toLocaleString("pt-BR")}
                </span>
              )}
              {onEditOrder && (
                <button
                  type="button"
                  className="order-section__link"
                  onClick={() => handleEditSection("customer")}
                >
                  <OrderIcon name="edit" />
                  Editar cliente
                </button>
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
                {customer.phone && (
                  <button
                    type="button"
                    className="order-section__link"
                    onClick={handleCopyPhone}
                  >
                    <OrderIcon name="copy" />
                    Copiar
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="order-section">
            <div className="order-section__header">
              <h3 className="order-section__title">Endereco</h3>
              {onEditOrder && (
                <button
                  type="button"
                  className="order-section__link"
                  onClick={() => handleEditSection("address")}
                >
                  <OrderIcon name="edit" />
                  Editar endereco
                </button>
              )}
            </div>
            <div className="order-kv">
              <div>
                <span className="order-kv__label">Endereço</span>
                <span className="order-kv__value">
                  {formatAddress(customer.address)}
                </span>
                {mapsUrl && (
                  <a
                    className="order-section__link"
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir mapa
                  </a>
                )}
              </div>
              <div>
                <span className="order-kv__label">Origem</span>
                <span className="order-kv__value">{sourceLabel}</span>
              </div>
              {(customer.address.reference || customer.address.complement) && (
                <div>
                  <span className="order-kv__label">Ref. / Compl.</span>
                  <span className="order-kv__value">
                    {[customer.address.reference, customer.address.complement]
                      .filter(Boolean)
                      .join("  ")}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="order-section order-section--payment">
            <div className="order-section__header">
              <h3 className="order-section__title">Pagamento</h3>
              {onEditOrder && (
                <button
                  type="button"
                  className="order-section__link"
                  onClick={() => handleEditSection("payment")}
                >
                  <OrderIcon name="edit" />
                  Editar pagamento
                </button>
              )}
            </div>
            <div className="order-kv order-kv--payment">
              <div className="order-kv__stack">
                <span className="order-kv__label">Forma atual</span>
                <span className={`tag ${paymentTagClass}`}>
                  {paymentLabel}
                </span>
              </div>
              <div className="order-kv__stack">
                <span className="order-kv__label">Status</span>
                <span className="order-kv__value">
                  {paymentStatus || "to_define"}
                </span>
              </div>
              <div className="order-kv__inline order-kv__inline--select">
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

            <div className="order-kv order-kv--payment">
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
        
          <section className="order-section">
            <div className="order-section__header">
              <h3 className="order-section__title">Itens</h3>
              {onEditOrder && (
                <button
                  type="button"
                  className="order-section__link"
                  onClick={() => handleEditSection("items")}
                >
                  <OrderIcon name="edit" />
                  Editar itens
                </button>
              )}
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
            <div className="order-section__header">
              <h3 className="order-section__title">Status do pedido</h3>
              {onEditOrder && (
                <button
                  type="button"
                  className="order-section__link"
                  onClick={() => handleEditSection("status")}
                >
                  <OrderIcon name="edit" />
                  Editar status
                </button>
              )}
            </div>
            <div className="status-chips">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={
                    "status-chip " +
                    (normalizedStatus === s.key ? "status-chip--active" : "") +
                    " status-chip--" +
                    s.tone
                  }
                  onClick={() => handleStatusClick(s.key)}
                >
                  <span className="status-chip__dot" aria-hidden="true" />
                  <span className="status-chip__label">{s.label}</span>
                  {normalizedStatus === s.key && (
                    <span className="status-chip__current">Atual</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {(orderNotes || kitchenNotes) && (
            <section className="order-section">
              <h3 className="order-section__title">Observações</h3>
              <div className="order-section__header">
                <h3 className="order-section__title">Informacoes adicionais</h3>
                {onEditOrder && (
                  <button
                    type="button"
                    className="order-section__link"
                    onClick={() => handleEditSection("options")}
                  >
                    <OrderIcon name="edit" />
                    Editar informacoes
                  </button>
                )}
              </div>
              {orderNotes && (
                <div className="order-kv">
                  <span className="order-kv__label">Pedido</span>
                  <span className="order-kv__value">{orderNotes}</span>
                </div>
              )}
              {kitchenNotes && (
                <div className="order-kv">
                  <span className="order-kv__label">Cozinha</span>
                  <span className="order-kv__value">{kitchenNotes}</span>
                </div>
              )}
            </section>
          )}

          {motoboyName && (
            <section className="order-section">
              <h3 className="order-section__title">Motoboy</h3>
              <div className="order-kv">
                <span className="order-kv__label">Nome</span>
                <span className="order-kv__value">{motoboyName}</span>
              </div>
              {motoboyStatus && (
                <div className="order-kv">
                  <span className="order-kv__label">Status</span>
                  <span className="order-kv__value">{motoboyStatus}</span>
                </div>
              )}
            </section>
          )}

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
                  <OrderIcon name="copy" />
                  Duplicar
                </Button>
              )}
              {typeof onPrint === "function" && (
                <Button variant="outline" onClick={() => onPrint(order)}>
                  <OrderIcon name="print" />
                  Imprimir pedido
                </Button>
              )}
              {typeof onPrintKitchen === "function" && (
                <Button
                  variant="outline"
                  onClick={() => onPrintKitchen(order)}
                >
                  <OrderIcon name="print" />
                  Imprimir cozinha
                </Button>
              )}
              {typeof onPrintCounter === "function" && (
                <Button
                  variant="outline"
                  onClick={() => onPrintCounter(order)}
                >
                  <OrderIcon name="print" />
                  Imprimir balcão
                </Button>
              )}
              {typeof onDelete === "function" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const confirmed = window.confirm(
                      "Deseja realmente excluir este pedido? Esta ação não pode ser desfeita."
                    );
                    if (confirmed) onDelete(order);
                  }}
                >
                  <OrderIcon name="trash" />
                  Excluir
                </Button>
              )}
            </div>
          </section>
        </div>
      </motion.div>

      <div className="order-details__footer">
        <Button variant="outline" onClick={onClose}>
          <OrderIcon name="close" />
          Fechar
        </Button>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
