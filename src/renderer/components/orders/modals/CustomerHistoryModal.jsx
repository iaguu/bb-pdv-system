import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Modal from "../../common/Modal";
import { OrderIcon } from "../OrderIcons";
import { formatCurrencyBR } from "../../../utils/orderUtils";

export default function CustomerHistoryModal({
  isOpen,
  onClose,
  customer,
  orders = [],
}) {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  // Filtrar pedidos do cliente selecionado
  const customerOrders = useMemo(() => {
    if (!customer || !Array.isArray(orders)) return [];
    
    return orders.filter(order => {
      // Verificar se o pedido pertence ao cliente
      const customerId = order.customerId || order.customer?.id;
      const customerPhone = order.customerPhone || order.customer?.phone;
      const customerName = order.customerName || order.customer?.name;
      
      const matchById = customerId === customer.id;
      const matchByPhone = customerPhone === customer.phone;
      const matchByName = customerName === customer.name;
      
      return matchById || matchByPhone || matchByName;
    });
  }, [customer, orders]);

  // Aplicar filtros adicionais
  const filteredOrders = useMemo(() => {
    let filtered = customerOrders;

    // Filtro por texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.id?.toLowerCase().includes(term) ||
        order.status?.toLowerCase().includes(term) ||
        order.source?.toLowerCase().includes(term) ||
        (order.total?.toString() || "").includes(term)
      );
    }

    // Filtro por status
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Ordenar por data (mais recente primeiro)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });
  }, [customerOrders, searchTerm, statusFilter]);

  // Estatisticas do cliente
  const customerStats = useMemo(() => {
    const totalOrders = customerOrders.length;
    const totalSpent = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    
    const statusCounts = customerOrders.reduce((acc, order) => {
      acc[order.status || 'unknown'] = (acc[order.status || 'unknown'] || 0) + 1;
      return acc;
    }, {});

    const lastOrder = customerOrders[0]; // Ja esta ordenado por data

    return {
      totalOrders,
      totalSpent,
      avgOrderValue,
      statusCounts,
      lastOrder,
      firstOrder: customerOrders[customerOrders.length - 1],
    };
  }, [customerOrders]);

  const formatDate = (dateString) => {
    if (!dateString) return "--";
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      "open": "Aberto",
      "preparing": "Preparando",
      "ready": "Pronto",
      "out_for_delivery": "Em Entrega",
      "delivered": "Entregue",
      "cancelled": "Cancelado",
    };
    return statusMap[status] || status || "Desconhecido";
  };

  const getSourceLabel = (source) => {
    const sourceMap = {
      "desktop": "Balcao",
      "website": "Site",
      "whatsapp": "WhatsApp",
      "ifood": "iFood",
    };
    return sourceMap[source] || source || "Outro";
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="orderform-modal" size="xl">
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">Historico do Cliente</div>
          <div className="modal-title">
            {customer?.name || "Cliente"} - {customerOrders.length} pedidos
          </div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <OrderIcon name="close" />
        </button>
      </div>

      <motion.div className="modal-body" {...bodyMotion}>
        {/* Estatisticas do Cliente */}
        <div className="modal-section">
          <div className="modal-section-title">Resumo do Cliente</div>
          <div className="customer-stats-grid">
            <div className="stat-card">
              <div className="stat-value">{customerStats.totalOrders}</div>
              <div className="stat-label">Total de Pedidos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatCurrencyBR(customerStats.totalSpent)}</div>
              <div className="stat-label">Total Gasto</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatCurrencyBR(customerStats.avgOrderValue)}</div>
              <div className="stat-label">Ticket Medio</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {customerStats.lastOrder ? formatDate(customerStats.lastOrder.createdAt) : "--"}
              </div>
              <div className="stat-label">ltimo Pedido</div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="modal-section">
          <div className="modal-section-title">Filtros</div>
          <div className="filter-controls">
            <div className="filter-group">
              <label className="field-label">Buscar</label>
              <input
                type="text"
                className="field-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID do pedido, status, valor..."
              />
            </div>
            <div className="filter-group">
              <label className="field-label">Status</label>
              <select
                className="field-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="open">Aberto</option>
                <option value="preparing">Preparando</option>
                <option value="ready">Pronto</option>
                <option value="out_for_delivery">Em Entrega</option>
                <option value="delivered">Entregue</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Pedidos */}
        <div className="modal-section">
          <div className="modal-section-title">
            Pedidos ({filteredOrders.length})
          </div>
          
          {filteredOrders.length === 0 ? (
            <div className="empty-state">
              <OrderIcon name="inbox" />
              <p>Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="customer-orders-list">
              {filteredOrders.map((order) => (
                <div key={order.id} className="order-history-item">
                  <div className="order-header">
                    <div className="order-id">
                      <strong>#{order.id}</strong>
                      <span className={`order-status status-${order.status}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      <span className="order-source">
                        {getSourceLabel(order.source)}
                      </span>
                    </div>
                    <div className="order-total">
                      {formatCurrencyBR(order.total || 0)}
                    </div>
                  </div>
                  
                  <div className="order-details">
                    <div className="order-date">
                      {formatDate(order.createdAt)}
                    </div>
                    
                    {order.items && Array.isArray(order.items) && (
                      <div className="order-items-summary">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <span key={idx} className="item-tag">
                            {item.quantity}x {item.name}
                          </span>
                        ))}
                        {order.items.length > 3 && (
                          <span className="item-tag more">
                            +{order.items.length - 3} itens
                          </span>
                        )}
                      </div>
                    )}
                    
                    {order.notes && (
                      <div className="order-notes">
                        <strong>Obs:</strong> {order.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}

