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
import { getOrderTotal } from "../utils/orderUtils";

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

  // ========= MAPEAMENTO PADRÃO DO DRAFT -> ORDEM V1 =========
  // Agora já preparado para receber dados de motoboy via QR:
  // - motoboyId / motoboyName / motoboySnapshot / motoboyStatus
  // podem vir tanto em nível raiz quanto dentro de delivery.*.

  const mapDraftToOrder = (draft) => {
    if (!draft) return null;

    // Se já está no formato novo (tem totals ou customerSnapshot), apenas
    // garante alguns defaults básicos.
    const hasTotals = draft.totals && typeof draft.totals === "object";
    const hasCustomerSnapshot =
      draft.customerSnapshot && typeof draft.customerSnapshot === "object";

    const rawSubtotal =
      draft.subtotal ??
      (hasTotals ? draft.totals.subtotal : 0) ??
      0;

    const rawDeliveryFee =
      draft.deliveryFee ??
      draft.delivery?.fee ??
      (hasTotals ? draft.totals.deliveryFee : 0) ??
      0;

    const rawDiscount =
      typeof draft.discount === "object"
        ? draft.discount.amount
        : draft.discount;

    const subtotal = Number(rawSubtotal || 0);
    const deliveryFee = Number(rawDeliveryFee || 0);
    const discount = Number(rawDiscount || 0);

    const finalTotal =
      Number(draft.total ?? (hasTotals ? draft.totals.finalTotal : 0)) ||
      subtotal + deliveryFee - discount;

    const typeRaw = (draft.type || draft.orderType || "delivery")
      .toString()
      .toLowerCase();

    let type = "delivery";
    if (typeRaw === "pickup" || typeRaw === "retirada") {
      type = "pickup";
    } else if (
      typeRaw === "counter" ||
      typeRaw === "balcao" ||
      typeRaw === "balcão"
    ) {
      type = "counter";
    }

    const paymentMethodRaw =
      (draft.payment && draft.payment.method) ||
      draft.paymentMethod ||
      "";
    const paymentMethod =
      typeof paymentMethodRaw === "string"
        ? paymentMethodRaw.toLowerCase()
        : "";

    const payment = {
      ...(draft.payment || {}),
      method: paymentMethod,
      status:
        (draft.payment && draft.payment.status) ||
        draft.paymentStatus ||
        "to_define",
    };

    const deliveryAddress =
      (draft.delivery && draft.delivery.address) ||
      draft.customerAddress ||
      draft.address ||
      null;

    // 🔗 Campos de motoboy – já preparados para fluxo via QR
    const motoboySnapshot =
      draft.motoboySnapshot ||
      draft.delivery?.motoboySnapshot ||
      null;

    const motoboyId =
      draft.motoboyId ||
      draft.delivery?.motoboyId ||
      motoboySnapshot?.id ||
      null;

    const motoboyName =
      draft.motoboyName ||
      draft.delivery?.motoboyName ||
      motoboySnapshot?.name ||
      null;

    const motoboyPhone =
      draft.motoboyPhone ||
      draft.delivery?.motoboyPhone ||
      motoboySnapshot?.phone ||
      null;

    const motoboyBaseNeighborhood =
      draft.motoboyBaseNeighborhood ||
      draft.delivery?.motoboyBaseNeighborhood ||
      motoboySnapshot?.baseNeighborhood ||
      null;

    const motoboyBaseFee =
      typeof draft.motoboyBaseFee === "number"
        ? draft.motoboyBaseFee
        : typeof draft.delivery?.motoboyBaseFee === "number"
        ? draft.delivery.motoboyBaseFee
        : typeof motoboySnapshot?.baseFee === "number"
        ? motoboySnapshot.baseFee
        : null;

    const motoboyStatus =
      draft.motoboyStatus ||
      draft.delivery?.motoboyStatus ||
      (type === "delivery"
        ? motoboyId
          ? "assigned"
          : "waiting_qr"
        : null);

    const delivery = {
      ...(draft.delivery || {}),
      mode: type,
      fee: deliveryFee,
      address: deliveryAddress,
      motoboyId,
      motoboyName,
      motoboyPhone,
      motoboyBaseNeighborhood,
      motoboyBaseFee,
      motoboySnapshot,
      motoboyStatus,
    };

    const customerSnapshot =
      hasCustomerSnapshot
        ? draft.customerSnapshot
        : (draft.customerName ||
            draft.customerPhone ||
            draft.customerCpf)
        ? {
            id: draft.customerId || null,
            name: draft.customerName || "Cliente",
            phone: draft.customerPhone || "",
            cpf: draft.customerCpf || "",
            address: deliveryAddress,
          }
        : null;

    const items = Array.isArray(draft.items) ? draft.items : [];
    const normalizedItems = items.map((it, idx) => {
      const quantity = Number(it.quantity ?? it.qty ?? 1);
      const unitPrice = Number(it.unitPrice ?? it.price ?? 0);
      const lineTotal =
        Number(it.lineTotal ?? it.total) || unitPrice * quantity;

      const flavor1Name = it.name || it.flavor1Name || "Item";
      const flavor2Name = it.halfDescription || it.flavor2Name || "";
      const flavor3Name = it.flavor3Name || it.flavor3Label || "";

      return {
        lineId: it.lineId || `${Date.now()}-${idx}`,
        id: it.productId || it.id || null,
        name: flavor1Name,
        size: it.sizeLabel || it.size || "",
        quantity,
        unitPrice,
        lineTotal,
        isHalfHalf:
          it.isHalfHalf ||
          Boolean(flavor2Name),
        halfDescription: it.halfDescription || flavor2Name || "",
        extras: Array.isArray(it.extras) ? it.extras : [],
        kitchenNotes:
          it.kitchenNotes || it.obs || it.observacao || "",
      };
    });

    const orderNotes = draft.orderNotes || "";
    const kitchenNotes = draft.kitchenNotes || "";

    const summary =
      draft.summary ||
      (normalizedItems.length
        ? normalizedItems
            .slice(0, 2)
            .map(
              (it) =>
                `${it.quantity}x ${
                  it.size ? it.size + " " : ""
                }${it.name}`
            )
            .join(" • ")
        : "");

    const base = {
      ...draft,
      type,
      source: draft.source || "desktop",
      status: draft.status || "open",
      createdAt: draft.createdAt || new Date().toISOString(),
      customerSnapshot,
      delivery,
      payment,
      items: normalizedItems,
      orderNotes,
      kitchenNotes,
      summary,
      motoboyId,
      motoboyName,
      motoboyPhone,
      motoboyBaseNeighborhood,
      motoboyBaseFee,
      motoboySnapshot,
      motoboyStatus,
      totals: {
        ...(draft.totals || {}),
        subtotal,
        deliveryFee,
        discount,
        finalTotal,
      },
    };

    return base;
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

      const base = {
        ...orderDraft,
        deleted: false,
      };

      const payload = mapDraftToOrder(base);

      // Salva no DataEngine e tenta obter o registro salvo (com ID)
      const saved = await window.dataEngine.addItem("orders", payload);
      const orderForPrint = saved && typeof saved === "object" ? saved : payload;

      // Imprime automaticamente o pedido completo ao criar
      await handlePrintOrder(orderForPrint, "full");

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

  // 🔄 NOVA LÓGICA DE IMPRESSÃO (alinhada com main.js + OrderDetailsModal)
  const handlePrintOrder = async (order, mode = "full") => {
    try {
      if (!order) return;

      const safeMode = mode || "full";

      // Preferência: usar API exposta pelo preload (IPC print:order)
      if (window.electronAPI?.printOrder) {
        await window.electronAPI.printOrder(order, {
          mode: safeMode, // "full" | "kitchen" | "counter"
          silent: true,   // impressão silenciosa
        });
      }
      // Fallback para engine antigo (se ainda estiver presente)
      else if (window.printEngine?.printOrder) {
        await window.printEngine.printOrder(order, {
          mode: safeMode,
          silent: true,
        });
      }
      // Último recurso: print padrão do navegador
      else {
        console.warn(
          "[OrdersPage] Nenhuma API de impressão (electronAPI.printOrder / printEngine.printOrder). Usando window.print()."
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

  const handleEditOrder = (orderToEdit) => {
    if (!orderToEdit) return;
    setSelectedOrder(orderToEdit);
    setFormInitialOrder(orderToEdit);
    setActiveModal("create");
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
      subtitle="Acompanhe pedidos abertos, finalizados e de todos os canais."
      actions={
        <button className="btn btn-primary" onClick={handleNewOrderClick}>
          + Novo pedido
        </button>
      }
    >


      {/* Toolbar: filtros + botão atualizar */}
      <div className="page-toolbar orders-toolbar">
        <div className="toolbar-left">
          <OrderFilters value={filters} onChange={setFilters} />
        </div>
        <div className="toolbar-actions">
          <button
            className="btn btn-outline"
            onClick={loadOrders}
            disabled={isLoading}
          >
            {isLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
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
          onEditOrder={handleEditOrder}
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
