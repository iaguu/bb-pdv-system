// src/renderer/pages/FinancePage.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Page from "../components/layout/Page";
import Tabs from "../components/layout/Tabs";
import CashSessionRow from "../components/finance/CashSessionRow";
import EmptyState from "../components/common/EmptyState";
import OpenCashSessionModal from "../components/finance/OpenCashSessionModal";
import CloseCashSessionModal from "../components/finance/CloseCashSessionModal";
import { formatCurrencyBR, getOrderTotal } from "../utils/orderUtils";
import { emitToast } from "../utils/toast";

const COMMISSION_RATE = 0.012; // 1,2%
const COMMISSION_COLLECTION = "commissions";

const normalizeCollectionItems = (data) => {
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
};

const parseMoneyInput = (raw) => {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  const cleaned = raw
    .toString()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n)  0 : n;
};

/**
 * Helpers de sessão de caixa
 */
const parseSessionDate = (session) => {
  const raw =
    session.openedAt ||
    session.createdAt ||
    session.startAt ||
    session.date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime())  null : d;
};

const isSessionClosed = (session) => {
  const status = (session.status || "").toLowerCase();
  if (status === "closed" || status === "fechado") return true;
  if (session.closedAt || session.endAt) return true;
  return false;
};

const getSessionSales = (session) => {
  if (typeof session.salesTotal === "number") return session.salesTotal;
  if (typeof session.revenue === "number") return session.revenue;
  if (typeof session.totalSales === "number") return session.totalSales;
  if (typeof session.grossTotal === "number") return session.grossTotal;
  return Number(session.salesTotal || 0);
};

const getSessionDifference = (session) => {
  if (typeof session.difference === "number") return session.difference;
  if (typeof session.diff === "number") return session.diff;
  if (typeof session.cashDifference === "number")
    return session.cashDifference;
  return Number(session.difference || 0);
};

const getSessionOpening = (session) => {
  if (typeof session.openAmount === "number") return session.openAmount;
  if (typeof session.openingAmount === "number")
    return session.openningAmount;
  if (typeof session.initialCash === "number") return session.initialCash;
  return Number(session.openAmount || 0);
};

const getSessionClosing = (session) => {
  if (typeof session.closeAmount === "number") return session.closeAmount;
  if (typeof session.closingAmount === "number")
    return session.closingAmount;
  if (typeof session.finalCash === "number") return session.finalCash;
  return Number(session.closeAmount || 0);
};

/**
 * Helpers de pedidos
 */
const getOrderDate = (order) => {
  const raw =
    order.createdAt ||
    order.created_at ||
    order.date ||
    order.pedidoData;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime())  null : d;
};

const getOrderPaymentMethod = (order) => {
  const raw =
    order.paymentMethod ||
    order.payment ||
    order.pagamento ||
    order.payment_type ||
    order.formaPagamento;
  return (raw || "Outros").toString();
};

const getOrderStatus = (order) => {
  const raw =
    order.status ||
    order.orderStatus ||
    order.situacao ||
    order.pedidoStatus;
  return (raw || "").toString();
};

/**
 * Estatísticas de pedidos (pode ser usada para qualquer lista)
 */
const computeOrderStats = (ordersList) => {
  if (!ordersList || !ordersList.length) {
    return {
      count: 0,
      total: 0,
      paidTotal: 0,
      unpaidTotal: 0,
      methodsTotals: {},
      cashPaid: 0,
      pixPaid: 0,
      cardPaid: 0,
    };
  }

  let count = 0;
  let total = 0;
  let paidTotal = 0;
  let unpaidTotal = 0;
  const methodsTotals = {};
  let cashPaid = 0;
  let pixPaid = 0;
  let cardPaid = 0;

  ordersList.forEach((o) => {
    count++;
    const v = Number(getOrderTotal(o) || 0);
    total += v;

    const status = getOrderStatus(o).toLowerCase();
    const isPaid =
      o.isPaid === true ||
      status === "pago" ||
      status === "paid" ||
      status === "finalizado" ||
      status === "entregue";

    const methodKey = getOrderPaymentMethod(o).toLowerCase().trim();

    if (isPaid) {
      paidTotal += v;

      if (methodKey.includes("din") || methodKey.includes("cash")) {
        cashPaid += v;
      } else if (methodKey.includes("pix")) {
        pixPaid += v;
      } else {
        cardPaid += v;
      }
    } else {
      unpaidTotal += v;
    }

    methodsTotals[methodKey] = (methodsTotals[methodKey] || 0) + v;
  });

  return {
    count,
    total,
    paidTotal,
    unpaidTotal,
    methodsTotals,
    cashPaid,
    pixPaid,
    cardPaid,
  };
};

/**
 * Estatísticas de sessões (para qualquer lista de sessões)
 */
