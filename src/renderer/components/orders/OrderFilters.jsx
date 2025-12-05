// src/renderer/components/orders/OrderFilters.jsx
import React from "react";

const STATUS_OPTIONS = [
  { value: "open", label: "Em aberto / preparo / entrega" },
  { value: "delivery", label: "Somente entrega" },
  { value: "done", label: "Finalizados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "all", label: "Todos" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Todos os canais" },
  { value: "website", label: "Site" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ifood", label: "iFood" },
  { value: "local", label: "Balcão / Sistema" },
];

const OrderFilters = ({ value = {}, onChange }) => {
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
      <div className="order-filters-field">
        <label className="order-filters-label">Status</label>
        <select
          className="order-filters-select"
          value={currentStatus}
          onChange={(e) => handleChange("status", e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

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
        <label className="order-filters-label">
          Buscar (ID ou cliente)
        </label>
        <input
          className="order-filters-input"
          type="text"
          placeholder="Ex: 123 ou João"
          value={currentSearch}
          onChange={(e) => handleChange("search", e.target.value)}
        />
      </div>
    </div>
  );
};

export default OrderFilters;
