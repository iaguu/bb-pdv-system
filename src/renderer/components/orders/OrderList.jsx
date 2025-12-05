// src/renderer/components/orders/OrderList.jsx
import React, { useMemo } from "react";
import OrderRow from "./OrderRow";

function normalizeStatus(status) {
  if (!status) return "open";
  const s = status.toString().toLowerCase();
  if (s === "finalizado" || s === "done") return "done";
  if (s === "cancelado" || s === "cancelled") return "cancelled";
  if (s === "preparing" || s === "em_preparo" || s === "preparo") {
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
}

const STATUS_GROUPS = [
  { key: "open", label: "Em aberto" },
  { key: "preparing", label: "Em preparo" },
  { key: "out_for_delivery", label: "Em entrega" },
  { key: "done", label: "Finalizados" },
  { key: "cancelled", label: "Cancelados" },
];

const OrderList = ({ orders = [], filters = {}, onClickOrder }) => {
  const { status = "open", source = "all", search = "" } = filters;

  const { groupedOrders, totalCount } = useMemo(() => {
    const now = new Date();
    const lowerSearch = search.toString().toLowerCase().trim();

    const isOpenLike = (st) => {
      const ns = normalizeStatus(st);
      return (
        ns === "open" || ns === "preparing" || ns === "out_for_delivery"
      );
    };

    const filtered = (Array.isArray(orders) ? orders : []).filter((o) => {
      const ns = normalizeStatus(o.status);
      const src = (o.source || "all").toString().toLowerCase();

      // Filtro por status geral
      if (status === "open") {
        // pipeline principal
        if (!["open", "preparing", "out_for_delivery"].includes(ns)) {
          return false;
        }
      } else if (status === "done") {
        if (ns !== "done") return false;
      } else if (status === "cancelled") {
        if (ns !== "cancelled") return false;
      } else if (status === "delivery") {
        if (ns !== "out_for_delivery") return false;
      } else if (status === "all") {
        // passa tudo
      } else {
        // fallback: filtra por status específico
        if (ns !== status) return false;
      }

      // Filtro por canal/origem
      if (source !== "all") {
        if (source === "website") {
          if (src !== "website" && src !== "web") return false;
        } else if (source === "local") {
          if (
            src !== "local" &&
            src !== "balcão" &&
            src !== "counter" &&
            src !== "desktop"
          ) {
            return false;
          }
        } else {
          if (src !== source) return false;
        }
      }

      // Busca por ID / nome de cliente (quando existir)
      if (lowerSearch) {
        const idStr = (o.id || o._id || "").toString();
        const customerName =
          o.customerSnapshot?.name ||
          o.customer?.name ||
          o.customerName ||
          "";
        const haystack = `${idStr} ${customerName}`.toLowerCase();

        if (!haystack.includes(lowerSearch)) {
          return false;
        }
      }

      return true;
    });

    const groups = {
      open: [],
      preparing: [],
      out_for_delivery: [],
      done: [],
      cancelled: [],
    };

    filtered.forEach((o) => {
      const ns = normalizeStatus(o.status);
      const createdAt = o.createdAt ? new Date(o.createdAt) : null;
      let minutesSince = null;

      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        minutesSince = Math.round(
          (now.getTime() - createdAt.getTime()) / 60000
        );
      }

      const isFreshTime =
        minutesSince != null && minutesSince <= 5 && isOpenLike(o.status);
      const isNewFlag = !!o.isNew || !!o.isNewFromSite;
      const isNew = isFreshTime || isNewFlag;

      const targetKey = groups[ns] ? ns : "open";
      groups[targetKey].push({ order: o, isNew });
    });

    // Ordena cada grupo por createdAt desc (mais recente primeiro)
    Object.keys(groups).forEach((k) => {
      groups[k].sort((a, b) => {
        const da = a.order.createdAt ? new Date(a.order.createdAt) : null;
        const db = b.order.createdAt ? new Date(b.order.createdAt) : null;
        const ta = da ? da.getTime() : 0;
        const tb = db ? db.getTime() : 0;
        return tb - ta;
      });
    });

    const total = filtered.length;

    return {
      groupedOrders: groups,
      totalCount: total,
    };
  }, [orders, status, source, search]);

  if (totalCount === 0) {
    return (
      <div className="order-list-empty">
        <div className="order-list-empty-icon">🍕</div>
        <div className="order-list-empty-title">
          Nenhum pedido encontrado
        </div>
        <div className="order-list-empty-subtitle">
          Ajuste os filtros ou aguarde novos pedidos chegarem.
        </div>
      </div>
    );
  }

  return (
    <div className="order-list">
      {STATUS_GROUPS.map((group) => {
        const bucket = groupedOrders[group.key] || [];
        if (bucket.length === 0) return null;

        return (
          <section key={group.key} className="order-list-group">
            <header className="order-list-group-header">
              <div className="order-list-group-title">
                {group.label}
              </div>
              <div className="order-list-group-count">
                {bucket.length} pedido
                {bucket.length > 1 ? "s" : ""}
              </div>
            </header>

            <div className="order-list-group-body">
              {bucket.map(({ order, isNew }) => (
                <OrderRow
                  key={order.id || order._id || order.createdAt}
                  order={order}
                  isNew={isNew}
                  onClick={() => onClickOrder && onClickOrder(order)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default OrderList;
