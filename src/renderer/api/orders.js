import { normalizeOrderRecord } from "../utils/orderMapper";

const COLLECTION = "orders";

// Acesso seguro à API existente (window.dataEngine)
const getEngine = () => {
  if (typeof window !== 'undefined' && window.dataEngine) {
    return window.dataEngine;
  }
  console.warn("[OrdersAPI] DataEngine (API existente) não encontrada.");
  return null;
};

export const fetchOrders = async () => {
  const engine = getEngine();
  if (!engine) return [];

  try {
    // Usa a API existente para buscar dados
    const data = await engine.get(COLLECTION);
    
    // Suporta tanto formato { items: [] } quanto array direto
    const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
    
    // Filtra deletados e normaliza
    return items
      .filter(o => !o.deleted)
      .map(normalizeOrderRecord);
  } catch (error) {
    console.error("[OrdersAPI] Erro ao buscar pedidos:", error);
    return [];
  }
};

export const saveOrder = async (orderData) => {
  const engine = getEngine();
  if (!engine) throw new Error("Sistema de dados indisponível");

  // Usa addItem da API existente
  return await engine.addItem(COLLECTION, orderData);
};

export const updateOrderRecord = async (orderId, orderData) => {
  const engine = getEngine();
  if (!engine) throw new Error("Sistema de dados indisponível");

  if (typeof engine.updateItem === 'function') {
    return await engine.updateItem(COLLECTION, orderId, orderData);
  }

  // Fallback se updateItem não existir na versão atual da API
  const current = await engine.get(COLLECTION);
  const items = current.items || [];
  const newItems = items.map(i => (i.id === orderId || i._id === orderId) ? { ...i, ...orderData } : i);
  return await engine.set(COLLECTION, { items: newItems });
};

export const deleteOrderRecord = async (orderId) => {
  const engine = getEngine();
  if (!engine) return;

  if (typeof engine.removeItem === 'function') {
    return await engine.removeItem(COLLECTION, orderId);
  }

  // Fallback
  const current = await engine.get(COLLECTION);
  const items = current.items || [];
  const newItems = items.filter(i => i.id !== orderId && i._id !== orderId);
  return await engine.set(COLLECTION, { items: newItems });
};

export const updateOrderStatus = async (orderId, newStatus, history = []) => {
  const updatePayload = {
    status: newStatus,
    history: [
      ...history,
      { status: newStatus, at: new Date().toISOString() }
    ]
  };
  
  // Reutiliza a função de update
  return updateOrderRecord(orderId, updatePayload);
};