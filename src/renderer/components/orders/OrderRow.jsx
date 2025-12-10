import React from "react";

function formatCurrency(value) {
  const v = Number(value || 0);
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* ============================== */
/* MAPS                           */
/* ============================== */

const STATUS_MAP = {
  open: { label: "Em aberto", tone: "open" },
  preparing: { label: "Em preparo", tone: "preparing" },
  ready: { label: "Pronto", tone: "ready" },
  delivering: { label: "Em entrega", tone: "delivering" },
  done: { label: "Finalizado", tone: "done" },
  cancelled: { label: "Cancelado", tone: "cancelled" },
};

const SOURCE_MAP = {
  website: "Site",
  web: "Site",
  local: "Balcão / Local",
  balcão: "Balcão / Local",
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

/* ======================================================= */
/* COMPONENTE: CABEÇALHO DO GRUPO DE PEDIDOS (NOVO)        */
/* ======================================================= */

export const OrderGroupHeader = ({ title, count, tone = "default" }) => {
  return (
    <div className={`order-group-header order-group-header--${tone}`}>
      <div className="order-group-header-title">{title}</div>
      <div className="order-group-header-subtitle">
        {count} {count === 1 ? "pedido" : "pedidos"}
      </div>
    </div>
  );
};

/* ======================================================= */
/* COMPONENTE: LINHA DO PEDIDO                             */
/* ======================================================= */

const OrderRow = ({ order, onClick, isNew }) => {
  const {
    id,
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

  const customerName = customerSnapshot?.name || "Cliente";

  /* Status – normaliza out_for_delivery -> delivering */
  const rawStatusKey = (status || "open").toString().toLowerCase().trim();
  const normalizedStatusKey =
    rawStatusKey === "out_for_delivery" || rawStatusKey === "in_delivery"
      ? "delivering"
      : rawStatusKey;

  const statusInfo =
    STATUS_MAP[normalizedStatusKey] || {
      label: rawStatusKey || "Em aberto",
      tone: "default",
    };

  /* Origem */
  const sourceKey = (source || "local").toLowerCase().trim();
  const sourceLabel =
    SOURCE_MAP[sourceKey] || SOURCE_MAP.local || "Balcão / Local";

  /* Total */
  const total =
    totals?.finalTotal ?? totals?.total ?? order?.total ?? 0;

  /* Itens */
  const detailedItems =
    Array.isArray(items) && items.length > 0
      ? items.map((item) => {
          const qty = item.quantity || item.qty || 1;
          const name = item.name || item.title || "Produto";
          const size = item.sizeLabel || item.size || "";
          const extra =
            size && !String(name).toLowerCase().includes(size)
              ? ` (${size})`
              : "";
          return `${qty}x ${name}${extra}`;
        })
      : [];

  let summaryText = "Sem itens cadastrados";
  if (detailedItems.length === 1) {
    summaryText = detailedItems[0];
  } else if (detailedItems.length === 2) {
    summaryText = `${detailedItems[0]} • ${detailedItems[1]}`;
  } else if (detailedItems.length > 2) {
    const extras = detailedItems.length - 2;
    summaryText = `${detailedItems[0]} • ${detailedItems[1]} • +${extras} itens`;
  }

  /* Data */
  const timeLabel =
    createdAt &&
    new Date(createdAt).toLocaleString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });

  /* Motoboy */
  const motoboyName =
    motoboyNameRoot ||
    delivery?.motoboyName ||
    null;

  const motoboyStatusKey = (
    motoboyStatusRoot ||
    delivery?.motoboyStatus ||
    ""
  )
    .toString()
    .toLowerCase()
    .trim();

  const motoboyStatusLabel =
    MOTOBOY_STATUS_MAP[motoboyStatusKey] || null;

  const classes = [
    "order-row",
    `order-row--status-${statusInfo.tone}`,
    sourceKey === "website" || sourceKey === "web"
      ? "order-row--web"
      : "",
    isNew ? "order-row--new" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} onClick={onClick}>
      {/* ESQUERDA */}
      <div className="order-row-left">
        <div className="order-row-top">
          <span className="order-row-id">
            #{String(id || "").slice(-6) || "—"}
          </span>
          <span className="order-row-separator">•</span>
          <span className="order-row-customer">{customerName}</span>
        </div>

        <div className="order-row-summary">{summaryText}</div>

        <div className="order-row-meta">
          {/* Status */}
          <span
            className={
              "order-row-chip order-row-chip--status " +
              `order-row-chip--status-${statusInfo.tone}`
            }
          >
            {statusInfo.label}
          </span>

          {/* Origem */}
          <span className="order-row-chip">
            <span className="order-row-chip-label">Origem:</span>
            <span className="order-row-source">{sourceLabel}</span>
          </span>

          {/* Motoboy (se houver) */}
          {motoboyName && (
            <span className="order-row-chip order-row-chip--motoboy">
              <span className="order-row-chip-label">🛵 Motoboy:</span>
              <span className="order-row-motoboy-name">
                {motoboyName}
              </span>
              {motoboyStatusLabel && (
                <span className="order-row-motoboy-status">
                  {" "}
                  • {motoboyStatusLabel}
                </span>
              )}
            </span>
          )}

          {/* Novo */}
          {isNew && (
            <span className="order-row-chip order-row-chip--new">
              Novo pedido
            </span>
          )}
        </div>
      </div>

      {/* DIREITA */}
      <div className="order-row-right">
        {timeLabel && (
          <div className="order-row-time">{timeLabel}</div>
        )}

        <div className="order-row-total-wrapper">
          <span className="order-row-total-label">Total</span>
          <div className="order-row-total">
            {formatCurrency(total)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderRow;
