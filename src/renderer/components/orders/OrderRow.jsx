import React from "react";
import { normalizeStatus } from "../../utils/orderUtils";

function formatCurrency(value) {
  const v = Number(value || 0);
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const STATUS_MAP = {
  open: { label: "Em aberto", tone: "open" },
  preparing: { label: "Em preparo", tone: "preparing" },
  ready: { label: "Pronto", tone: "ready" },
  delivering: { label: "Em entrega", tone: "delivering" },
  out_for_delivery: { label: "Em entrega", tone: "delivering" },
  done: { label: "Finalizado", tone: "done" },
  cancelled: { label: "Cancelado", tone: "cancelled" },
};

const SOURCE_MAP = {
  website: "Site",
  web: "Site",
  local: "Balcao / Local",
  balcao: "Balcao / Local",
  "balcão": "Balcao / Local",
  counter: "Balcao / Local",
  desktop: "Balcao / Local",
  delivery: "Delivery",
  ifood: "iFood",
  whatsapp: "WhatsApp",
  phone: "Telefone",
};

const PAYMENT_LABELS = {
  money: "Dinheiro",
  pix: "Pix",
  credit: "Crédito",
  debit: "Débito",
  ifood: "iFood",
};

const MOTOBOY_STATUS_MAP = {
  waiting_qr: "Aguardando motoboy",
  out_for_delivery: "Em rota",
  delivering: "Em rota",
  done: "Entrega finalizada",
};

export const OrderGroupHeader = ({ title, count, tone = "default" }) => {
  return (
    <div className={`order-group-header order-group-header--${tone}`}>
      <div className="order-group-header-title">{title}</div>
      <div className="order-group-header-subtitle">
        {count} {count === 1  "pedido" : "pedidos"}
      </div>
    </div>
  );
};

const OrderRow = ({ order, onClick, isNew }) => {
  const {
    id,
    _id,
    customerSnapshot,
    status,
    source,
    createdAt,
    items = [],
    totals,
    motoboyName: motoboyNameRoot,
    motoboyStatus: motoboyStatusRoot,
    delivery,
  } = order || {};

  const orderId = id || _id || "";
  const orderCode = orderId  `#${String(orderId).slice(-6)}` : "#—";

  const customerName =
    customerSnapshot.name || order.customer.name || "Cliente";

  const normalizedStatusKey = normalizeStatus(status || "open");

  const statusInfo =
    STATUS_MAP[normalizedStatusKey] || {
      label: normalizedStatusKey || "Em aberto",
      tone: "default",
    };

  const sourceKey = (source || "local").toLowerCase().trim();
  const sourceLabel =
    SOURCE_MAP[sourceKey] || SOURCE_MAP.local || "Balcao / Local";
  const isWebSource = sourceKey === "website" || sourceKey === "web";

  const paymentKey = (
    order.payment.method ||
    order.paymentMethod ||
    ""
  )
    .toString()
    .toLowerCase();
  const paymentLabel =
    PAYMENT_LABELS[paymentKey] || (paymentKey  paymentKey : "");

  const total =
    totals.finalTotal  totals.total  order.total  0;

  const detailedItems =
    Array.isArray(items) && items.length > 0
       items.map((item) => {
          const qty = item.quantity || item.qty || 1;
          const name = item.name || item.title || "Produto";
          const size = item.sizeLabel || item.size || "";
          const extra =
            size && !String(name).toLowerCase().includes(size.toLowerCase())
               ` (${size})`
              : "";
          return `${qty}x ${name}${extra}`;
        })
      : [];

  let summaryText = "Nenhum item cadastrado";
  if (detailedItems.length === 1) {
    summaryText = detailedItems[0];
  } else if (detailedItems.length === 2) {
    summaryText = `${detailedItems[0]} • ${detailedItems[1]}`;
  } else if (detailedItems.length > 2) {
    const extras = detailedItems.length - 2;
    summaryText = `${detailedItems[0]} • ${detailedItems[1]} • +${extras} itens`;
  }

  const timeLabel =
    createdAt &&
    new Date(createdAt).toLocaleString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });

  const motoboyName =
    motoboyNameRoot ||
    delivery.motoboyName ||
    null;

  const motoboyStatusKey = (
    motoboyStatusRoot ||
    delivery.motoboyStatus ||
    ""
  )
    .toString()
    .toLowerCase()
    .trim();

  const motoboyStatusLabel =
    MOTOBOY_STATUS_MAP[motoboyStatusKey] || null;

  const createdDate = createdAt  new Date(createdAt) : null;
  const minutesSince =
    createdDate && !Number.isNaN(createdDate.getTime())
       Math.round((Date.now() - createdDate.getTime()) / 60000)
      : null;
  const isOpenLike = ["open", "preparing", "out_for_delivery"].includes(
    normalizedStatusKey
  );
  const minMinutes =
    typeof order.deliveryMinMinutes === "number"
       order.deliveryMinMinutes
      : 0;
  const lateThreshold = minMinutes > 0  minMinutes : 40;
  const isLate =
    isOpenLike && minutesSince != null && minutesSince >= lateThreshold;

  const elapsedLabel =
    minutesSince == null
       ""
      : minutesSince < 60
       `${minutesSince} min`
      : `${Math.floor(minutesSince / 60)}h ${minutesSince % 60}m`;

  const classes = [
    "order-row",
    `order-row--status-${statusInfo.tone}`,
    isNew  "order-row--new" : "",
    isLate  "order-row--late" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} onClick={onClick}>
      <div className="order-row-left">
        <div className="order-row-top">
          <span className="order-row-id">{orderCode}</span>
          <span className="order-row-separator">•</span>
          <span className="order-row-customer">{customerName}</span>
        </div>

        <div className="order-row-summary">{summaryText}</div>

        <div className="order-row-meta">
          <span
            className={
              "order-row-chip order-row-chip--status " +
              `order-row-chip--status-${statusInfo.tone}`
            }
          >
            {statusInfo.label}
          </span>

          <span className="order-row-chip">
            <span className="order-row-chip-label">Origem:</span>
            <span className="order-row-source">{sourceLabel}</span>
          </span>

          {paymentLabel && (
            <span className="order-row-chip order-row-chip--payment">
              <span className="order-row-chip-label">Pagamento:</span>
              <span className="order-row-payment">{paymentLabel}</span>
            </span>
          )}

          {motoboyName && (
            <span className="order-row-chip order-row-chip--motoboy">
              <span className="order-row-chip-label">Motoboy:</span>
              <span className="order-row-motoboy-name">
                {motoboyName}
              </span>
              {motoboyStatusLabel && (
                <span className="order-row-motoboy-status">
                  {` • ${motoboyStatusLabel}`}
                </span>
              )}
            </span>
          )}

          {isNew && (
            <span className="order-row-chip order-row-chip--new">
              Novo pedido
            </span>
          )}
          {isLate && minutesSince != null && (
            <span className="order-row-chip order-row-chip--late">
              Atrasado {minutesSince} min
            </span>
          )}
        </div>
      </div>

      <div className="order-row-right">
        {isWebSource && (
          <span className="order-row-web-badge">WEB</span>
        )}
        {timeLabel && (
          <div className="order-row-time" title={timeLabel}>
            {timeLabel}
          </div>
        )}
        {elapsedLabel && (
          <div
            className={
              "order-row-elapsed" + (isLate  " order-row-elapsed--late" : "")
            }
            title={elapsedLabel}
          >
            {elapsedLabel}
          </div>
        )}

        <div className="order-row-total-wrapper">
          <span className="order-row-total-label">Total</span>
          <div className="order-row-total">
            {formatCurrency(total)}
          </div>
        </div>
      </div>
    </button>
  );
};

export default OrderRow;
