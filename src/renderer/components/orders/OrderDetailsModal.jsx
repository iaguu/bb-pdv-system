// src/renderer/components/orders/OrderDetailsModal.jsx
import React, { useMemo } from "react";
import Modal from "../common/Modal";

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

/**
 * 💳 PAGAMENTO – aceita chaves novas e antigas
 */
const PAYMENT_METHOD_LABELS = {
  "": "A definir no momento da entrega",
  money: "Dinheiro",
  dinheiro: "Dinheiro",
  cash: "Dinheiro",
  pix: "Pix",
  card: "Cartão",
  cartao: "Cartão (maquininha)",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  vr: "Vale refeição",
};

/**
 * 🚚 TIPO DO PEDIDO
 */
const ORDER_TYPE_LABELS = {
  delivery: "Entrega",
  pickup: "Retirada na loja",
  counter: "Balcão / retirada",
};

/**
 * 📲 ORIGEM DO PEDIDO
 */
const SOURCE_LABELS = {
  website: "Site",
  web: "Site",
  whatsapp: "WhatsApp",
  ifood: "iFood",
  phone: "Telefone",
  local: "Balcão / Local",
  balcão: "Balcão / Local",
  counter: "Balcão / Local",
  desktop: "Sistema",
};

/**
 * 💰 STATUS DO PAGAMENTO
 */
const PAYMENT_STATUS_LABELS = {
  pending: "Pendente",
  paid: "Pago",
  to_define: "A definir",
};

const normalizeStatus = (status) => {
  if (!status) return "open";
  const s = status.toString().toLowerCase();
  if (s === "finalizado" || s === "done") return "done";
  if (s === "cancelado" || s === "cancelled") return "cancelled";
  if (s === "preparing" || s === "em_preparo" || s === "preparo") {
    return "preparing";
  }
  if (s === "out_for_delivery" || s === "delivery" || s === "em_entrega") {
    return "out_for_delivery";
  }
  if (s === "open" || s === "em_aberto") return "open";
  return s;
};

