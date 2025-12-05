// src/renderer/components/people/MotoboyRow.jsx
import React from "react";
import Tag from "../common/Tag";

const MotoboyRow = ({ motoboy, onClick }) => {
  const isActive = motoboy.isActive !== false; // default = ativo

  return (
    <div className="motoboy-row" onClick={() => onClick(motoboy)}>
      <div className="motoboy-row-main">
        <div className="motoboy-row-title">
          <div className="motoboy-row-name">
            {motoboy.name || "(Sem nome)"}
          </div>
          <Tag tone={isActive ? "success" : "danger"}>
            {isActive ? "Ativo" : "Pausado"}
          </Tag>
        </div>

        <div className="motoboy-row-meta">
          {motoboy.phone && <span>{motoboy.phone}</span>}
          {motoboy.vehicleType && (
            <span className="motoboy-row-vehicle">
              {motoboy.vehicleType}
            </span>
          )}
          {motoboy.vehiclePlate && (
            <span className="motoboy-row-plate">
              Placa {motoboy.vehiclePlate}
            </span>
          )}
        </div>
      </div>

      <div className="motoboy-row-side">
        {motoboy.totalDeliveries != null && (
          <span>{motoboy.totalDeliveries} entregas</span>
        )}
      </div>
    </div>
  );
};

export default MotoboyRow;
