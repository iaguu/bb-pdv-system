import React from "react";
import { formatCurrencyBR } from "../../utils/orderUtils";

const MotoboyRow = ({
  motoboy,
  onEdit,
  onToggleActive,
  onGenerateQr,
  onAddTip,
}) => {
  const isActive = motoboy.active !== false && motoboy.isActive !== false;
  const tipsTotal =
    typeof motoboy.tipsTotal === "number"
      ? motoboy.tipsTotal
      : Array.isArray(motoboy.tips)
      ? motoboy.tips.reduce(
          (sum, tip) => sum + (Number(tip.amount) || 0),
          0
        )
      : 0;
  const hasTips = tipsTotal > 0;

  const handleEdit = (event) => {
    event.stopPropagation();
    onEdit(motoboy);
  };

  const handleToggle = (event) => {
    event.stopPropagation();
    onToggleActive(motoboy.id, !isActive);
  };

  const handleQr = (event) => {
    event.stopPropagation();
    onGenerateQr(motoboy);
  };

  const handleTip = (event) => {
    event.stopPropagation();
    onAddTip(motoboy);
  };

  return (
    <div
      className={`motoboy-row${!isActive ? " motoboy-row--inactive" : ""}`}
      onClick={() => onEdit(motoboy)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(motoboy);
        }
      }}
    >
      <div className="motoboy-row-main">
        <div className="motoboy-row-title">
          <div className="motoboy-row-name">{motoboy.name || "(Sem nome)"}</div>
          <span
            className={`status-pill ${
              isActive ? "status-pill--success" : "status-pill--danger"
            }`}
          >
            {isActive ? "Ativo" : "Inativo"}
          </span>
          {motoboy.qrToken && (
            <span className="status-pill status-pill--warning">QR ativo</span>
          )}
          {hasTips && (
            <span className="status-pill status-pill--success">
              Gorjetas {formatCurrencyBR(tipsTotal)}
            </span>
          )}
        </div>

        <div className="motoboy-row-meta">
          {motoboy.phone && <span>{motoboy.phone}</span>}
          {motoboy.document && <span>{motoboy.document}</span>}
        </div>
      </div>

      <div className="motoboy-row-actions">
        <button
          type="button"
          className="btn btn-ghost btn-ghost--small"
          onClick={handleEdit}
        >
          Editar
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-ghost--small"
          onClick={handleToggle}
        >
          {isActive ? "Desativar" : "Ativar"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-ghost--small"
          onClick={handleQr}
        >
          QR Code
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-ghost--small"
          onClick={handleTip}
        >
          Gorjeta
        </button>
      </div>
    </div>
  );
};

export default MotoboyRow;
