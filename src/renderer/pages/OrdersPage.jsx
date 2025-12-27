// src/renderer/pages/OrdersPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Page from "../components/layout/Page";

import OrderList from "../components/orders/OrderList";
import OrderFilters from "../components/orders/OrderFilters";
import OrderDetailsModal from "../components/orders/OrderDetailsModal";
import OrderFormModal from "../components/orders/OrderFormModal";
import { getOrderTotal, normalizeStatus } from "../utils/orderUtils";
import { emitToast } from "../utils/toast";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({ status: "open", source: "all" });
  const [activeModal, setActiveModal] = useState(null); // 'details' | 'create' | null
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [formInitialOrder, setFormInitialOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef(null);
  const lateOrdersRef = useRef(new Set());

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

  const normalizeOrderRecord = useCallback(
    (order) => {
      if (!order) return order;
      const normalizedStatus = normalizeStatus(
        order.status ||
          order.orderStatus ||
          order.payment?.status ||
          order.pedidoStatus
      );
      return {
        ...order,
        status: normalizedStatus || "open",
      };
    },
    []
  );

  const isOrderLate = (order) => {
    const ns = normalizeStatus(order?.status);
    if (!["open", "preparing", "out_for_delivery"].includes(ns)) return false;
    if (!order?.createdAt) return false;
    const created = new Date(order.createdAt);
    if (Number.isNaN(created.getTime())) return false;

    const minMinutes =
      typeof order.deliveryMinMinutes === "number"
        ? order.deliveryMinMinutes
        : 0;
    const threshold = minMinutes > 0 ? minMinutes : 40;

    const diffMinutes = Math.round(
      (Date.now() - created.getTime()) / 60000
    );
    return diffMinutes >= threshold;
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
      const size = it.size || it.sizeLabel || "";
      const kind =
        it.kind ||
        (size || it.productName || it.productId ? "pizza" : "drink");
      const extras = (Array.isArray(it.extras) ? it.extras : []).map(
        (extra) => ({
          ...extra,
          unitPrice:
            Number(extra.unitPrice ?? extra.price ?? extra.value ?? 0) || 0,
        })
      );

      return {
        lineId: it.lineId || `${Date.now()}-${idx}`,
        id: it.productId || it.id || null,
        productId: it.productId || it.id || null,
        productName: it.productName || flavor1Name,
        name: flavor1Name,
        kind,
        size,
        sizeLabel: it.sizeLabel || size || "",
        quantity,
        unitPrice,
        lineTotal,
        total: lineTotal,
        isHalfHalf:
          it.isHalfHalf || Boolean(flavor2Name) || Boolean(flavor3Name),
        halfDescription: it.halfDescription || flavor2Name || "",
        flavor1Name,
        flavor2Name,
        flavor3Name,
        twoFlavors: it.twoFlavors ?? Boolean(flavor2Name),
        threeFlavors: it.threeFlavors ?? Boolean(flavor3Name),
        extras,
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

      const normalizedOrders = visibleItems.map((o) =>
        normalizeOrderRecord(o)
      );

      setOrders(normalizedOrders);
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

  useEffect(() => {
    if (!orders.length) {
      lateOrdersRef.current.clear();
      return;
    }

    const currentLate = new Set();
    const newlyLate = [];

    orders.forEach((order) => {
      const orderId = order?.id || order?._id;
      if (!orderId) return;
      if (isOrderLate(order)) {
        currentLate.add(orderId);
        if (!lateOrdersRef.current.has(orderId)) {
          newlyLate.push(order);
        }
      }
    });

    if (newlyLate.length > 0) {
      emitToast({
        type: "warning",
        title: "Pedidos atrasados",
        message:
          newlyLate.length === 1
            ? "Um pedido entrou na lista de atrasados."
            : `${newlyLate.length} pedidos entraram na lista de atrasados.`,
        duration: 6000,
      });
    }

    lateOrdersRef.current = currentLate;
  }, [orders]);

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
      emitToast({
        type: "error",
        message:
          "Erro ao salvar pedido. Verifique o console para mais detalhes.",
      });
    }
  };

  const handleOrderUpdated = async (draft, options = {}) => {
    if (!formInitialOrder) return;
    const orderId = resolveOrderId(formInitialOrder);
    if (!orderId) {
      console.warn("[OrdersPage] Pedido sem ID para editar.");
      return;
    }

    try {
      const mergedDraft = {
        ...formInitialOrder,
        ...draft,
        id: orderId,
        _id: formInitialOrder._id,
        createdAt: formInitialOrder.createdAt,
      };
      const payload = mapDraftToOrder(mergedDraft);
      const updatedOrder = {
        ...formInitialOrder,
        ...payload,
        id: orderId,
        _id: formInitialOrder._id,
        history: Array.isArray(formInitialOrder.history)
          ? formInitialOrder.history
          : [],
      };

      if (!window.dataEngine) {
        console.warn(
          "[OrdersPage] dataEngine não disponível; pedido atualizado apenas em memória."
        );
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId || o._id === orderId ? updatedOrder : o
          )
        );
      } else if (typeof window.dataEngine.updateItem === "function") {
        await window.dataEngine.updateItem("orders", orderId, updatedOrder);
      } else if (typeof window.dataEngine.set === "function") {
        const current = await window.dataEngine.get("orders");
        const items = Array.isArray(current?.items) ? current.items : [];
        const updatedItems = items.map((o) =>
          o.id === orderId || o._id === orderId ? updatedOrder : o
        );
        await window.dataEngine.set("orders", { items: updatedItems });
      } else {
        console.warn(
          "[OrdersPage] Nenhum método conhecido para persistir atualização de pedido."
        );
      }

      await loadOrders();
      setActiveModal(null);
      setFormInitialOrder(null);
      setSelectedOrder(null);
      if (options?.action === "save_and_print") {
        await handlePrintOrder(updatedOrder, "full");
      }
    } catch (err) {
      console.error("[OrdersPage] Erro ao atualizar pedido:", err);
      emitToast({
        type: "error",
        message:
          "Erro ao atualizar o pedido. Verifique o console para mais detalhes.",
      });
    }
  };

  const handleOrderFormConfirm = (draft, options) => {
    if (formInitialOrder) {
      void handleOrderUpdated(draft, options);
      return;
    }
    void handleOrderCreated(draft);
  };

  // ========= DETALHES / STATUS / IMPRESSÃO =========

  const handleOpenDetails = (order) => {
    setSelectedOrder(normalizeOrderRecord(order));
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
      emitToast({
        type: "error",
        message: "Erro ao atualizar status. Veja o console para detalhes.",
      });
    }
  };

  // 🔄 NOVA LÓGICA DE IMPRESSÃO (alinhada com main.js + OrderDetailsModal)
  const handlePrintOrder = useCallback(async (order, mode = "full") => {
    try {
      if (!order) return;

      const safeMode = mode || "full";
      let printResult = null;

      if (window.electronAPI?.printOrder) {
        printResult = await window.electronAPI.printOrder(order, {
          mode: safeMode,
          silent: true,
        });
      } else if (window.printEngine?.printOrder) {
        const engineResult = await window.printEngine.printOrder(order, {
          mode: safeMode,
          silent: true,
        });
        printResult =
          engineResult && typeof engineResult === "object"
            ? engineResult
            : { success: Boolean(engineResult) };
      } else {
        console.warn(
          "[OrdersPage] Nenhuma API de impressão (electronAPI.printOrder / printEngine.printOrder). Usando window.print()."
        );
        window.print();
        printResult = { success: true };
      }

      if (printResult && printResult.success === false) {
        emitToast({
          type: "error",
          title: "Falha na impressão",
          message:
            printResult.error ||
            printResult.message ||
            "Não foi possível imprimir o pedido.",
          duration: 6000,
        });
      }
    } catch (err) {
      console.error("[OrdersPage] Erro ao imprimir pedido:", err);
      emitToast({
        type: "error",
        title: "Falha na impressão",
        message:
          err?.message || "Erro desconhecido ao tentar imprimir o pedido.",
        duration: 6000,
      });
    }
  }, []);

  useEffect(() => {
    const listener =
      typeof window.orderEvents?.onNewOrder === "function"
        ? window.orderEvents.onNewOrder((order) => {
            if (!order) return;

            const normalizedId = order.id || order._id;
            let shouldNotify = false;

            setOrders((prev) => {
              const exists =
                normalizedId &&
                prev.some(
                  (o) => (o.id || o._id) === normalizedId
                );
              if (exists) {
                return prev;
              }
              shouldNotify = true;
              const normalized = normalizeOrderRecord(order);
              return [{ ...normalized, isNewFromSite: true }, ...prev];
            });

            if (!shouldNotify) {
              return;
            }

            const label = order.shortId || normalizedId || "pedido";
            emitToast({
              type: "info",
              title: "Pedido recebido",
              message: `${label} chegou no sistema.`,
              duration: 6000,
            });

            void handlePrintOrder(order, "full");
          })
        : null;

    return typeof listener === "function" ? listener : undefined;
  }, [handlePrintOrder]);

  useEffect(() => {
    if (typeof window.orderEvents?.onOrderUpdated !== "function") {
      return undefined;
    }

    const listener = window.orderEvents.onOrderUpdated((order) => {
      if (!order) return;
      const normalized = normalizeOrderRecord(order);

      setOrders((prev) => {
        const normalizedId = normalized.id || normalized._id;
        let updated = false;
        const next = prev.map((item) => {
          const candidateId = item.id || item._id;
          if (normalizedId && candidateId === normalizedId) {
            updated = true;
            return normalized;
          }
          return item;
        });
        if (!updated) {
          next.unshift(normalized);
        }
        return next;
      });

      setSelectedOrder((prev) => {
        if (!prev) return prev;
        const prevId = prev.id || prev._id;
        const normalizedId = normalized.id || normalized._id;
        if (prevId && normalizedId && prevId === normalizedId) {
          return normalized;
        }
        return prev;
      });
    });

    return typeof listener === "function" ? listener : undefined;
  }, [normalizeOrderRecord]);

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
      emitToast({
        type: "error",
        message: "Erro ao excluir pedido. Veja o console para detalhes.",
      });
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
    const handler = (event) => {
      const action = event.detail?.action;
      if (!action) return;
      if (action === "new-order") {
        handleNewOrderClick();
        return;
      }
      if (action === "refresh-orders") {
        loadOrders();
        return;
      }
      if (action === "focus-order-search") {
        searchInputRef.current?.focus();
        return;
      }
      if (action === "close-modal" && activeModal) {
        handleCloseModal();
      }
    };

    window.addEventListener("app:shortcut", handler);
    return () => window.removeEventListener("app:shortcut", handler);
  }, [activeModal, loadOrders, handleCloseModal, handleNewOrderClick]);

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
          <OrderFilters
            value={filters}
            onChange={setFilters}
            searchInputRef={searchInputRef}
          />
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
          onConfirm={handleOrderFormConfirm}
          formatCurrency={formatCurrency}
          initialOrder={formInitialOrder}
        />
      )}
    </Page>
  );
};

export default OrdersPage;
