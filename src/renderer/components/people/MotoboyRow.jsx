// src/renderer/components/people/MotoboyRow.jsx
import React from "react";
import Tag from "../common/Tag";

const MotoboyRow = ({ motoboy, onClick }) => {
  const isActive = motoboy.isActive !== false; // default = ativo
  const status = motoboy.status || (isActive ? "available" : "offline");

  let statusLabel;
  let tone;

  if (!isActive || status === "offline") {
    statusLabel = "Pausado / Offline";
    tone = "danger";
  } else if (status === "delivering") {
    statusLabel = "Em entrega";
    tone = "warning";
  } else {
    statusLabel = "Disponível";
    tone = "success";
  }

  const qrSuffix =
    motoboy.qrToken && motoboy.qrToken.length > 8
      ? motoboy.qrToken.slice(-8)
      : motoboy.qrToken || "";

  return (
    <div className="motoboy-row" onClick={() => onClick(motoboy)}>
      <div className="motoboy-row-main">
        <div className="motoboy-row-title">
          <div className="motoboy-row-name">
            {motoboy.name || "(Sem nome)"}
          </div>
          <Tag tone={tone}>{statusLabel}</Tag>
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
          {motoboy.baseNeighborhood && (
            <span className="motoboy-row-neighborhood">
              Base: {motoboy.baseNeighborhood}
            </span>
          )}
          {qrSuffix && (
            <span className="motoboy-row-qr">
              QR: •••{qrSuffix}
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