const computeSessionStats = (sessionsList) => {
  if (!sessionsList || !sessionsList.length) {
    return {
      count: 0,
      openCount: 0,
      closedCount: 0,
      totalSales: 0,
      totalDifference: 0,
      openingSum: 0,
      closingSum: 0,
      avgPerSession: 0,
      firstSession: null,
      lastSession: null,
    };
  }

  let count = 0;
  let openCount = 0;
  let closedCount = 0;
  let totalSales = 0;
  let totalDifference = 0;
  let openingSum = 0;
  let closingSum = 0;
  let firstSession = null;
  let lastSession = null;

  sessionsList.forEach((s) => {
    count++;

    const closed = isSessionClosed(s);
    if (closed) closedCount++;
    else openCount++;

    const sales = Number(getSessionSales(s) || 0);
    const diff = Number(getSessionDifference(s) || 0);
    const opening = Number(getSessionOpening(s) || 0);
    const closing = Number(getSessionClosing(s) || 0);

    totalSales += sales;
    totalDifference += diff;
    openingSum += opening;
    closingSum += closing;

    const d = parseSessionDate(s);
    if (d) {
      if (!firstSession || d < firstSession) firstSession = d;
      if (!lastSession || d > lastSession) lastSession = d;
    }
  });

  const avgPerSession = closedCount > 0  totalSales / closedCount : 0;

  return {
    count,
    openCount,
    closedCount,
    totalSales,
    totalDifference,
    openingSum,
    closingSum,
    avgPerSession,
    firstSession,
    lastSession,
  };
};

/**
 * Payload para o fechamento (PDF)
 */
const buildCashReportPayload = ({
  filteredSessions,
  stats,
  period,
  statusFilter,
  periodLabel,
  orders,
  orderStats,
}) => {
  const now = new Date();

  const sessions = filteredSessions.map((s) => {
    const opened = parseSessionDate(s);
    const openedIso = opened  opened.toISOString() : null;

    const closedRaw = s.closedAt || s.endAt || s.closed_at;
    const closedDate = closedRaw  new Date(closedRaw) : null;
    const closedIso =
      closedDate && !Number.isNaN(closedDate.getTime())
         closedDate.toISOString()
        : null;

    const status = isSessionClosed(s)  "closed" : "open";

    const operator =
      s.openedBy || s.userName || s.operator || s.cashier || "";

    return {
      id: s.id || "",
      status,
      operator,
      openedAt: openedIso,
      closedAt: closedIso,
      opening: getSessionOpening(s),
      closing: getSessionClosing(s),
      sales: getSessionSales(s),
      difference: getSessionDifference(s),
    };
  });

  const mappedOrders = orders.map((o) => {
    const d = getOrderDate(o);
    return {
      id: o.id || o.code || "",
      createdAt: d  d.toISOString() : null,
      total: getOrderTotal(o),
      status: getOrderStatus(o),
      paymentMethod: getOrderPaymentMethod(o),
      customerName: o.customerName || o.clienteNome || "",
      source: o.source || o.origem || "",
    };
  });

  return {
    type: "cashDailyReport",
    generatedAt: now.toISOString(),
    period,
    periodLabel,
    statusFilter,
    stats: {
      count: stats.count,
      openCount: stats.openCount,
      closedCount: stats.closedCount,
      totalSales: stats.totalSales,
      totalDifference: stats.totalDifference,
      openingSum: stats.openingSum,
      closingSum: stats.closingSum,
      avgPerSession: stats.avgPerSession,
      firstSession: stats.firstSession
         stats.firstSession.toISOString()
        : null,
      lastSession: stats.lastSession
         stats.lastSession.toISOString()
        : null,
    },
    ordersSummary: {
      count: orderStats.count,
      total: orderStats.total,
      paidTotal: orderStats.paidTotal,
      unpaidTotal: orderStats.unpaidTotal,
      methodsTotals: orderStats.methodsTotals,
      cashPaid: orderStats.cashPaid,
      pixPaid: orderStats.pixPaid,
      cardPaid: orderStats.cardPaid,
    },
    sessions,
    orders: mappedOrders,
  };
};

