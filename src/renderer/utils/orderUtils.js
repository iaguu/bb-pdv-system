// src/renderer/utils/orderUtils.js
// Utilitários compartilhados para normalização de pedidos (Order V1)

export const ORDER_STATUS_PRESETS = [
  {
    key: "open",
    label: "Em aberto",
    tone: "open",
    statuses: ["open", "preparing", "out_for_delivery"],
  },
  {
    key: "preparing",
    label: "Em preparo",
    tone: "preparing",
    statuses: ["preparing"],
  },
  {
    key: "out_for_delivery",
    label: "Saiu p/ entrega",
    tone: "delivering",
    statuses: ["out_for_delivery"],
  },
  {
    key: "done",
    label: "Finalizado",
    tone: "done",
    statuses: ["done"],
  },
  {
    key: "cancelled",
    label: "Cancelado",
    tone: "cancelled",
    statuses: ["cancelled"],
  },
  {
    key: "all",
    label: "Todos",
    tone: "all",
    statuses: null,
  },
];

export const normalizeStatus = (status) => {
  if (!status) return "open";
  const s = status.toString().toLowerCase();
  if (["finalizado", "done", "entregue", "concluido", "concluída"].includes(s)) {
    return "done";
  }
  if (["cancelado", "cancelled"].includes(s)) {
    return "cancelled";
  }
  if (
    [
      "preparing",
      "preparo",
      "em_preparo",
      "preparando",
      "ready",
      "pronto",
      "pronta",
    ].includes(s)
  ) {
    return "preparing";
  }
  if (
    [
      "out_for_delivery",
      "em_entrega",
      "delivery",
      "delivering",
      "assigned",
      "em rota",
    ].includes(s)
  ) {
    return "out_for_delivery";
  }
  if (["open", "em_aberto", "pendente"].includes(s)) return "open";
  return s;
};

export const formatCurrencyBR = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

// Cálculo padrão dos totais utilizando o shape unificado Order V1
export const getOrderTotal = (order) => {
  if (!order) return 0;

  const subtotal = Number(order?.totals?.subtotal ?? order?.subtotal ?? 0);
  const deliveryFee = Number(
    order?.delivery?.fee ??
      order?.totals?.deliveryFee ??
      order?.deliveryFee ??
      0
  );
  const discountAmount = Number(
    order?.totals?.discount ??
      (typeof order?.discount === "object"
        ? order?.discount?.amount
        : order?.discount) ??
      0
  );

  const total =
    Number(order?.totals?.finalTotal ?? order?.total) ||
    subtotal + deliveryFee - discountAmount;

  return total;
};
