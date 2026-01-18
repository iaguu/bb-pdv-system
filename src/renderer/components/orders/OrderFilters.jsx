import React, { useEffect, useState } from "react";
import { ORDER_STATUS_PRESETS } from "../../utils/orderUtils";
import { OrderIcon } from "./OrderIcons";

const SOURCE_OPTIONS = [
  { value: "all", label: "Todos os canais" },
  { value: "website", label: "Site" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ifood", label: "iFood" },
  { value: "local", label: "Balcão / Sistema" },
];

const STATUS_ICONS = {
  all: "summary",
  open: "status",
  preparing: "options",
  out_for_delivery: "send",
  done: "check",
  cancelled: "trash",
  late: "status",
};

const OrderFilters = ({ value = {}, onChange, searchInputRef }) => {
  const currentStatus = value.status || "open";
  const currentSource = value.source || "all";
  const currentSearch = value.search || "";
  const [localSearch, setLocalSearch] = useState(currentSearch);

  const handleChange = (field, fieldValue) => {
    if (!onChange) return;
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  useEffect(() => {
    setLocalSearch(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== currentSearch) {
        handleChange("search", localSearch);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [localSearch, currentSearch]);

  return (
    <div className="order-filters">
      <div className="order-status-tabs" role="tablist" aria-label="Status dos pedidos">
        {ORDER_STATUS_PRESETS.map((tab) => {
          const isActive = currentStatus === tab.key;
          const classes = [
            "order-status-tab",
            `order-status-tab--tone-${tab.tone}`,
            isActive ? "order-status-tab--active" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
            key={tab.key}
            type="button"
            className={classes}
            onClick={() => handleChange("status", tab.key)}
          >
            <OrderIcon name={STATUS_ICONS[tab.key] || "status"} />
            <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="order-filters-controls">
        <div className="order-filters-field">
          <label className="order-filters-label">Origem</label>
          <select
            className="order-filters-select"
            value={currentSource}
            onChange={(e) => handleChange("source", e.target.value)}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="order-filters-field order-filters-field--search">
          <label className="order-filters-label">Buscar (ID ou cliente)</label>
          <div className="order-filters-input-wrap">
            <OrderIcon name="search" />
            <input
              className="order-filters-input"
              type="search"
              placeholder="Ex: 123 ou Joao"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              ref={searchInputRef}
            />
            {localSearch && (
              <button
                type="button"
                className="order-filters-clear"
                onClick={() => setLocalSearch("")}
                aria-label="Limpar busca"
                title="Limpar"
              >
                <OrderIcon name="close" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderFilters;