const FinancePage = () => {
  const [tab, setTab] = useState("cash");
  const [cashSessions, setCashSessions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros
  // today | 7d | 15d | 30d | all
  const [period, setPeriod] = useState("today");
  const [statusFilter, setStatusFilter] = useState("all"); // all | open | closed

  // modais
  const [openModalVisible, setOpenModalVisible] = useState(false);
  const [closeModalVisible, setCloseModalVisible] = useState(false);

  const [openForm, setOpenForm] = useState({
    operator: "",
    openingAmount: "",
    notes: "",
  });

  const [closeForm, setCloseForm] = useState({
    countedAmount: "",
    notes: "",
  });

  // refs para auto fechamento e polling estável
  const cashSessionsRef = useRef([]);
  const ordersRef = useRef([]);
  const lastAutoClosureDateRef = useRef(null);
  const commissionSyncRef = useRef(false);

  useEffect(() => {
    cashSessionsRef.current = cashSessions;
  }, [cashSessions]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  /**
   * Carrega sessões de caixa + pedidos
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [cashData, ordersData] = await Promise.all([
        window.dataEngine.get("cashSessions"),
        window.dataEngine.get("orders"),
      ]);

      const cashItems = Array.isArray(cashData.items)
         cashData.items
        : Array.isArray(cashData)
         cashData
        : [];

      let ordersItems = [];
      if (Array.isArray(ordersData.items)) {
        ordersItems = ordersData.items;
      } else if (Array.isArray(ordersData)) {
        ordersItems = ordersData;
      } else if (ordersData && typeof ordersData === "object") {
        const values = Object.values(ordersData);
        const firstArray = values.find((v) => Array.isArray(v));
        if (firstArray) ordersItems = firstArray;
      }

      setCashSessions(cashItems);
      setOrders(ordersItems);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
      setCashSessions([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // polling para “quase tempo real” (10s)
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 10000); // 10 segundos
    return () => clearInterval(interval);
  }, [loadData]);

  // -----------------------------
  // Período (range de datas)
  // -----------------------------
  const periodRange = useMemo(() => {
    const now = new Date();
    const end = now;

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (period === "7d") {
      start.setDate(start.getDate() - 6);
    } else if (period === "15d") {
      start.setDate(start.getDate() - 14);
    } else if (period === "30d") {
      start.setDate(start.getDate() - 29);
    } else if (period === "all") {
      start.setFullYear(2000, 0, 1);
    }

    return { start, end };
  }, [period]);

  // -----------------------------
  // Sessões filtradas
  // -----------------------------
  const filteredSessions = useMemo(() => {
    if (!cashSessions.length) return [];

    const { start, end } = periodRange;

    return cashSessions.filter((s) => {
      const d = parseSessionDate(s);
      if (!d) return false;
      if (d < start || d > end) return false;

      if (statusFilter === "open" && isSessionClosed(s)) return false;
      if (statusFilter === "closed" && !isSessionClosed(s)) return false;

      return true;
    });
  }, [cashSessions, periodRange, statusFilter]);

  const hasSessions = filteredSessions.length > 0;

  const currentOpenSession = useMemo(
    () =>
      cashSessions.find((s) => {
        const st = (s.status || "").toLowerCase();
        const closedExplicit = ["closed", "fechado"].includes(st);
        const hasClosedTimestamp = Boolean(s.closedAt || s.endAt);
        const isClosed = closedExplicit || hasClosedTimestamp;
        return !isClosed;
      }) || null,
    [cashSessions]
  );

  const hasOpenSession = !!currentOpenSession;

  // garante que o modal de fechamento fecha se a sessão for encerrada
  useEffect(() => {
    if (!currentOpenSession && closeModalVisible) {
      setCloseModalVisible(false);
    }
  }, [currentOpenSession, closeModalVisible]);

  // -----------------------------
  // Estatísticas de sessões
  // -----------------------------
  const stats = useMemo(
    () => computeSessionStats(filteredSessions),
    [filteredSessions]
  );

  // Última sessão fechada
  const lastClosedSession = useMemo(() => {
    const closed = filteredSessions.filter((s) => isSessionClosed(s));
    if (!closed.length) return null;

    const sorted = [...closed].sort((a, b) => {
      const da = parseSessionDate(a);
      const db = parseSessionDate(b);
      if (!da || !db) return 0;
      return db - da;
    });

    return sorted[0];
  }, [filteredSessions]);

  // -----------------------------
  // Pedidos no período
  // -----------------------------
  const filteredOrders = useMemo(() => {
    if (!orders.length) return [];
    const { start, end } = periodRange;

    return orders.filter((o) => {
      const d = getOrderDate(o);
      if (!d) return false;
      if (d < start || d > end) return false;
      return true;
    });
  }, [orders, periodRange]);

  const orderStats = useMemo(
    () => computeOrderStats(filteredOrders),
    [filteredOrders]
  );

  const expectedCashInDrawer = useMemo(() => {
    if (!currentOpenSession) return 0;
    const opening = Number(getSessionOpening(currentOpenSession) || 0);
    return opening + Number(orderStats.cashPaid || 0);
  }, [currentOpenSession, orderStats.cashPaid]);

  const closingDifference = useMemo(() => {
    const counted = parseMoneyInput(closeForm.countedAmount);
    return counted - expectedCashInDrawer;
  }, [closeForm.countedAmount, expectedCashInDrawer]);

  // -----------------------------
  // Comissão do Sistema (1,5%) em 1, 7, 15, 30 dias
  // -----------------------------
  const commissionStats = useMemo(() => {
    const now = new Date();
    const buildRangeStats = (days) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1));

      const ordersInRange = orders.filter((o) => {
        const d = getOrderDate(o);
        return d && d >= start && d <= now;
      });

      const statsForRange = computeOrderStats(ordersInRange);
      const commission = statsForRange.total * COMMISSION_RATE;

      return {
        totalSales: statsForRange.total,
        commission,
      };
    };

    return {
      "1d": buildRangeStats(1),
      "7d": buildRangeStats(7),
      "15d": buildRangeStats(15),
      "30d": buildRangeStats(30),
    };
  }, [orders]);

  const buildTodayCommissionRecord = useCallback(() => {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const ordersInRange = orders.filter((o) => {
      const d = getOrderDate(o);
      return d && d >= start && d <= now;
    });

    const statsForRange = computeOrderStats(ordersInRange);
    const commissionRaw = statsForRange.total * COMMISSION_RATE;
    const commission = Math.round(commissionRaw * 100) / 100;
    const dateKey = now.toISOString().slice(0, 10);

    return {
      id: `commission-${dateKey}`,
      date: dateKey,
      periodStart: start.toISOString(),
      periodEnd: now.toISOString(),
      rate: COMMISSION_RATE,
      totalSales: statsForRange.total,
      commission,
      ordersCount: statsForRange.count,
      source: "pdv",
      updatedAt: now.toISOString(),
    };
  }, [orders]);

  const upsertCommissionRecord = useCallback(async (record) => {
    if (!window.dataEngine) return null;
    const current = await window.dataEngine.get(COMMISSION_COLLECTION);
    const items = normalizeCollectionItems(current);
    const index = items.findIndex((item) => item.id === record.id);
    const next = [...items];
    if (index >= 0) {
      next[index] = { ...items[index], ...record };
    } else {
      next.push({ ...record, createdAt: record.createdAt || record.updatedAt });
    }
    await window.dataEngine.set(COMMISSION_COLLECTION, { items: next });
    return next[index >= 0  index : next.length - 1];
  }, []);

  const syncCommissionToApi = useCallback(async () => {
    if (commissionSyncRef.current) return;
    commissionSyncRef.current = true;

    try {
      const record = buildTodayCommissionRecord();
      const stored = await upsertCommissionRecord(record);
      const lastSentTotal = stored.lastSentTotalSales;
      const lastSentCommission = stored.lastSentCommission;
      const wasSent =
        stored.lastSendStatus === "success" &&
        lastSentTotal === record.totalSales &&
        lastSentCommission === record.commission;

      if (wasSent) return;

      let apiConfig = null;
      if (window.electronAPI.getPublicApiConfig) {
        try {
          apiConfig = await window.electronAPI.getPublicApiConfig();
        } catch (err) {
          apiConfig = null;
        }
      }

      const baseUrl = (apiConfig.apiBaseUrl || "").replace(/\/+$/, "");
      const apiToken = apiConfig.publicApiToken || "";

      if (!baseUrl) {
        await upsertCommissionRecord({
          ...record,
          lastSendStatus: "skipped",
          lastSendError: "Base URL nao configurada.",
          lastSentAt: null,
        });
        return;
      }

      const response = await fetch(`${baseUrl}/api/pdv/commissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken  { "x-api-key": apiToken } : {}),
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        const text = await response.text();
        await upsertCommissionRecord({
          ...record,
          lastSendStatus: "error",
          lastSendError: text || "Falha ao enviar comissao.",
          lastSentAt: null,
        });
        return;
      }

      await upsertCommissionRecord({
        ...record,
        lastSendStatus: "success",
        lastSendError: "",
        lastSentAt: new Date().toISOString(),
        lastSentTotalSales: record.totalSales,
        lastSentCommission: record.commission,
      });
    } finally {
      commissionSyncRef.current = false;
    }
  }, [buildTodayCommissionRecord, upsertCommissionRecord]);

  useEffect(() => {
    if (!orders.length) {
      void syncCommissionToApi();
      return;
    }
    void syncCommissionToApi();
  }, [orders, syncCommissionToApi]);

  // -----------------------------
  // Fechamento automático à meia-noite
  // -----------------------------
  useEffect(() => {
    const checkAutoClose = async () => {
      const cashList = cashSessionsRef.current || [];
      if (!cashList.length) return;

      // encontra sessão aberta
      const openSession =
        cashList.find((s) => !isSessionClosed(s)) || null;
      if (!openSession) return;

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      // evita rodar mais de uma vez por dia
      if (lastAutoClosureDateRef.current === todayStr) return;

      const openedAt = parseSessionDate(openSession);
      if (!openedAt) return;

      const openedDateStr = openedAt.toISOString().slice(0, 10);

      // se a sessão foi aberta hoje, espera virar o dia
      if (openedDateStr === todayStr) return;

      // estamos em um novo dia -> fechar sessão anterior automaticamente
      const sessionDayStart = new Date(openedAt);
      sessionDayStart.setHours(0, 0, 0, 0);
      const sessionDayEnd = new Date(sessionDayStart);
      sessionDayEnd.setDate(sessionDayEnd.getDate() + 1);
      sessionDayEnd.setMilliseconds(sessionDayEnd.getMilliseconds() - 1);

      const allOrders = ordersRef.current || [];
      const dailyOrders = allOrders.filter((o) => {
        const d = getOrderDate(o);
        return d && d >= sessionDayStart && d <= sessionDayEnd;
      });

      const dailyOrderStats = computeOrderStats(dailyOrders);

      const opening = Number(getSessionOpening(openSession) || 0);
      const expectedCash =
        opening + Number(dailyOrderStats.cashPaid || 0);
      const countedAmount = expectedCash; // assume conferido automaticamente
      const diff = countedAmount - expectedCash; // 0

      const updatedSessions = cashList.map((s) =>
        s.id === openSession.id
           {
              ...s,
              status: "closed",
              closedAt: now.toISOString(),
              closingAmount: countedAmount,
              difference: diff,
              salesTotal: dailyOrderStats.total,
              paidTotal: dailyOrderStats.paidTotal,
              unpaidTotal: dailyOrderStats.unpaidTotal,
              closingNotes: `${
                s.closingNotes || ""
              } [Fechamento automático diário às 00h]`,
            }
          : s
      );

      try {
        await window.dataEngine.set("cashSessions", {
          items: updatedSessions,
        });

        // dados de sessão apenas do dia da sessão
        const dailySessions = updatedSessions.filter((s) => {
          const d = parseSessionDate(s);
          return d && d >= sessionDayStart && d <= sessionDayEnd;
        });

        if (
          window.dataEngine &&
          typeof window.dataEngine.exportCashReportPdf === "function" &&
          dailySessions.length
        ) {
          const dailySessionStats = computeSessionStats(dailySessions);

          const payload = buildCashReportPayload({
            filteredSessions: dailySessions,
            stats: dailySessionStats,
            period: "auto_daily",
            statusFilter: "all",
            periodLabel: `fechamento_${openedDateStr}`,
            orders: dailyOrders,
            orderStats: dailyOrderStats,
          });

          await window.dataEngine.exportCashReportPdf(payload);
        }

        lastAutoClosureDateRef.current = todayStr;

        await loadData();
        console.log(
          "[Caixa] Fechamento automático diário executado para o dia",
          openedDateStr
        );
      } catch (err) {
        console.error(
          "Erro no fechamento automático de caixa à meia-noite:",
          err
        );
      }
    };

    const intervalId = setInterval(checkAutoClose, 60000); // checa a cada 1 min
    return () => clearInterval(intervalId);
  }, [loadData]);

  // -----------------------------
  // Exportar CSV de sessões
  // -----------------------------
  const periodLabel = useMemo(() => {
    switch (period) {
      case "today":
        return "hoje";
      case "7d":
        return "ultimos_7_dias";
      case "15d":
        return "ultimos_15_dias";
      case "30d":
        return "ultimos_30_dias";
      case "all":
      default:
        return "todo_periodo";
    }
  }, [period]);

  const handleExportSessionsCsv = () => {
    if (!hasSessions) {
      emitToast({
        type: "warning",
        message:
          "Não há sessões no período e filtro selecionados para exportar.",
      });
      return;
    }

    const headers = [
      "id",
      "data_abertura",
      "data_fechamento",
      "status",
      "operador",
      "abertura",
      "fechamento",
      "vendas",
      "diferenca",
    ];

    const rows = filteredSessions.map((s) => {
      const opened = parseSessionDate(s);
      const openedStr = opened
         opened.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "";

      const closedRaw = s.closedAt || s.endAt || s.closed_at;
      const closedDate = closedRaw  new Date(closedRaw) : null;
      const closedStr =
        closedDate && !Number.isNaN(closedDate.getTime())
           closedDate.toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "";

      const status = isSessionClosed(s)  "Fechada" : "Aberta";

      const operator =
        s.openedBy || s.userName || s.operator || s.cashier || "";

      const opening = getSessionOpening(s);
      const closing = getSessionClosing(s);
      const sales = getSessionSales(s);
      const diff = getSessionDifference(s);

      return [
        s.id || "",
        openedStr,
        closedStr,
        status,
        operator,
        String(opening).replace(".", ","),
        String(closing).replace(".", ","),
        String(sales).replace(".", ","),
        String(diff).replace(".", ","),
      ];
    });

    const csvLines = [headers.join(";"), ...rows.map((r) => r.join(";"))];
    const csvContent = csvLines.join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `sessoes_caixa_${periodLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -----------------------------
  // Exportar fechamento em PDF (manual)
  // -----------------------------
  const handleExportSessionsPdf = async () => {
    if (!hasSessions) {
      emitToast({
        type: "warning",
        message:
          "Não há sessões no período e filtro selecionados para gerar o fechamento.",
      });
      return;
    }

    try {
      const payload = buildCashReportPayload({
        filteredSessions,
        stats,
        period,
        statusFilter,
        periodLabel,
        orders: filteredOrders,
        orderStats,
      });

      if (
        !window.dataEngine ||
        typeof window.dataEngine.exportCashReportPdf !== "function"
      ) {
        console.warn(
          "window.dataEngine.exportCashReportPdf não está definido. Implemente no preload/main."
        );
        emitToast({
          type: "warning",
          message:
            "Função de exportar PDF ainda não está configurada no desktop. Veja o console para detalhes.",
        });
        return;
      }

      await window.dataEngine.exportCashReportPdf(payload);

      emitToast({
        type: "success",
        message:
          "Fechamento de caixa enviado para geração de PDF. Verifique a pasta de relatórios do sistema.",
      });

      await loadData();
    } catch (err) {
      console.error("Erro ao gerar fechamento em PDF:", err);
      emitToast({
        type: "error",
        message:
          "Não foi possível gerar o PDF de fechamento. Verifique o console para mais detalhes.",
      });
    }
  };

  const handleClickSession = (session) => {
    console.log("Sessão de caixa clicada:", session);
    // futuramente: abrir modal de detalhes
  };

  // -----------------------------
  // Fluxo de abertura
  // -----------------------------
  const openOpenModal = () => {
    if (hasOpenSession) {
      emitToast({
        type: "warning",
        message: "Já existe uma sessão de caixa aberta.",
      });
      return;
    }
    setOpenForm({
      operator:
        (currentOpenSession &&
          (currentOpenSession.openedBy ||
            currentOpenSession.userName)) ||
        "",
      openingAmount: "",
      notes: "",
    });
    setOpenModalVisible(true);
  };

  const handleConfirmOpenSession = async () => {
    const openingAmount = parseMoneyInput(openForm.openingAmount);
    const operator =
      openForm.operator.trim() || "Operador não informado";

    try {
      const now = new Date();

      const newSession = {
        id: `cash_${now.getTime()}`,
        status: "open",
        openedAt: now.toISOString(),
        openedBy: operator,
        openAmount: openingAmount,
        salesTotal: 0,
        difference: 0,
        notes: openForm.notes || "",
      };

      const updatedSessions = [...cashSessions, newSession];

      await window.dataEngine.set("cashSessions", {
        items: updatedSessions,
      });

      setCashSessions(updatedSessions);
      await loadData();
      setOpenModalVisible(false);
    } catch (err) {
      console.error("Erro ao abrir sessão de caixa:", err);
      emitToast({
        type: "error",
        message:
          "Não foi possível abrir a sessão de caixa. Verifique o console.",
      });
    }
  };

  // -----------------------------
  // Fluxo de fechamento (manual)
  // -----------------------------
  const openCloseModal = () => {
    if (!currentOpenSession) {
      emitToast({
        type: "warning",
        message: "Não há sessão de caixa aberta para fechar.",
      });
      return;
    }

    setCloseForm({
      countedAmount: "",
      notes: "",
    });
    setCloseModalVisible(true);
  };

  const handleConfirmCloseSession = async () => {
    if (!currentOpenSession) {
      setCloseModalVisible(false);
      return;
    }

    const countedAmount = parseMoneyInput(closeForm.countedAmount);
    const diff = countedAmount - expectedCashInDrawer;
    const now = new Date();

    try {
      const updatedSessions = cashSessions.map((s) => {
        if (s.id !== currentOpenSession.id) return s;

        return {
          ...s,
          status: "closed",
          closedAt: now.toISOString(),
          closingAmount: countedAmount,
          difference: diff,
          salesTotal: orderStats.total,
          paidTotal: orderStats.paidTotal,
          unpaidTotal: orderStats.unpaidTotal,
          closingNotes: closeForm.notes || "",
        };
      });

      await window.dataEngine.set("cashSessions", {
        items: updatedSessions,
      });

      setCashSessions(updatedSessions);
      await loadData();
      setCloseModalVisible(false);
    } catch (err) {
      console.error("Erro ao fechar sessão de caixa:", err);
      emitToast({
        type: "error",
        message:
          "Não foi possível fechar a sessão de caixa. Verifique o console.",
      });
    }
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <Page
      title="Caixa & Financeiro"
      subtitle="Controle de sessões de caixa, fechamento diário e visão financeira."
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "cash", label: "Sessões de caixa" },
          { value: "reports", label: "Relatórios" },
        ]}
      />

      <div className="finance-header">
        <div className="finance-header-left">
          <h2 className="finance-title">
            {tab === "cash"
               "Sessões de caixa"
              : "Relatórios financeiros"}
          </h2>
          <p className="finance-subtitle">
            {tab === "cash"
               "Acompanhe as aberturas e fechamentos do caixa."
              : "Visão consolidada das sessões de caixa e pedidos."}
          </p>

          {hasOpenSession && currentOpenSession && (
            <div className="finance-open-badge">
              Caixa aberto desde{" "}
              {parseSessionDate(
                currentOpenSession
              ).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              }) || "-"}
              {currentOpenSession.openedBy
                 ` • Operador: ${currentOpenSession.openedBy}`
                : ""}
            </div>
          )}
        </div>

        <div className="finance-header-right">
          <div className="finance-filters">
            <div className="finance-period">
              <span className="finance-period-label">Período</span>
              <div className="finance-period-toggle">
                <button
                  type="button"
                  className={
                    "finance-period-btn" +
                    (period === "today"
                       " finance-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("today")}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={
                    "finance-period-btn" +
                    (period === "7d"
                       " finance-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("7d")}
                >
                  Últimos 7 dias
                </button>
                <button
                  type="button"
                  className={
                    "finance-period-btn" +
                    (period === "15d"
                       " finance-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("15d")}
                >
                  Últimos 15 dias
                </button>
                <button
                  type="button"
                  className={
                    "finance-period-btn" +
                    (period === "30d"
                       " finance-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("30d")}
                >
                  Últimos 30 dias
                </button>
                <button
                  type="button"
                  className={
                    "finance-period-btn" +
                    (period === "all"
                       " finance-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("all")}
                >
                  Todo o período
                </button>
              </div>
            </div>

            <div className="finance-status-filter">
              <span className="finance-period-label">Status</span>
              <select
                className="finance-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="open">Abertas</option>
                <option value="closed">Fechadas</option>
              </select>
            </div>
          </div>

          <div className="finance-actions">
            <button
              type="button"
              className="btn btn-primary finance-open-btn"
              onClick={openOpenModal}
              disabled={loading || hasOpenSession}
            >
              {hasOpenSession
                 "Caixa aberto"
                : "Abrir sessão de caixa"}
            </button>

            <button
              type="button"
              className="btn btn-danger finance-close-btn"
              onClick={openCloseModal}
              disabled={loading || !hasOpenSession}
            >
              Fechar sessão atual
            </button>

            <button
              type="button"
              className="btn btn-outline finance-export-btn"
              onClick={handleExportSessionsCsv}
              disabled={loading || !hasSessions}
            >
              Exportar CSV
            </button>

            <button
              type="button"
              className="btn btn-outline finance-export-pdf-btn"
              onClick={handleExportSessionsPdf}
              disabled={loading || !hasSessions}
            >
              Gerar fechamento (PDF)
            </button>

            <button
              type="button"
              className="btn btn-outline finance-refresh-btn"
              onClick={loadData}
              disabled={loading}
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* CONTEÚDO POR ABA */}
      {tab === "cash" && (
        <div className="finance-tab-content">
          {loading  (
            <p className="finance-loading">
              Carregando dados de caixa...
            </p>
          ) : !hasSessions  (
            <EmptyState
              title="Nenhuma sessão de caixa"
              description="Abra uma sessão de caixa para começar o controle diário."
            />
          ) : (
            <>
              {/* Cards de resumo de caixa */}
              <div className="finance-cards-grid">
                <div className="finance-card">
                  <div className="finance-card-title">
                    Sessões no período
                  </div>
                  <div className="finance-card-value">
                    {stats.count}
                  </div>
                  <p className="finance-card-helper">
                    {stats.closedCount} fechadas e{" "}
                    {stats.openCount} abertas.
                  </p>
                </div>

                <div className="finance-card">
                  <div className="finance-card-title">
                    Vendas em caixa
                  </div>
                  <div className="finance-card-value">
                    {formatCurrencyBR(stats.totalSales)}
                  </div>
                  <p className="finance-card-helper">
                    Soma das vendas registradas nas sessões.
                  </p>
                </div>

                <div className="finance-card">
                  <div className="finance-card-title">
                    Diferença acumulada
                  </div>
                  <div className="finance-card-value">
                    {formatCurrencyBR(stats.totalDifference)}
                  </div>
                  <p className="finance-card-helper">
                    Soma de sobras e faltas no período.
                  </p>
                </div>

                <div className="finance-card">
                  <div className="finance-card-title">
                    Média por sessão fechada
                  </div>
                  <div className="finance-card-value">
                    {formatCurrencyBR(stats.avgPerSession)}
                  </div>
                  <p className="finance-card-helper">
                    Vendas divididas pelas sessões fechadas.
                  </p>
                </div>
              </div>

              {/* Bloco de último fechamento */}
              {lastClosedSession && (
                <div className="finance-last-closure">
                  <div className="finance-last-closure-header">
                    <h3>Último fechamento</h3>
                    <span className="finance-last-closure-tag">
                      {parseSessionDate(
                        lastClosedSession
                      ).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }) || "-"}
                    </span>
                  </div>

                  <div className="finance-last-closure-grid">
                    <div className="finance-last-closure-item">
                      <span className="label">Operador</span>
                      <strong>
                        {lastClosedSession.openedBy ||
                          lastClosedSession.userName ||
                          lastClosedSession.operator ||
                          lastClosedSession.cashier ||
                          "-"}
                      </strong>
                    </div>
                    <div className="finance-last-closure-item">
                      <span className="label">Vendas</span>
                      <strong>
                        {formatCurrencyBR(
                          getSessionSales(lastClosedSession)
                        )}
                      </strong>
                    </div>
                    <div className="finance-last-closure-item">
                      <span className="label">
                        Diferença do caixa
                      </span>
                      <strong>
                        {formatCurrencyBR(
                          getSessionDifference(lastClosedSession)
                        )}
                      </strong>
                    </div>
                    <div className="finance-last-closure-item">
                      <span className="label">
                        Saldo de fechamento
                      </span>
                      <strong>
                        {formatCurrencyBR(
                          getSessionClosing(lastClosedSession)
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumo de pedidos do período */}
              <div className="finance-orders-summary">
                <h3>Resumo de pedidos no período</h3>
                {filteredOrders.length === 0  (
                  <p className="finance-orders-empty">
                    Nenhum pedido encontrado para o período
                    selecionado.
                  </p>
                ) : (
                  <div className="finance-cards-grid">
                    <div className="finance-card">
                      <div className="finance-card-title">
                        Total de pedidos
                      </div>
                      <div className="finance-card-value">
                        {orderStats.count}
                      </div>
                    </div>
                    <div className="finance-card">
                      <div className="finance-card-title">
                        Faturamento (pedidos)
                      </div>
                      <div className="finance-card-value">
                        {formatCurrencyBR(orderStats.total)}
                      </div>
                    </div>
                    <div className="finance-card">
                      <div className="finance-card-title">
                        Recebido
                      </div>
                      <div className="finance-card-value">
                        {formatCurrencyBR(orderStats.paidTotal)}
                      </div>
                    </div>
                    <div className="finance-card">
                      <div className="finance-card-title">
                        Em aberto
                      </div>
                      <div className="finance-card-value">
                        {formatCurrencyBR(orderStats.unpaidTotal)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista de sessões */}
              <div className="cash-list">
                {filteredSessions.map((s) => (
                  <CashSessionRow
                    key={s.id}
                    session={s}
                    onClick={handleClickSession}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="finance-tab-content">
          {loading  (
            <p className="finance-loading">
              Carregando relatórios...
            </p>
          ) : !hasSessions && filteredOrders.length === 0  (
            <EmptyState
              title="Nenhum dado para relatórios"
              description="Não encontramos sessões ou pedidos no período selecionado."
            />
          ) : (
            <>
              <div className="finance-cards-grid">
                <div className="finance-card">
                  <div className="finance-card-title">
                    Faturamento total (sessões)
                  </div>
                  <div className="finance-card-value">
                    {formatCurrencyBR(stats.totalSales)}
                  </div>
                  <p className="finance-card-helper">
                    Soma das vendas em todas as sessões filtradas.
                  </p>
                </div>

                <div className="finance-card">
                  <div className="finance-card-title">
                    Faturamento total (pedidos)
                  </div>
                  <div className="finance-card-value">
                    {formatCurrencyBR(orderStats.total)}
                  </div>
                  <p className="finance-card-helper">
                    Baseado nos pedidos do período.
                  </p>
                </div>

                <div className="finance-card">
                  <div className="finance-card-title">
                    Saldo de abertura acumulado
                  </div>
                  <div className="finance-card-value">
                    {formatCurrencyBR(stats.openingSum)}
                  </div>
                </div>

                <div className="finance-card">
                  <div className="finance-card-title">
                    Saldo de fechamento acumulado
                  </div>
                  <div className="finance-card-value">
                    {formatCurrencyBR(stats.closingSum)}
                  </div>
                </div>
              </div>

              {/* Comissão do Sistema */}
              <div className="finance-commission-panel">
                <h3>Comissão do Sistema (1,2%)</h3>
                <p className="finance-commission-helper">
                  Cálculo automático da taxa do sistema sobre o
                  faturamento de pedidos.
                </p>
                <div className="finance-cards-grid">
                  <div className="finance-card">
                    <div className="finance-card-title">
                      Hoje (1 dia)
                    </div>
                    <div className="finance-card-value">
                      {formatCurrencyBR(
                        commissionStats["1d"].commission
                      )}
                    </div>
                    <p className="finance-card-helper">
                      Sobre {formatCurrencyBR(
                        commissionStats["1d"].totalSales
                      )} em vendas.
                    </p>
                  </div>

                  <div className="finance-card">
                    <div className="finance-card-title">
                      Últimos 7 dias
                    </div>
                    <div className="finance-card-value">
                      {formatCurrencyBR(
                        commissionStats["7d"].commission
                      )}
                    </div>
                    <p className="finance-card-helper">
                      Sobre {formatCurrencyBR(
                        commissionStats["7d"].totalSales
                      )} em vendas.
                    </p>
                  </div>

                  <div className="finance-card">
                    <div className="finance-card-title">
                      Últimos 15 dias
                    </div>
                    <div className="finance-card-value">
                      {formatCurrencyBR(
                        commissionStats["15d"].commission
                      )}
                    </div>
                    <p className="finance-card-helper">
                      Sobre {formatCurrencyBR(
                        commissionStats["15d"].totalSales
                      )} em vendas.
                    </p>
                  </div>

                  <div className="finance-card">
                    <div className="finance-card-title">
                      Últimos 30 dias
                    </div>
                    <div className="finance-card-value">
                      {formatCurrencyBR(
                        commissionStats["30d"].commission
                      )}
                    </div>
                    <p className="finance-card-helper">
                      Sobre {formatCurrencyBR(
                        commissionStats["30d"].totalSales
                      )} em vendas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabela simples de síntese por sessão */}
              {hasSessions && (
                <div className="finance-report-table">
                  <div className="finance-report-header">
                    <span>Data</span>
                    <span>Status</span>
                    <span>Operador</span>
                    <span>Vendas</span>
                    <span>Diferença</span>
                  </div>
                  {filteredSessions.map((s) => {
                    const d = parseSessionDate(s);
                    const dateStr = d
                       d.toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "-";

                    const status = isSessionClosed(s)
                       "Fechada"
                      : "Aberta";

                    const operator =
                      s.openedBy ||
                      s.userName ||
                      s.operator ||
                      s.cashier ||
                      "-";

                    const sales = getSessionSales(s);
                    const diff = getSessionDifference(s);

                    return (
                      <div
                        key={s.id}
                        className="finance-report-row"
                      >
                        <span>{dateStr}</span>
                        <span>{status}</span>
                        <span>{operator}</span>
                        <span>{formatCurrencyBR(sales)}</span>
                        <span>{formatCurrencyBR(diff)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MODAIS DE CAIXA */}
      <OpenCashSessionModal
        open={openModalVisible}
        onClose={() => setOpenModalVisible(false)}
        form={openForm}
        onChangeField={(field, value) =>
          setOpenForm((f) => ({ ...f, [field]: value }))
        }
        onConfirm={handleConfirmOpenSession}
      />

      <CloseCashSessionModal
        open={closeModalVisible}
        onClose={() => setCloseModalVisible(false)}
        hasOpenSession={!!currentOpenSession}
        openingAmount={
          currentOpenSession  getSessionOpening(currentOpenSession) : 0
        }
        orderCount={orderStats.count}
        paidTotal={orderStats.paidTotal}
        cashPaid={orderStats.cashPaid}
        expectedCashInDrawer={expectedCashInDrawer}
        closingDifference={closingDifference}
        closeForm={closeForm}
        onChangeField={(field, value) =>
          setCloseForm((f) => ({ ...f, [field]: value }))
        }
        onConfirm={handleConfirmCloseSession}
      />
    </Page>
  );
};

export default FinancePage;
