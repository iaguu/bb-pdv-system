// src/renderer/components/orders/OrderList.jsx
import React, { useMemo } from "react";
import OrderRow, { OrderGroupHeader } from "./OrderRow";
import { normalizeStatus } from "../../utils/orderUtils";

const STATUS_GROUPS = [
  { key: "open", label: "Em aberto", tone: "open" },
  { key: "preparing", label: "Em preparo", tone: "preparing" },
  { key: "out_for_delivery", label: "Em entrega", tone: "delivering" },
  { key: "done", label: "Finalizados", tone: "done" },
  { key: "cancelled", label: "Cancelados", tone: "cancelled" },
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

      if (status === "open") {
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
        // keep all
      } else {
        if (ns !== status) return false;
      }

      if (source !== "all") {
        if (source === "website") {
          if (src !== "website" && src !== "web") return false;
        } else if (source === "local") {
          if (
            src !== "local" &&
            src !== "balcao" &&
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
        <div className="order-list-empty-icon">📭</div>
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
            <OrderGroupHeader
              title={group.label}
              count={bucket.length}
              tone={group.tone || group.key}
            />

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
