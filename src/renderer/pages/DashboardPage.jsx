// src/renderer/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import Page from "../components/layout/Page";
import OrderRow from "../components/orders/OrderRow";
import { normalizeStatus, getOrderTotal, formatCurrencyBR } from "../utils/orderUtils";
import { emitToast } from "../utils/toast";

const normalizeOrdersData = (data) => {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.orders)) return data.orders;
  if (Array.isArray(data)) return data;
  return [];
};

const getOrderDate = (order) => {
  const raw =
    order.createdAt ||
    order.created_at ||
    order.date ||
    order.created_at_iso;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};


const DashboardPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7d"); // today | 7d | 30d | all

  const loadOrders = async () => {
    try {
      setLoading(true);

      if (!window.dataEngine) {
        console.warn("[DashboardPage] dataEngine não disponível.");
        setOrders([]);
        return;
      }

      const data = await window.dataEngine.get("orders");
      const items = normalizeOrdersData(data);

      // respeita soft delete
      const visibleItems = items.filter((o) => !o.deleted);
      setOrders(visibleItems);
    } catch (err) {
      console.error("Erro ao carregar pedidos para a Dashboard:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // -----------------------------
  // Filtro por período
  // -----------------------------
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    if (period === "all") {
      return [...orders];
    }

    const now = new Date();
    const end = now;

    const start = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);

      if (period === "today") {
        return d;
      }

      if (period === "7d") {
        d.setDate(d.getDate() - 6);
        return d;
      }

      if (period === "30d") {
        d.setDate(d.getDate() - 29);
        return d;
      }

      return d;
    })();

    return orders.filter((o) => {
      const d = getOrderDate(o);
      if (!d) return false;
      return d >= start && d <= end;
    });
  }, [orders, period]);

  // -----------------------------
  // Estatísticas principais
  // -----------------------------
  const stats = useMemo(() => {
    if (!filteredOrders.length) {
      return {
        ordersCount: 0,
        revenue: 0,
        avgTicket: 0,
        openCount: 0,
        pizzasSold: 0,
        deliveryFees: 0,
        discountsTotal: 0,
        uniqueCustomers: 0,
        lateCount: 0,
        bySource: {
          website: 0,
          whatsapp: 0,
          ifood: 0,
          local: 0,
          other: 0,
        },
      };
    }

    const now = new Date();
    const customersSet = new Set();

    // Ignora cancelados
    const validOrders = filteredOrders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s !== "cancelled" && s !== "cancelado";
    });

    const ordersCount = validOrders.length;

    let revenue = 0;
    let pizzasSold = 0;
    let openCount = 0;
    let deliveryFees = 0;
    let discountsTotal = 0;
    let lateCount = 0;

    const bySource = {
      website: 0,
      whatsapp: 0,
      ifood: 0,
      local: 0,
      other: 0,
    };

    const isOpenLike = (status) => {
      const s = normalizeStatus(status);
      return (
        s === "open" || s === "preparing" || s === "out_for_delivery"
      );
    };

    validOrders.forEach((order) => {
      // TOTAL
      const fromTotals =
        order.totals && typeof order.totals.finalTotal === "number"
          ? order.totals.finalTotal
          : null;

      const fromNewTotal =
        typeof order.total === "number" ? order.total : null;

      const subtotalNew =
        typeof order.subtotal === "number" ? order.subtotal : 0;
      const deliveryNew =
        typeof order.deliveryFee === "number"
          ? order.deliveryFee
          : 0;
      const discountNew =
        order.discount && typeof order.discount.amount === "number"
          ? order.discount.amount
          : 0;

      const computedFallback =
        subtotalNew + deliveryNew - discountNew;

      const orderTotal =
        fromTotals ?? fromNewTotal ?? computedFallback ?? 0;

      revenue += orderTotal;

      // STATUS / ATRASO
      const status = order.status || "";
      const normalizedStatus = normalizeStatus(status);

      if (normalizedStatus === "open") {
        openCount += 1;
      }

      if (isOpenLike(status)) {
        const created = getOrderDate(order);
        if (created) {
          const diffMinutes = Math.round(
            (now.getTime() - created.getTime()) / 60000
          );
          if (diffMinutes >= 40) {
            lateCount += 1;
          }
        }
      }

      // PIZZAS VENDIDAS
      if (Array.isArray(order.items) && order.items.length > 0) {
        order.items.forEach((item) => {
          const isPizza =
            item.type === "pizza" ||
            !!item.size ||
            !!item.sizeLabel ||
            !!item.flavor1Name;
          if (!isPizza) return;
          const qty = Number(item.quantity || 1);
          pizzasSold += qty;
        });
      } else {
        const maybePizza =
          order.sizeLabel ||
          order.size ||
          order.flavor1Name ||
          order.summary;
        if (maybePizza) {
          const qty = Number(order.quantity || 1);
          pizzasSold += qty;
        }
      }

      // TAXAS DE ENTREGA
      const deliveryFromTotals =
        order.totals &&
        typeof order.totals.deliveryFee === "number"
          ? order.totals.deliveryFee
          : null;

      const deliveryValue =
        typeof order.deliveryFee === "number"
          ? order.deliveryFee
          : deliveryFromTotals || 0;

      deliveryFees += deliveryValue;

      // DESCONTOS
      const discountFromTotals =
        order.totals && typeof order.totals.discount === "number"
          ? order.totals.discount
          : null;

      const discountValue =
        order.discount && typeof order.discount.amount === "number"
          ? order.discount.amount
          : discountFromTotals || 0;

      discountsTotal += discountValue;

      // CLIENTES ÚNICOS
      const customerSnapshot = order.customerSnapshot || order.customer || {};
      const id =
        order.customerId ||
        customerSnapshot.id ||
        order.customer_id ||
        null;
      const name =
        order.customerName ||
        customerSnapshot.name ||
        order.counterLabel ||
        "";

      const key = id ? String(id) : name ? `name:${name}` : null;
      if (key) {
        customersSet.add(key);
      }

      // CANAIS
      const source =
        (order.source ||
          order.metadata.createdChannel ||
          "other") + "";
      const src = source.toLowerCase();

      if (src === "website" || src === "web") bySource.website += 1;
      else if (src === "whatsapp") bySource.whatsapp += 1;
      else if (src === "ifood") bySource.ifood += 1;
      else if (
        src === "desktop" ||
        src === "local" ||
        src === "balcão" ||
        src === "counter"
      ) {
        bySource.local += 1;
      } else {
        bySource.other += 1;
      }
    });

    const avgTicket =
      ordersCount > 0 ? revenue / ordersCount : 0;

    return {
      ordersCount,
      revenue,
      avgTicket,
      openCount,
      pizzasSold,
      deliveryFees,
      discountsTotal,
      uniqueCustomers: customersSet.size,
      lateCount,
      bySource,
    };
  }, [filteredOrders]);

  // -----------------------------
  // Insights rápidos
  // -----------------------------
  const insights = useMemo(() => {
    if (!filteredOrders.length) return null;

    const weekdayNames = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];

    const revenueByWeekday = Array(7).fill(0);
    const countByWeekday = Array(7).fill(0);
    const countByHour = Array(24).fill(0);

    filteredOrders.forEach((order) => {
      const d = getOrderDate(order);
      if (!d) return;

      const wd = d.getDay();
      const h = d.getHours();

      const totalSimple = Number(
        order.totals?.finalTotal ?? order.total ?? 0
      );

      revenueByWeekday[wd] += Number.isNaN(totalSimple)
        ? 0
        : totalSimple;
      countByWeekday[wd] += 1;
      countByHour[h] += 1;
    });

    // Melhor dia (por faturamento; se zero, por quantidade)
    let bestWeekdayIndex = 0;
    let bestRevenue = revenueByWeekday[0];

    for (let i = 1; i < 7; i++) {
      if (revenueByWeekday[i] > bestRevenue) {
        bestRevenue = revenueByWeekday[i];
        bestWeekdayIndex = i;
      }
    }

    const totalRevenueWeek = revenueByWeekday.reduce(
      (a, b) => a + b,
      0
    );

    if (totalRevenueWeek === 0) {
      let bestCount = countByWeekday[0];
      bestWeekdayIndex = 0;
      for (let i = 1; i < 7; i++) {
        if (countByWeekday[i] > bestCount) {
          bestCount = countByWeekday[i];
          bestWeekdayIndex = i;
        }
      }
    }

    const bestWeekdayLabel = weekdayNames[bestWeekdayIndex];

    // Horário de pico
    let peakHourIndex = 0;
    let peakCount = countByHour[0];
    for (let i = 1; i < 24; i++) {
      if (countByHour[i] > peakCount) {
        peakCount = countByHour[i];
        peakHourIndex = i;
      }
    }

    const peakHourLabel =
      peakCount > 0
        ? `${String(peakHourIndex).padStart(2, "0")}h–${String(
            (peakHourIndex + 1) % 24
          ).padStart(2, "0")}h`
        : "Sem pico definido";

    // % por canal
    const totalOrders = stats.ordersCount || filteredOrders.length;
    const channelPercentages = {
      website: 0,
      whatsapp: 0,
      ifood: 0,
      local: 0,
      other: 0,
    };

    if (totalOrders > 0) {
      Object.keys(channelPercentages).forEach((key) => {
        const count = stats.bySource[key] || 0;
        channelPercentages[key] = (count / totalOrders) * 100;
      });
    }

    const channelLabelsMap = {
      website: "Site",
      whatsapp: "WhatsApp",
      ifood: "iFood",
      local: "Balcão / Sistema",
      other: "Outros",
    };

    let dominantChannelKey = "website";
    let maxChannelCount = -1;

    Object.entries(stats.bySource).forEach(([key, value]) => {
      if (value > maxChannelCount) {
        maxChannelCount = value;
        dominantChannelKey = key;
      }
    });

    const dominantChannelLabel =
      maxChannelCount > 0
        ? channelLabelsMap[dominantChannelKey]
        : "Nenhum canal se destaca";

    const hasChannelData = Object.values(stats.bySource).some(
      (v) => v > 0
    );

    return {
      bestWeekdayLabel,
      peakHourLabel,
      dominantChannelLabel,
      channelPercentages,
      hasChannelData,
    };
  }, [filteredOrders, stats]);

  // -----------------------------
  // Mini timeline – últimos 5 pedidos
  // -----------------------------
  const recentOrders = useMemo(() => {
    if (!filteredOrders.length) return [];

    const now = new Date();

    const isOpenLike = (status) => {
      const s = normalizeStatus(status);
      return (
        s === "open" || s === "preparing" || s === "out_for_delivery"
      );
    };

    const withDate = filteredOrders
      .map((o) => {
        const d = getOrderDate(o);
        return { order: o, date: d };
      })
      .filter((x) => x.date);

    withDate.sort((a, b) => b.date - a.date);

    return withDate.slice(0, 5).map(({ order, date }) => {
      let minutesSince = null;
      if (date) {
        minutesSince = Math.round(
          (now.getTime() - date.getTime()) / 60000
        );
      }

      const isFreshTime =
        minutesSince != null &&
        minutesSince <= 5 &&
        isOpenLike(order.status);
      const isNewFlag = !!order.isNew || !!order.isNewFromSite;
      const isNew = isFreshTime || isNewFlag;

      return { order, isNew };
    });
  }, [filteredOrders]);

  // -----------------------------
  // Exportar CSV
  // -----------------------------
  const periodLabel = (() => {
    switch (period) {
      case "today":
        return "hoje";
      case "7d":
        return "ultimos_7_dias";
      case "30d":
        return "ultimos_30_dias";
      case "all":
      default:
        return "todo_periodo";
    }
  })();

  const handleExportCsv = () => {
    if (!filteredOrders.length) {
      emitToast({
        type: "warning",
        message:
          "Não há pedidos no período selecionado para exportar.",
      });
      return;
    }

    const headers = [
      "id",
      "data",
      "status",
      "origem",
      "tipo",
      "cliente",
      "telefone",
      "total",
    ];

    const rows = filteredOrders.map((order) => {
      const d = getOrderDate(order);
      const dateStr = d
        ? d.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "";

      const snapshotCustomer =
        order.customerSnapshot || order.customer || {};
      const name =
        order.customerName ||
        snapshotCustomer.name ||
        order.counterLabel ||
        "";
      const phone =
        order.customerPhone || snapshotCustomer.phone || "";

      const fromTotals =
        order.totals && typeof order.totals.finalTotal === "number"
          ? order.totals.finalTotal
          : null;
      const fromNewTotal =
        typeof order.total === "number" ? order.total : null;
      const subtotalNew =
        typeof order.subtotal === "number" ? order.subtotal : 0;
      const deliveryNew =
        typeof order.deliveryFee === "number"
          ? order.deliveryFee
          : 0;
      const discountNew =
        order.discount && typeof order.discount.amount === "number"
          ? order.discount.amount
          : 0;
      const computedFallback =
        subtotalNew + deliveryNew - discountNew;
      const orderTotal =
        fromTotals ?? fromNewTotal ?? computedFallback ?? 0;

      const source =
        order.source ||
        order.metadata.createdChannel ||
        "";
      const orderType =
        order.orderType || order.type || order.mode || "";

      return [
        order.id || "",
        dateStr,
        order.status || "",
        source,
        orderType,
        name,
        phone,
        String(orderTotal).replace(".", ","),
      ];
    });

    const csvLines = [
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
    ];
    const csvContent = csvLines.join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard_${periodLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <Page
      title="Visão geral"
      subtitle="Ambiente de gestão da pizzaria."
    >
      <div className="dashboard-shell">
        {/* Cabeçalho da dashboard */}
        <div className="dashboard-top-row">
          <div className="dashboard-top-text">
            <h2 className="dashboard-main-title">Dashboard</h2>
            <p className="dashboard-main-subtitle">
              Visão geral dos pedidos da Anne &amp; Tom, faturamento,
              canais e clientes atendidos.
            </p>
          </div>

          <div className="dashboard-top-actions">
            <div className="dashboard-period">
              <span className="dashboard-period-label">
                Período
              </span>
              <div className="dashboard-period-toggle">
                <button
                  type="button"
                  className={
                    "dashboard-period-btn" +
                    (period === "today"
                       " dashboard-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("today")}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={
                    "dashboard-period-btn" +
                    (period === "7d"
                       " dashboard-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("7d")}
                >
                  Últimos 7 dias
                </button>
                <button
                  type="button"
                  className={
                    "dashboard-period-btn" +
                    (period === "30d"
                       " dashboard-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("30d")}
                >
                  Últimos 30 dias
                </button>
                <button
                  type="button"
                  className={
                    "dashboard-period-btn" +
                    (period === "all"
                       " dashboard-period-btn-active"
                      : "")
                  }
                  onClick={() => setPeriod("all")}
                >
                  Todo o período
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline dashboard-export-btn"
              onClick={handleExportCsv}
              disabled={loading}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {loading  (
          <p className="dashboard-loading">
            Carregando dados da dashboard...
          </p>
        ) : filteredOrders.length === 0  (
          <div className="dashboard-empty">
            <p>Nenhum pedido encontrado no período selecionado.</p>
          </div>
        ) : (
          <>
            {/* GRID PRINCIPAL DE CARDS */}
            <div className="dashboard-cards-grid">
              <div className="dashboard-card">
                <div className="dashboard-card-title">
                  Faturamento
                </div>
                <div className="dashboard-card-value">
                  {formatCurrencyBR(stats.revenue)}
                </div>
                <p className="dashboard-card-helper">
                  Soma do total de todos os pedidos no período.
                </p>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-title">
                  Pedidos
                </div>
                <div className="dashboard-card-value">
                  {stats.ordersCount}
                </div>
                <p className="dashboard-card-helper">
                  Número de pedidos emitidos (exceto cancelados).
                </p>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-title">
                  Ticket médio
                </div>
                <div className="dashboard-card-value">
                  {formatCurrencyBR(stats.avgTicket)}
                </div>
                <p className="dashboard-card-helper">
                  Faturamento dividido pela quantidade de pedidos.
                </p>
              </div>

              <div className="dashboard-card dashboard-card--alert">
                <div className="dashboard-card-title">
                  Pedidos atrasados (≥ 40 min)
                </div>
                <div className="dashboard-card-value dashboard-card-value--alert">
                  {stats.lateCount}
                </div>
                <p className="dashboard-card-helper">
                  Pedidos em aberto / preparo / entrega há mais
                  de 40 minutos.
                </p>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-title">
                  Clientes atendidos
                </div>
                <div className="dashboard-card-value">
                  {stats.uniqueCustomers}
                </div>
                <p className="dashboard-card-helper">
                  Clientes únicos com pelo menos um pedido.
                </p>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-title">
                  Pizzas vendidas
                </div>
                <div className="dashboard-card-value">
                  {stats.pizzasSold}
                </div>
                <p className="dashboard-card-helper">
                  Quantidade total (Broto e Grande).
                </p>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-title">
                  Taxas de entrega
                </div>
                <div className="dashboard-card-value">
                  {formatCurrencyBR(stats.deliveryFees)}
                </div>
                <p className="dashboard-card-helper">
                  Soma de todas as taxas de entrega.
                </p>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-title">
                  Descontos aplicados
                </div>
                <div className="dashboard-card-value">
                  {formatCurrencyBR(stats.discountsTotal)}
                </div>
                <p className="dashboard-card-helper">
                  Valor total de descontos concedidos.
                </p>
              </div>
            </div>

            {/* INSIGHTS + MINI TIMELINE */}
            <div className="dashboard-secondary-grid">
              {/* Insights rápidos + gráfico de canais */}
              {insights && (
                <div className="dashboard-insights-card">
                  <div className="dashboard-section-header">
                    <h3 className="dashboard-section-title">
                      Insights rápidos
                    </h3>
                    <p className="dashboard-section-subtitle">
                      Baseado nos pedidos do período selecionado.
                    </p>
                  </div>

                  <div className="dashboard-insights-main">
                    <div className="dashboard-insight-item">
                      <span className="dashboard-insight-label">
                        Melhor dia:
                      </span>
                      <span className="dashboard-insight-value">
                        {insights.bestWeekdayLabel}
                      </span>
                    </div>

                    <div className="dashboard-insight-item">
                      <span className="dashboard-insight-label">
                        Horário de pico:
                      </span>
                      <span className="dashboard-insight-value">
                        {insights.peakHourLabel}
                      </span>
                    </div>

                    <div className="dashboard-insight-item">
                      <span className="dashboard-insight-label">
                        Canal dominante:
                      </span>
                      <span className="dashboard-insight-value">
                        {insights.dominantChannelLabel}
                      </span>
                    </div>
                  </div>

                  <div className="dashboard-insights-chart">
                    <div className="dashboard-insights-chart-title">
                      Distribuição por canal (% de pedidos)
                    </div>

                    {insights.hasChannelData  (
                      <div className="dashboard-insights-bars">
                        {[
                          { key: "website", label: "Site" },
                          { key: "whatsapp", label: "WhatsApp" },
                          { key: "ifood", label: "iFood" },
                          {
                            key: "local",
                            label: "Balcão / Sistema",
                          },
                          { key: "other", label: "Outros" },
                        ].map((ch) => {
                          const pct =
                            insights.channelPercentages[ch.key] || 0;
                          return (
                            <div
                              key={ch.key}
                              className="dashboard-insights-bar-row"
                            >
                              <span className="dashboard-insights-bar-label">
                                {ch.label}
                              </span>
                              <div className="dashboard-insights-bar-track">
                                <div
                                  className="dashboard-insights-bar-fill"
                                  style={{
                                    width: `${pct.toFixed(0)}%`,
                                  }}
                                />
                              </div>
                              <span className="dashboard-insights-bar-value">
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="dashboard-insights-empty">
                        Ainda não há dados suficientes para calcular a
                        distribuição por canal neste período.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Últimos 5 pedidos */}
              {recentOrders.length > 0 && (
                <div className="dashboard-recent-card">
                  <div className="dashboard-section-header">
                    <h3 className="dashboard-section-title">
                      Últimos pedidos
                    </h3>
                    <p className="dashboard-section-subtitle">
                      Atualizado com base no filtro de período.
                    </p>
                  </div>

                  <div className="dashboard-recent-list">
                    {recentOrders.map(({ order, isNew }) => (
                      <OrderRow
                        key={order.id || order._id || order.createdAt}
                        order={order}
                        isNew={isNew}
                        variant="compact"
                        onClick={() => {
                          // se quiser, depois a gente abre o modal de detalhes por aqui
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CARD DE CANAIS (contagem absoluta) */}
            <div className="dashboard-channels-card">
              <div className="dashboard-channels-header">
                <div className="dashboard-card-title">
                  Canais no período
                </div>
                <div className="dashboard-channels-total">
                  Total: {stats.ordersCount} pedido
                  {stats.ordersCount !== 1  "s" : ""}
                </div>
              </div>
              <div className="dashboard-channels-grid">
                <div className="dashboard-channel-pill">
                  <span className="dashboard-channel-label">
                    Site
                  </span>
                  <span className="dashboard-channel-value">
                    {stats.bySource.website}
                  </span>
                </div>
                <div className="dashboard-channel-pill">
                  <span className="dashboard-channel-label">
                    WhatsApp
                  </span>
                  <span className="dashboard-channel-value">
                    {stats.bySource.whatsapp}
                  </span>
                </div>
                <div className="dashboard-channel-pill">
                  <span className="dashboard-channel-label">
                    iFood
                  </span>
                  <span className="dashboard-channel-value">
                    {stats.bySource.ifood}
                  </span>
                </div>
                <div className="dashboard-channel-pill">
                  <span className="dashboard-channel-label">
                    Balcão / Sistema
                  </span>
                  <span className="dashboard-channel-value">
                    {stats.bySource.local}
                  </span>
                </div>
                <div className="dashboard-channel-pill">
                  <span className="dashboard-channel-label">
                    Outros
                  </span>
                  <span className="dashboard-channel-value">
                    {stats.bySource.other}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Page>
  );
};

export default DashboardPage;
