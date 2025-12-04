// src/renderer/pages/OrdersPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import Page from "../components/layout/Page";

import OrderList from "../components/orders/OrderList";
import OrderFilters from "../components/orders/OrderFilters";
import OrderDetailsModal from "../components/orders/OrderDetailsModal";
import OrderFormModal from "../components/orders/OrderFormModal";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({ status: "open", source: "all" });
  const [activeModal, setActiveModal] = useState(null); // 'details' | 'create' | null
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [formInitialOrder, setFormInitialOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const formatCurrency = (value) =>
    (Number(value) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  // ========= HELPERS BÁSICOS =========

  const resolveOrderId = (order) => {
    if (!order) return null;
    return order.id || order._id || null;
  };

  const normalizeStatus = (status) => {
    if (!status) return "open";
    const s = status.toString().toLowerCase();
    if (s === "finalizado" || s === "done") return "done";
    if (s === "cancelado" || s === "cancelled") return "cancelled";
    if (s === "preparing" || s === "preparo" || s === "em_preparo") {
      return "preparing";
    }
    if (s === "out_for_delivery" || s === "delivery" || s === "em_entrega") {
      return "out_for_delivery";
    }
    if (s === "open" || s === "em_aberto") return "open";
    return s;
  };

  const isToday = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const getOrderTotal = (order) => {
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

  // ========= KPIs (HOJE + ATRASADOS) =========

  const kpis = useMemo(() => {
    const now = new Date();

    const todayOrders = orders.filter((o) => isToday(o.createdAt));
    const doneToday = todayOrders.filter(
      (o) => normalizeStatus(o.status) === "done"
    );

    const totalRevenueToday = doneToday.reduce(
      (sum, o) => sum + getOrderTotal(o),
      0
    );
    const totalOrdersToday = todayOrders.length;
    const avgTicket =
      totalOrdersToday > 0 ? totalRevenueToday / totalOrdersToday : 0;

    const bySource = todayOrders.reduce(
      (acc, o) => {
        const src = (o.source || "other").toString().toLowerCase();
        if (src === "website" || src === "web") acc.website += 1;
        else if (src === "whatsapp") acc.whatsapp += 1;
        else if (src === "ifood") acc.ifood += 1;
        else if (src === "desktop" || src === "local" || src === "balcão") {
          acc.local += 1;
        } else acc.other += 1;
        return acc;
      },
      { website: 0, whatsapp: 0, ifood: 0, local: 0, other: 0 }
    );

    // mesmo critério do OrderRow:
    // aberto / preparando / entrega E >= 40 min desde createdAt
    const isOpenLike = (st) => {
      const s = normalizeStatus(st);
      return (
        s === "open" ||
        s === "preparing" ||
        s === "out_for_delivery"
      );
    };

    const lateCountToday = todayOrders.filter((o) => {
      if (!isOpenLike(o.status)) return false;
      if (!o.createdAt) return false;

      const created = new Date(o.createdAt);
      if (Number.isNaN(created.getTime())) return false;

      const diffMinutes = Math.round(
        (now.getTime() - created.getTime()) / 60000
      );

      return diffMinutes >= 40;
    }).length;

    return {
      totalRevenueToday,
      totalOrdersToday,
      avgTicket,
      bySource,
      lateCountToday,
    };
  }, [orders]);

  // ========= CARREGAR PEDIDOS =========

  const loadOrders = useCallback(async () => {
    try {
      if (!window.dataEngine) {
        console.warn("[OrdersPage] dataEngine não disponível.");
        return;
      }

      setIsLoading(true);
      const data = await window.dataEngine.get("orders");

      const items = Array.isArray(data?.items) ? data.items : [];

      // Soft delete: filtra pedidos marcados como deleted
      const visibleItems = items.filter((o) => !o.deleted);

      setOrders(visibleItems);
    } catch (err) {
      console.error("[OrdersPage] Erro ao carregar pedidos:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carrega ao abrir a página
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Auto-refresh: recarrega a cada 5s
  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadOrders]);

  // ========= CRIAÇÃO DE PEDIDO =========

  const handleOrderCreated = async (orderDraft) => {
    try {
      if (!window.dataEngine) {
        throw new Error("API local (window.dataEngine) não disponível.");
      }

      const payload = {
        ...orderDraft,
        status: orderDraft.status || "open",
        source: orderDraft.source || "desktop",
        createdAt: orderDraft.createdAt || new Date().toISOString(),
        deleted: false,
      };

      await window.dataEngine.addItem("orders", payload);
      await loadOrders();
      setActiveModal(null);
      setFormInitialOrder(null);
    } catch (err) {
      console.error("[OrdersPage] Erro ao salvar pedido:", err);
      alert("Erro ao salvar pedido. Verifique o console para mais detalhes.");
    }
  };

  // ========= DETALHES / STATUS / IMPRESSÃO =========

  const handleOpenDetails = (order) => {
    setSelectedOrder(order);
    setActiveModal("details");
  };

  const handleChangeOrderStatus = async (orderId, newStatus) => {
    try {
      if (!orderId) return;

      // Atualiza otimistamente no estado
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId || o._id === orderId
            ? {
                ...o,
                status: newStatus,
                history: [
                  ...(Array.isArray(o.history) ? o.history : []),
                  {
                    status: newStatus,
                    at: new Date().toISOString(),
                  },
                ],
              }
            : o
        )
      );
      setSelectedOrder((prev) =>
        prev && (prev.id === orderId || prev._id === orderId)
          ? {
              ...prev,
              status: newStatus,
              history: [
                ...(Array.isArray(prev.history) ? prev.history : []),
                {
                  status: newStatus,
                  at: new Date().toISOString(),
                },
              ],
            }
          : prev
      );

      if (!window.dataEngine) {
        console.warn(
          "[OrdersPage] dataEngine não disponível; status só atualizado em memória."
        );
        return;
      }

      const updatePayload = {
        status: newStatus,
        history: [
          ...(Array.isArray(selectedOrder?.history)
            ? selectedOrder.history
            : []),
          { status: newStatus, at: new Date().toISOString() },
        ],
      };

      if (typeof window.dataEngine.updateItem === "function") {
        await window.dataEngine.updateItem("orders", orderId, updatePayload);
      } else if (typeof window.dataEngine.set === "function") {
        const current = await window.dataEngine.get("orders");
        const items = Array.isArray(current?.items) ? current.items : [];
        const updatedItems = items.map((o) =>
          o.id === orderId || o._id === orderId
            ? { ...o, ...updatePayload }
            : o
        );
        await window.dataEngine.set("orders", { items: updatedItems });
      } else {
        console.warn(
          "[OrdersPage] Nenhum método conhecido para persistir alteração de status."
        );
      }

      await loadOrders();
    } catch (err) {
      console.error(
        "[OrdersPage] Erro ao atualizar status do pedido:",
        err
      );
      alert("Erro ao atualizar status. Veja o console para detalhes.");
    }
  };

  const handlePrintOrder = (order, mode = "full") => {
    try {
      if (window.printEngine?.printOrder) {
        // mode: "full" | "kitchen" | "counter"
        window.printEngine.printOrder(order, { mode });
      } else {
        console.warn(
          "[OrdersPage] printEngine.printOrder não encontrado; usando window.print()."
        );
        window.print();
      }
    } catch (err) {
      console.error("[OrdersPage] Erro ao imprimir pedido:", err);
    }
  };

  // ========= DUPLICAR PEDIDO =========

  const handleDuplicateOrder = (orderToDuplicate) => {
    if (!orderToDuplicate) return;

    const {
      id,
      _id,
      createdAt,
      status,
      history,
      deleted,
      deletedAt,
      deletedBy,
      ...rest
    } = orderToDuplicate;

    const draft = {
      ...rest,
      status: "open",
      createdAt: new Date().toISOString(),
      history: [],
      source: orderToDuplicate.source || "desktop",
    };

    setFormInitialOrder(draft);
    setActiveModal("create");
  };

  // ========= EXCLUIR (SOFT DELETE) =========

  const handleDeleteOrder = async (orderToDelete) => {
    try {
      if (!orderToDelete) return;

      const orderId = resolveOrderId(orderToDelete);
      const deletedAt = new Date().toISOString();
      const deletedBy = "sistema"; // no futuro: usuário logado

      // Otimista: remove da lista em memória
      setOrders((prev) =>
        prev.filter((o) => {
          if (orderId) {
            return o.id !== orderId && o._id !== orderId;
          }
          return o !== orderToDelete;
        })
      );

      setSelectedOrder(null);
      setActiveModal(null);

      if (!window.dataEngine) {
        console.warn(
          "[OrdersPage] dataEngine não disponível; exclusão só em memória."
        );
        return;
      }

      const updatePayload = {
        deleted: true,
        deletedAt,
        deletedBy,
      };

      if (orderId && typeof window.dataEngine.updateItem === "function") {
        await window.dataEngine.updateItem("orders", orderId, updatePayload);
      } else if (typeof window.dataEngine.set === "function") {
        const current = await window.dataEngine.get("orders");
        const items = Array.isArray(current?.items) ? current.items : [];
        const updated = items.map((o) => {
          if (orderId) {
            if (o.id === orderId || o._id === orderId) {
              return { ...o, ...updatePayload };
            }
            return o;
          }
          if (JSON.stringify(o) === JSON.stringify(orderToDelete)) {
            return { ...o, ...updatePayload };
          }
          return o;
        });
        await window.dataEngine.set("orders", { items: updated });
      } else {
        console.warn(
          "[OrdersPage] Nenhum método conhecido para persistir exclusão."
        );
      }

      await loadOrders();
    } catch (err) {
      console.error("[OrdersPage] Erro ao excluir pedido:", err);
      alert("Erro ao excluir pedido. Veja o console para detalhes.");
    }
  };

  // ========= MODAIS / AÇÕES =========

  const handleNewOrderClick = () => {
    setSelectedOrder(null);
    setFormInitialOrder(null);
    setActiveModal("create");
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedOrder(null);
    setFormInitialOrder(null);
  };

  const selectedOrderId = resolveOrderId(selectedOrder);

  // ========= ATALHOS DE TECLADO =========
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        handleNewOrderClick();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        loadOrders();
      } else if (e.key === "Escape") {
        if (activeModal) {
          e.preventDefault();
          handleCloseModal();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeModal, loadOrders]);

  return (
    <Page
      title="Pedidos"
      subtitle="Acompanhe pedidos abertos, finalizados, vindos do site, WhatsApp e balcão."
      actions={
        <button className="btn btn-primary" onClick={handleNewOrderClick}>
          + Novo pedido
        </button>
      }
    >
      {/* KPIs DO DIA */}
      <div className="orders-kpi-bar">
        <div className="orders-kpi-card">
          <span className="orders-kpi-label">Faturamento hoje</span>
          <strong className="orders-kpi-value">
            {formatCurrency(kpis.totalRevenueToday)}
          </strong>
        </div>

        <div className="orders-kpi-card">
          <span className="orders-kpi-label">Pedidos hoje</span>
          <strong className="orders-kpi-value">
            {kpis.totalOrdersToday}
          </strong>
        </div>

        <div className="orders-kpi-card">
          <span className="orders-kpi-label">Ticket médio</span>
          <strong className="orders-kpi-value">
            {formatCurrency(kpis.avgTicket)}
          </strong>
        </div>

        {/* NOVO: contador de atrasados */}
        <div className="orders-kpi-card orders-kpi-card--alert">
          <span className="orders-kpi-label">Pedidos atrasados</span>
          <strong className="orders-kpi-value orders-kpi-value--alert">
            {kpis.lateCountToday}
          </strong>
        </div>

        <div className="orders-kpi-card orders-kpi-card--sources">
          <span className="orders-kpi-label">Canais (hoje)</span>
          <div className="orders-kpi-sources">
            <span>Site: {kpis.bySource.website}</span>
            <span>WhatsApp: {kpis.bySource.whatsapp}</span>
            <span>iFood: {kpis.bySource.ifood}</span>
            <span>Balcão/Sistema: {kpis.bySource.local}</span>
          </div>
        </div>
      </div>

      {/* Toolbar: filtros + botão atualizar */}
      <div className="page-toolbar">
        <OrderFilters value={filters} onChange={setFilters} />
        <button
          className="btn btn-outline"
          onClick={loadOrders}
          disabled={isLoading}
        >
          {isLoading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <OrderList
        orders={orders}
        filters={filters}
        onClickOrder={handleOpenDetails}
      />

      {/* Modal de detalhes */}
      {activeModal === "details" && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={handleCloseModal}
          onChangeStatus={(status) =>
            handleChangeOrderStatus(selectedOrderId, status)
          }
          onPrint={handlePrintOrder}
          onDelete={handleDeleteOrder}
          onDuplicate={handleDuplicateOrder}
        />
      )}

      {/* Modal de criação de pedido */}
      {activeModal === "create" && (
        <OrderFormModal
          isOpen={true}
          onClose={handleCloseModal}
          onConfirm={handleOrderCreated}
          formatCurrency={formatCurrency}
          initialOrder={formInitialOrder}
        />
      )}
    </Page>
  );
};

export default OrdersPage;
