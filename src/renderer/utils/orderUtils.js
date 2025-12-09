// src/renderer/utils/orderUtils.js
// Utilitários compartilhados para normalização de pedidos (Order V1)

export const normalizeStatus = (status) => {
  if (!status) return "open";
  const s = status.toString().toLowerCase();
  if (s === "finalizado" || s === "done") return "done";
  if (s === "cancelado" || s === "cancelled") return "cancelled";
  if (s === "preparing" || s === "preparo" || s === "em_preparo") {
    return "preparing";
  }
  if (
    s === "out_for_delivery" ||
    s === "em_entrega" ||
    s === "delivery" ||
    s === "delivering"
  ) {
    return "out_for_delivery";
  }
  if (s === "open" || s === "em_aberto") return "open";
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
