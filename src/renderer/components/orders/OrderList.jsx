// src/renderer/components/orders/OrderList.jsx
import React, { useMemo } from "react";
import OrderRow, { OrderGroupHeader } from "./OrderRow";
import {
  normalizeStatus,
  ORDER_STATUS_PRESETS,
} from "../../utils/orderUtils";

const STATUS_GROUPS = [
  { key: "late", label: "Atrasados", tone: "late" },
  { key: "open", label: "Em aberto", tone: "open" },
  { key: "preparing", label: "Em preparo", tone: "preparing" },
  { key: "out_for_delivery", label: "Em entrega", tone: "delivering" },
  { key: "done", label: "Finalizados", tone: "done" },
  { key: "cancelled", label: "Cancelados", tone: "cancelled" },
];

const OrderList = ({
  orders = [],
  filters = {},
  onClickOrder,
  onCreateOrder,
  isRefreshing = false,
}) => {
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

    const selectedPreset =
      ORDER_STATUS_PRESETS.find((preset) => preset.key === status) || null;
    const allowedStatuses = selectedPreset?.statuses || null;
    const matchesStatusFilter = (ns) => {
      if (!status || status === "all") return true;
      if (allowedStatuses) {
        return allowedStatuses.includes(ns);
      }
      return ns === status;
    };
    const filtered = (Array.isArray(orders) ? orders : []).filter((o) => {
      const ns = normalizeStatus(o.status);
      const src = (o.source || "all").toString().toLowerCase();

      if (!matchesStatusFilter(ns)) {
        return false;
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
        const customerPhone =
          o.customerSnapshot?.phone ||
          o.customer?.phone ||
          o.customerPhone ||
          "";
        const haystack = `${idStr} ${customerName} ${customerPhone}`.toLowerCase();

        if (!haystack.includes(lowerSearch)) {
          return false;
        }
      }

      return true;
    });

    const groups = {
      late: [],
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

      const minMinutes =
        typeof o.deliveryMinMinutes === "number"
          ? o.deliveryMinMinutes
          : 0;
      const lateThreshold = minMinutes > 0 ? minMinutes : 40;
      const isLate =
        isOpenLike(o.status) &&
        minutesSince != null &&
        minutesSince >= lateThreshold;

      const targetKey = isLate ? "late" : groups[ns] ? ns : "open";
      groups[targetKey].push({ order: o, isNew, isLate });
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
      <div className="empty-state">
        <div className="empty-title">Nenhum pedido encontrado</div>
        <div className="empty-description">
          Ajuste os filtros ou aguarde novos pedidos chegarem.
        </div>
        {typeof onCreateOrder === "function" && (
          <div className="empty-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onCreateOrder}
            >
              Criar pedido
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="order-list">
      <div className="order-list-summary">
        {totalCount} {totalCount === 1 ? "pedido" : "pedidos"}
      </div>
      {isRefreshing && (
        <div className="order-list-refresh">Atualizando pedidos...</div>
      )}
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