const OrderDetailsModal = ({
  open,
  isOpen,
  order,
  onClose,
  onChangeStatus,
  onPrint,
  onDelete,
  onDuplicate,
}) => {
  // ===== VISIBILIDADE HÍBRIDA (como no Modal base) =====
  const hasControlProp =
    typeof open === "boolean" || typeof isOpen === "boolean";

  const visible = hasControlProp
    ? typeof open === "boolean"
      ? open
      : Boolean(isOpen)
    : true;

  if (!visible || !order) return null;

  // ==========================
  // 🔄 NORMALIZAÇÃO DO PEDIDO
  // ==========================

  // STATUS
  const statusKey = normalizeStatus(order.status || "open");

  // TYPE (novo: type / delivery.mode; legado: orderType)
  const rawOrderType =
    order.type || order.delivery?.mode || order.orderType || "delivery";
  const orderTypeKey = rawOrderType.toString().toLowerCase();

  // PAGAMENTO – novo: payment.method; legado: paymentMethod
  const rawPaymentMethod =
    order.payment?.method || order.paymentMethod || "";
  const paymentMethodKey = rawPaymentMethod.toString().toLowerCase();

  // TOTAIS – novo: totals.*; legado: campos soltos
  const subtotal = Number(
    order.totals?.subtotal ?? order.subtotal ?? 0
  );

  const deliveryFee = Number(
    order.delivery?.fee ??
      order.totals?.deliveryFee ??
      order.deliveryFee ??
      0
  );

  const discountAmount = Number(
    order.totals?.discount ??
      (typeof order.discount === "object"
        ? order.discount.amount
        : order.discount) ??
      0
  );

  const total = Number(
    order.totals?.finalTotal ??
      order.total ??
      subtotal + deliveryFee - discountAmount
  );

  // ITENS – novo: items com name/size/quantity/unitPrice/lineTotal/isHalfHalf…
  const items = Array.isArray(order.items) ? order.items : [];

  // ==========================
  // 👤 DADOS DO CLIENTE
  // ==========================

  const customer =
    order.customerSnapshot ||
    order.customer ||
    {};

  const customerName =
    customer.name ||
    order.customerName ||
    "Cliente não informado";

  const customerPhone =
    customer.phone ||
    order.customerPhone ||
    "";

  const customerCpf =
    customer.cpf ||
    order.customerCpf ||
    "";

  const customerMode = order.customerMode || "registered";

  const counterLabel =
    customerMode === "counter"
      ? order.counterLabel || order.customerName
      : null;

  const customerAddressRaw =
    customer.address ||
    order.customerAddress ||
    order.address ||
    null;

  const addressText = useMemo(() => {
    if (!customerAddressRaw) return "";

    // Se o backend salvou como string, só devolve
    if (typeof customerAddressRaw === "string") {
      return customerAddressRaw;
    }

    if (typeof customerAddressRaw !== "object") return "";

    const {
      street,
      number,
      neighborhood,
      city,
      state,
      cep,
      complement,
    } = customerAddressRaw;

    const main = [
      street && `${street}${number ? ", " + number : ""}`,
      neighborhood,
      city && (state ? `${city} / ${state}` : city),
    ]
      .filter(Boolean)
      .join(" • ");

    const extras = [
      complement && `Compl.: ${complement}`,
      cep && `CEP: ${cep}`,
    ]
      .filter(Boolean)
      .join(" • ");

    return [main, extras].filter(Boolean).join(" • ");
  }, [customerAddressRaw]);

  // ORIGEM
  const sourceKey = (order.source || "local").toString().toLowerCase();
  const sourceLabel = SOURCE_LABELS[sourceKey] || SOURCE_LABELS.local;

  // STATUS DO PAGAMENTO – novo: payment.status; legado: paymentStatus
  const rawPaymentStatus =
    order.payment?.status || order.paymentStatus || "to_define";

  const paymentStatusKey = rawPaymentStatus
    .toString()
    .toLowerCase()
    .replace("-", "_");

  const paymentStatusLabel =
    PAYMENT_STATUS_LABELS[paymentStatusKey] || "A definir";

  // LABEL DO MÉTODO DE PAGAMENTO
  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[paymentMethodKey] ||
    PAYMENT_METHOD_LABELS[""];

  // LABEL DO TIPO DO PEDIDO
  const orderTypeLabel =
    ORDER_TYPE_LABELS[orderTypeKey] || ORDER_TYPE_LABELS.delivery;

  // CRIAÇÃO
  const createdAt = order.createdAt ? new Date(order.createdAt) : null;
  const createdAtLabel =
    createdAt &&
    createdAt.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  // Tempo desde criação (SLA)
  const now = new Date();
  const diffMinutes =
    createdAt != null
      ? Math.round((now.getTime() - createdAt.getTime()) / 60000)
      : null;

  let slaLabel = "";
  let slaTone = "";

  if (diffMinutes != null) {
    if (diffMinutes < 20) {
      slaLabel = `${diffMinutes} min • Rápido`;
      slaTone = "good";
    } else if (diffMinutes < 40) {
      slaLabel = `${diffMinutes} min • Dentro da meta`;
      slaTone = "medium";
    } else {
      slaLabel = `${diffMinutes} min • Atrasado`;
      slaTone = "bad";
    }
  }

  // Tags (VIP, primeira compra, etc.)
  const tagArray = [
    ...(Array.isArray(customer.tags) ? customer.tags : []),
    ...(Array.isArray(order.customerTags) ? order.customerTags : []),
  ];
  if (customer.isVip || order.isVip) tagArray.push("VIP");
  if (order.isFirstOrder) tagArray.push("Primeiro pedido");

  const uniqueTags = Array.from(new Set(tagArray.filter(Boolean)));

  // Timeline / Histórico
  const timelineEvents = useMemo(() => {
    const historyArray = Array.isArray(order.history) ? order.history : [];

    const parsedHistory = historyArray
      .map((h, idx) => {
        const atRaw = h.at || h.timestamp || h.date || null;
        const status = normalizeStatus(h.status || h.state || "open");
        const at = atRaw ? new Date(atRaw) : null;
        return {
          id: `hist-${idx}`,
          status,
          at,
        };
      })
      .filter((ev) => ev.at instanceof Date && !isNaN(ev.at.getTime()))
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    if (!createdAt && parsedHistory.length === 0) return [];

    const finalList = [...parsedHistory];

    // Garante um evento de criação
    if (createdAt) {
      finalList.unshift({
        id: "created",
        status: "created",
        at: createdAt,
      });
    }

    // Se o status atual não está na lista, adiciona
    const hasCurrent = finalList.some(
      (ev) => ev.status === statusKey
    );
    if (!hasCurrent) {
      finalList.push({
        id: "current",
        status: statusKey,
        at: now,
      });
    }

    return finalList;
  }, [order.history, createdAt, statusKey]);

  const titleId = order.id || order.code || order.numeroPedido;

  // ==========================
  // HANDLERS
  // ==========================

  const handleStatusClick = (key) => {
    if (!onChangeStatus) return;
    if (key === statusKey) return;

    onChangeStatus(key);

    if (onClose) {
      onClose();
    }
  };

  // 🔄 NOVA LÓGICA DE IMPRESSÃO (silent + Electron IPC)
  const handlePrintClick = async (mode = "full") => {
    if (!order) return;

    const safeMode = mode || "full";

    // Delega para o callback da página, se existir
    if (typeof onPrint === "function") {
      onPrint(order, safeMode);
      return;
    }

    try {
      // Novo fluxo: IPC "print:order" via preload
      if (window.electronAPI?.printOrder) {
        await window.electronAPI.printOrder({
          order,
          options: {
            mode: safeMode, // "full" | "kitchen" | "counter"
            silent: true,   // impressão silenciosa por padrão
          },
        });
      }
      // Fallback: engine antigo, se ainda existir
      else if (
        window.printEngine &&
        typeof window.printEngine.printOrder === "function"
      ) {
        await window.printEngine.printOrder(order, {
          mode: safeMode,
          silent: true,
        });
      } else {
        console.warn(
          "[OrderDetailsModal] Nenhuma API de impressão disponível (electronAPI.printOrder / printEngine.printOrder)."
        );
      }
    } catch (err) {
      console.error("Erro ao imprimir pedido:", err);
    }
  };

  const handleDeleteClick = () => {
    if (!onDelete || !order) return;

    const id = titleId;
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o pedido #${id || ""}? Essa ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    onDelete(order);

    if (onClose) {
      onClose();
    }
  };

  const handleDuplicateClick = () => {
    if (!onDuplicate || !order) return;
    onDuplicate(order);
  };

  const slaClass =
    slaTone === "good"
      ? "od-sla od-sla--good"
      : slaTone === "medium"
      ? "od-sla od-sla--medium"
      : slaTone === "bad"
      ? "od-sla od-sla--bad"
      : "od-sla";

  return (
    <Modal
      open={visible}
      onClose={onClose}
      title={`Pedido #${titleId || ""}`}
      size="lg"
    >
      <div className="order-details-modal">
        {/* GRID PRINCIPAL: CLIENTE / STATUS */}
        <div className="order-details-grid">
          {/* CLIENTE */}
          <section className="order-details-card order-details-card--customer">
            <h3 className="order-details-card-title">Cliente</h3>

            <div className="order-details-customer-main">
              <div className="od-customer-header">
                <div className="od-customer-name">{customerName}</div>

                {uniqueTags.length > 0 && (
                  <div className="od-customer-tags">
                    {uniqueTags.map((tag) => (
                      <span key={tag} className="od-tag od-tag--pill">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="od-customer-meta">
                {customerMode === "counter" && counterLabel && (
                  <div className="od-customer-meta-row">
                    <span className="od-label">Atendimento</span>
                    <span className="od-value">{counterLabel}</span>
                  </div>
                )}

                {customerPhone && (
                  <div className="od-customer-meta-row">
                    <span className="od-label">Telefone</span>
                    <span className="od-value">{customerPhone}</span>
                  </div>
                )}

                {customerCpf && (
                  <div className="od-customer-meta-row">
                    <span className="od-label">CPF</span>
                    <span className="od-value">{customerCpf}</span>
                  </div>
                )}

                {addressText && (
                  <div className="od-customer-meta-row">
                    <span className="od-label">Endereço</span>
                    <span className="od-value">{addressText}</span>
                  </div>
                )}

                {order.orderNotes && (
                  <div className="od-customer-meta-row">
                    <span className="od-label">Obs. do pedido</span>
                    <span className="od-value">{order.orderNotes}</span>
                  </div>
                )}

                {order.kitchenNotes && (
                  <div className="od-customer-meta-row">
                    <span className="od-label">Obs. cozinha</span>
                    <span className="od-value">{order.kitchenNotes}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* STATUS + PAGAMENTO */}
          <section className="order-details-card order-details-card--status">
            <h3 className="order-details-card-title">Status e pagamento</h3>

            <div className="od-status-chip-row">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={[
                    "od-status-chip",
                    `od-status-chip--${opt.tone}`,
                    opt.key === statusKey
                      ? "od-status-chip--active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleStatusClick(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="od-status-secondary-row">
              <span className="od-tag">Tipo: {orderTypeLabel}</span>
              <span className="od-tag">Origem: {sourceLabel}</span>
              <span className="od-tag od-tag--pill">
                {paymentStatusLabel}
              </span>
              {slaLabel && <span className={slaClass}>{slaLabel}</span>}
            </div>

            <div className="od-status-payment-info">
              <div className="od-payment-row">
                <span className="od-label">Pagamento</span>
                <span className="od-value od-value--strong">
                  {paymentMethodLabel}
                </span>
              </div>

              {createdAtLabel && (
                <div className="od-payment-row od-payment-row--muted">
                  <span className="od-label">Criado em</span>
                  <span className="od-value">{createdAtLabel}</span>
                </div>
              )}

              {order.summary && (
                <div className="od-payment-row od-payment-row--muted">
                  <span className="od-label">Resumo</span>
                  <span className="od-value">{order.summary}</span>
                </div>
              )}
            </div>

            <div className="od-totals-card">
              <div className="od-totals-row">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="od-totals-row">
                <span>Entrega</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
              <div className="od-totals-row">
                <span>Desconto</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
              <div className="od-totals-row od-totals-row--total">
                <span>Total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
            </div>

            <div className="od-actions-row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteClick}
              >
                Excluir pedido
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDuplicateClick}
              >
                Duplicar pedido
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handlePrintClick("full")}
              >
                Imprimir pedido
              </button>
            </div>

            <div className="od-actions-row od-actions-row--small">
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={() => handlePrintClick("kitchen")}
              >
                Reimprimir comanda (cozinha)
              </button>
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={() => handlePrintClick("counter")}
              >
                Reimprimir cupom (balcão)
              </button>
            </div>
          </section>
        </div>

        {/* TIMELINE / HISTÓRICO */}
        {timelineEvents.length > 0 && (
          <section className="order-details-card order-details-card--timeline">
            <h3 className="order-details-card-title">Histórico</h3>
            <div className="od-timeline">
              {timelineEvents.map((ev) => (
                <div key={ev.id} className="od-timeline-item">
                  <div className="od-timeline-dot" />
                  <div className="od-timeline-content">
                    <div className="od-timeline-status">
                      {ev.status === "created"
                        ? "Pedido criado"
                        : STATUS_OPTIONS.find(
                            (s) => s.key === ev.status
                          )?.label || ev.status}
                    </div>
                    {ev.at && (
                      <div className="od-timeline-date">
                        {ev.at.toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ITENS */}
        <section className="order-details-items">
          <div className="order-details-items-header">
            <h3 className="order-details-card-title">Itens</h3>
          </div>

          {items.length === 0 ? (
            <div className="order-details-items-empty">
              Nenhum item cadastrado nesse pedido.
            </div>
          ) : (
            <div className="order-details-items-list">
              {items.map((item, idx) => {
                const qty = item.quantity || item.qty || 1;

                const sizeLabel =
                  item.sizeLabel ||
                  item.size ||
                  "";

                const flavor1Name =
                  item.name ||
                  item.flavor1Name ||
                  "Item";

                const flavor2Name =
                  item.halfDescription ||
                  item.flavor2Name ||
                  "";

                const flavor3Name =
                  item.flavor3Name ||
                  item.flavor3Label ||
                  "";

                const flavors = [flavor1Name, flavor2Name, flavor3Name].filter(
                  Boolean
                );

                const unitPrice = Number(
                  item.unitPrice || item.price || 0
                );
                const lineTotal =
                  Number(item.lineTotal || item.total || 0) ||
                  unitPrice * qty;

                return (
                  <div
                    key={item.lineId || item.id || idx}
                    className="order-item-row"
                  >
                    <div className="order-item-main">
                      <div className="order-item-title-row">
                        <span className="order-item-qty">
                          {qty}x
                        </span>
                        <span className="order-item-name">
                          {sizeLabel && `${sizeLabel} `}
                          {flavors.join(" / ")}
                        </span>
                      </div>

                      <div className="order-item-meta">
                        <span>
                          Unitário: {formatCurrency(unitPrice)}
                        </span>
                        <span>
                          Linha: {formatCurrency(lineTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="order-item-prices">
                      <div className="order-item-unit">
                        <span className="order-item-price-label">
                          R$ un.
                        </span>
                        <span className="order-item-price">
                          {formatCurrency(unitPrice)}
                        </span>
                      </div>
                      <div className="order-item-total">
                        <span className="order-item-price-label">
                          Total
                        </span>
                        <span className="order-item-price order-item-price--strong">
                          {formatCurrency(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
