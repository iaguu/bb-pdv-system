// Utilitários para mapear e normalizar dados de pedidos
// Garante que os dados estejam consistentes antes de salvar ou exibir

export const resolveOrderId = (order) => {
  if (!order) return null;
  return order.id || order._id || null;
};

export const normalizeOrderRecord = (order) => {
  if (!order) return order;
  
  // Garante campos mínimos para evitar erros de renderização
  return {
    ...order,
    id: order.id || order._id,
    status: order.status || "open",
    items: Array.isArray(order.items) ? order.items : [],
    history: Array.isArray(order.history) ? order.history : [],
    customer: order.customer || order.customerSnapshot || {},
    totals: order.totals || {
      subtotal: Number(order.subtotal || 0),
      deliveryFee: Number(order.deliveryFee || 0),
      discount: Number(order.discount || 0),
      total: Number(order.total || 0)
    }
  };
};

export const mapDraftToOrder = (draft) => {
  if (!draft) return null;

  const now = new Date().toISOString();
  
  // Garante números
  const subtotal = Number(draft.subtotal || 0);
  const deliveryFee = Number(draft.deliveryFee || 0);
  const discount = Number(draft.discount || 0);
  const total = Number(draft.total || (subtotal + deliveryFee - discount));

  // Estrutura final do pedido para o banco de dados
  return {
    ...draft,
    // Se não tiver ID, o DataEngine cria um novo
    id: draft.id || draft._id, 
    status: draft.status || "open",
    createdAt: draft.createdAt || now,
    updatedAt: now,
    source: draft.source || "desktop",
    
    // Garante arrays
    items: Array.isArray(draft.items) ? draft.items : [],
    history: Array.isArray(draft.history) ? draft.history : [],
    
    // Valores normalizados
    subtotal,
    deliveryFee,
    discount,
    total,
    
    // Objeto de totais explícito (padrão novo)
    totals: {
      subtotal,
      deliveryFee,
      discount,
      finalTotal: total
    }
  };
};