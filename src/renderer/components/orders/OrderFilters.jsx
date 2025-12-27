import React from "react";
import { ORDER_STATUS_PRESETS } from "../../utils/orderUtils";

const SOURCE_OPTIONS = [
  { value: "all", label: "Todos os canais" },
  { value: "website", label: "Site" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ifood", label: "iFood" },
  { value: "local", label: "Balcão / Sistema" },
];

const OrderFilters = ({ value = {}, onChange, searchInputRef }) => {
  const currentStatus = value.status || "open";
  const currentSource = value.source || "all";
  const currentSearch = value.search || "";

  const handleChange = (field, fieldValue) => {
    if (!onChange) return;
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="order-filters">
      <div className="order-status-tabs" role="tablist" aria-label="Status dos pedidos">
        {ORDER_STATUS_PRESETS.map((tab) => {
          const isActive = currentStatus === tab.value;
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
          <input
            className="order-filters-input"
            type="search"
            placeholder="Ex: 123 ou Joao"
            value={currentSearch}
            onChange={(e) => handleChange("search", e.target.value)}
            ref={searchInputRef}
          />
        </div>
      </div>
    </div>
  );
};

export default OrderFilters;
