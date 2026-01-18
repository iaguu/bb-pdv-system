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
import { OrderIcon } from "../components/orders/OrderIcons";
import { getOrderTotal, normalizeStatus } from "../utils/orderUtils";
import { emitToast } from "../utils/toast";
import { getSettings } from "../api/settings";
import { 
  fetchOrders, 
  saveOrder, 
  updateOrderRecord, 
  deleteOrderRecord, 
  updateOrderStatus 
} from "../api/orders";
import { mapDraftToOrder, normalizeOrderRecord, resolveOrderId } from "../utils/orderMapper";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({ status: "open", source: "all" });
  const [activeModal, setActiveModal] = useState(null); // 'details' | 'create' | null
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [formInitialOrder, setFormInitialOrder] = useState(null);
  const [formInitialSection, setFormInitialSection] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const searchInputRef = useRef(null);
  const lateOrdersRef = useRef(new Set());
  const hasLoadedRef = useRef(false);
  const notificationPermissionAskedRef = useRef(false);

  const formatCurrency = (value) =>
    (Number(value) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  const formatNumber = (value) =>
    (Number(value) || 0).toLocaleString("pt-BR");
  const normalizeSource = (value) =>
    (value || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const isOrderLate = (order) => {
    const ns = normalizeStatus(order.status);
    if (!["open", "preparing", "out_for_delivery"].includes(ns)) return false;
    if (!order.createdAt) return false;
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
    const doneCountToday = doneToday.length;

    const totalRevenueToday = doneToday.reduce(
      (sum, o) => sum + getOrderTotal(o),
      0
    );
    const totalOrdersToday = todayOrders.length;
    const avgTicket =
      totalOrdersToday > 0 ? totalRevenueToday / totalOrdersToday : 0;

    const bySource = todayOrders.reduce(
      (acc, o) => {
        const src = normalizeSource(o.source || "other");
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
      doneCountToday,
    };
  }, [orders]);

  const statusCounts = useMemo(() => {
    const base = {
      open: 0,
      preparing: 0,
      out_for_delivery: 0,
      done: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      const ns = normalizeStatus(order.status);
      if (ns && Object.prototype.hasOwnProperty.call(base, ns)) {
        base[ns] += 1;
      }
    });

    return base;
  }, [orders]);

  // ========= CARREGAR PEDIDOS =========

  const loadOrders = useCallback(async () => {
    try {
      setLoadError("");
      const initialLoad = !hasLoadedRef.current;
      if (initialLoad) setIsLoading(true);
      else setIsRefreshing(true);

      const fetchedOrders = await fetchOrders();
      setOrders(fetchedOrders);
      setLastUpdatedAt(new Date().toISOString());
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("[OrdersPage] Erro ao carregar pedidos:", err);
      setLoadError("Não foi possível carregar os pedidos.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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
      const orderId = order.id || order._id;
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
      const base = {
        ...orderDraft,
        deleted: false,
      };

      const payload = mapDraftToOrder(base);
      const savedOrder = await saveOrder(payload);
      const orderForPrint = savedOrder || payload;

      // Imprime automaticamente
      handlePrintOrder(orderForPrint, "full").catch(console.warn);

      await loadOrders();
      setActiveModal(null);
      setFormInitialOrder(null);
      setFormInitialSection(null);
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

      await updateOrderRecord(orderId, updatedOrder);

      await loadOrders();
      setActiveModal(null);
      setFormInitialOrder(null);
      setSelectedOrder(null);
      setFormInitialSection(null);
      if (options.action === "save_and_print") {
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

  const notifyNewOrder = useCallback((order) => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const showNotification = () => {
      const label = order.shortId || order.id || order._id || "pedido";
      const customer =
        order.customerSnapshot?.name ||
        order.customerName ||
        order.customer?.name ||
        "Cliente";
      const total = getOrderTotal(order);
      try {
        new Notification(`Novo pedido ${label}`, {
          body: `${customer} • Total ${formatCurrency(total)}`,
        });
      } catch (err) {
        console.warn("[OrdersPage] Falha ao emitir notificacao:", err);
      }
    };

    if (Notification.permission === "granted") {
      showNotification();
      return;
    }

    if (Notification.permission === "default" && !notificationPermissionAskedRef.current) {
      notificationPermissionAskedRef.current = true;
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          showNotification();
        }
      });
    }
  }, [formatCurrency]);

  const handleChangeOrderStatus = async (orderId, newStatus) => {
    try {
      if (!orderId) return;

      const currentOrder =
        orders.find((o) => o.id === orderId || o._id === orderId) ||
        selectedOrder ||
        null;

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

      const history = Array.isArray(currentOrder.history) ? currentOrder.history : [];
      await updateOrderStatus(orderId, newStatus, history);

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

  // NOVA LOGICA DE IMPRESSAO (alinhada com main.js + OrderDetailsModal)
  const handlePrintOrder = useCallback(async (order, mode = "full") => {
    try {
      if (!order) return;

      const safeMode = mode || "full";
      let printResult = null;

      // Usar configurações de impressão melhoradas
      const settings = (await getSettings()) || {};
      const printingSettings = settings.printing || {};
      const isSilent = printingSettings.silentMode !== false; // Default true
      const isAsync = printingSettings.asyncMode === true;

      if (window.electronAPI.printOrder) {
        printResult = await window.electronAPI.printOrder(order, {
          mode: safeMode,
          silent: isSilent,
          async: isAsync,
        });
      } else if (window.printEngine.printOrder) {
        const engineResult = await window.printEngine.printOrder(order, {
          mode: safeMode,
          silent: isSilent,
          async: isAsync,
        });
        printResult =
          typeof engineResult === "object"
            ? engineResult
            : { success: Boolean(engineResult) };
      } else {
        console.warn(
          "[OrdersPage] Nenhuma API de impressão (electronAPI.printOrder / printEngine.printOrder). Usando window.print()."
        );
        window.print();
        printResult = { success: true };
      }

      if (printResult && printResult.success) {
        emitToast({
          type: "success",
          message: "Impressão enviada com sucesso!",
        });
      } else {
        emitToast({
          type: "error",
          message: "Falha ao imprimir. Verifique a impressora.",
        });
      }
    } catch (err) {
      console.error("[OrdersPage] Erro ao imprimir pedido:", err);
      emitToast({
        type: "error",
        title: "Falha na impressão",
        message:
          err.message || "Erro desconhecido ao tentar imprimir o pedido.",
        duration: 6000,
      });
    }
  }, []);

  useEffect(() => {
    const listener =
      typeof window.orderEvents.onNewOrder === "function"
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
            notifyNewOrder(order);
          })
        : null;

    return typeof listener === "function" ? listener : undefined;
  }, [handlePrintOrder, notifyNewOrder]);

  useEffect(() => {
    if (typeof window.orderEvents.onOrderUpdated !== "function") {
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
  }, []);

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
    setFormInitialSection(null);
    setActiveModal("create");
  };

  // ========= EXCLUIR (HARD DELETE) =========

  const handleDeleteOrder = async (orderToDelete) => {
    try {
      if (!orderToDelete) return;

      const confirmed = window.confirm(
        "Deseja realmente excluir este pedido Esta acao nao pode ser desfeita."
      );
      if (!confirmed) return;

      const orderId = resolveOrderId(orderToDelete);

      // Otimista: remove da lista em memoria
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

      await deleteOrderRecord(orderId);

      await loadOrders();
    } catch (err) {
      console.error("[OrdersPage] Erro ao excluir pedido:", err);
      emitToast({
        type: "error",
        message: "Erro ao excluir pedido. Veja o console para detalhes.",
      });
    }
  };

  const handleEditOrder = (orderToEdit, section = null) => {
    if (!orderToEdit) return;
    setSelectedOrder(orderToEdit);
    setFormInitialOrder(orderToEdit);
    setFormInitialSection(section);
    setActiveModal("create");
  };

  // ========= MODAIS / AÇÕES =========

  const handleNewOrderClick = () => {
    setSelectedOrder(null);
    setFormInitialOrder(null);
    setFormInitialSection(null);
    setActiveModal("create");
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedOrder(null);
    setFormInitialOrder(null);
    setFormInitialSection(null);
  };

  const selectedOrderId = resolveOrderId(selectedOrder);

  // ========= ATALHOS DE TECLADO =========
  useEffect(() => {
    const handler = (event) => {
      const action = event.detail.action;
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
        searchInputRef.current.focus();
        return;
      }
      if (action === "close-modal" && activeModal) {
        handleCloseModal();
      }
    };

    window.addEventListener("app:shortcut", handler);
    return () => window.removeEventListener("app:shortcut", handler);
  }, [activeModal, loadOrders, handleCloseModal, handleNewOrderClick]);

  useEffect(() => {
    const handleSlashFocus = (event) => {
      if (event.key !== "/") return;
      const target = event.target;
      const tag = target.tagName;
      const isField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable;
      if (isField) return;
      event.preventDefault();
      searchInputRef.current.focus();
    };

    window.addEventListener("keydown", handleSlashFocus);
    return () => window.removeEventListener("keydown", handleSlashFocus);
  }, []);

  useEffect(() => {
    const handleOrdersShortcuts = (event) => {
      const target = event.target;
      const tag = target.tagName;
      const isField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable;
      if (isField) return;

      const key = (event.key || "").toLowerCase();
      const isCtrl = event.ctrlKey || event.metaKey;
      if (!isCtrl) return;

      const statusMap = {
        "0": "all",
        "1": "open",
        "2": "preparing",
        "3": "out_for_delivery",
        "4": "done",
        "5": "cancelled",
        "9": "late",
      };
      if (statusMap[key]) {
        event.preventDefault();
        setFilters((prev) => ({ ...prev, status: statusMap[key] }));
        return;
      }

      if (key === "r") {
        event.preventDefault();
        loadOrders();
        return;
      }

      if (key === "l") {
        event.preventDefault();
        setFilters((prev) => ({ ...prev, search: "" }));
        searchInputRef.current?.focus();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        handleNewOrderClick();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleOrdersShortcuts);
    return () => window.removeEventListener("keydown", handleOrdersShortcuts);
  }, [handleNewOrderClick, loadOrders]);

  return (
    <Page>
      <div className="orders-page">
        <section className="orders-hero">
          <div className="orders-hero-header">
            <div>
              <h3 className="orders-hero-title">Resumo de hoje</h3>
              <p className="orders-hero-subtitle">
                Visual rapido do desempenho e dos pedidos em andamento.
              </p>
            </div>
            <div className="orders-hero-actions">
              <button className="btn btn-primary" onClick={handleNewOrderClick}>
                <OrderIcon name="plus" />
                Novo pedido
              </button>
              <div className="orders-hero-meta">
                {lastUpdatedAt && (
                  <span className="orders-hero-meta-pill">
                    Atualizado as{" "}
                    {new Date(lastUpdatedAt).toLocaleTimeString("pt-BR")}
                  </span>
                )}
                {isRefreshing && (
                  <span className="orders-hero-meta-pill orders-hero-meta-pill--pulse">
                    Atualizando
                  </span>
                )}
              </div>
            </div>
          </div>

          {loadError && (
            <div className="orders-hero-banner orders-hero-banner--error">
              {loadError}
            </div>
          )}

          <div className="orders-hero-grid">
            <div className="orders-hero-card">
              <div className="orders-hero-label">Pedidos hoje</div>
              <div className="orders-hero-value">
                {formatNumber(kpis.totalOrdersToday)}
              </div>
              <div className="orders-hero-meta-row">
                <span className="orders-hero-meta-chip">
                  Ticket medio {formatCurrency(kpis.avgTicket)}
                </span>
              </div>
            </div>

            <div className="orders-hero-card">
              <div className="orders-hero-label">Faturamento hoje</div>
              <div className="orders-hero-value">
                {formatCurrency(kpis.totalRevenueToday)}
              </div>
              <div className="orders-hero-meta-row">
                <span className="orders-hero-meta-chip">
                  Finalizados {formatNumber(kpis.doneCountToday)}
                </span>
              </div>
            </div>

            <div className="orders-hero-card orders-hero-card--alert">
              <div className="orders-hero-label">Atrasados</div>
              <div className="orders-hero-value">
                {formatNumber(kpis.lateCountToday)}
              </div>
              <div className="orders-hero-meta-row">
                <span className="orders-hero-meta-chip">
                  Acima do tempo medio
                </span>
              </div>
            </div>

            <div className="orders-hero-card orders-hero-card--sources">
              <div className="orders-hero-label">Canais</div>
              <div className="orders-hero-sources">
                {[
                  {
                    key: "website",
                    label: "Site",
                    value: kpis.bySource.website,
                  },
                  {
                    key: "whatsapp",
                    label: "WhatsApp",
                    value: kpis.bySource.whatsapp,
                  },
                  {
                    key: "ifood",
                    label: "iFood",
                    value: kpis.bySource.ifood,
                  },
                  {
                    key: "local",
                    label: "Local",
                    value: kpis.bySource.local,
                  },
                  {
                    key: "other",
                    label: "Outros",
                    value: kpis.bySource.other,
                  },
                ].map((entry) => (
                  <span key={entry.key}>
                    {entry.label} {formatNumber(entry.value)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="orders-hero-status">
            {[
              { key: "open", label: "Em aberto", tone: "open" },
              { key: "preparing", label: "Em preparo", tone: "preparing" },
              { key: "out_for_delivery", label: "Em entrega", tone: "delivering" },
              { key: "done", label: "Finalizados", tone: "done" },
              { key: "cancelled", label: "Cancelados", tone: "cancelled" },
            ].map((item) => (
              <div
                key={item.key}
                className={`orders-hero-status-chip orders-hero-status-chip--${item.tone}`}
              >
                <span>{item.label}</span>
                <strong>{formatNumber(statusCounts[item.key])}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* Toolbar: filtros + botao atualizar */}
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
              disabled={isLoading || isRefreshing}
            >
              <OrderIcon name="refresh" />
              {isLoading || isRefreshing ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        {isLoading && orders.length === 0 ? (
          <div className="order-list">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={`orders-skeleton-${idx}`}
                className="skeleton skeleton-card"
              />
            ))}
          </div>
        ) : (
          <OrderList
            orders={orders}
            filters={filters}
            onClickOrder={handleOpenDetails}
            onCreateOrder={handleNewOrderClick}
            isRefreshing={isRefreshing}
          />
        )}
      </div>
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
          initialSection={formInitialSection}
        />
      )}
    </Page>
  );
};

export default OrdersPage;
