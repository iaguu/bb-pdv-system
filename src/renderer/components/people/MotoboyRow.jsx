import React from "react";

const MotoboyRow = ({ motoboy, onEdit, onToggleActive, onGenerateQr }) => {
  return (
    <tr className={!motoboy.active ? "is-inactive" : ""}>
      <td>{motoboy.name}</td>
      <td>{motoboy.phone}</td>
      <td>{motoboy.document}</td>
      <td>
        <span
          className={
            "status-pill " +
            (motoboy.active
              ? "status-pill--active"
              : "status-pill--inactive")
          }
        >
          {motoboy.active ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td className="people-table__actions">
        <button
          type="button"
          className="btn btn-ghost btn-ghost--small"
          onClick={() => onEdit && onEdit(motoboy)}
        >
          Editar
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-ghost--small"
          onClick={() =>
            onToggleActive && onToggleActive(motoboy.id, !motoboy.active)
          }
        >
          {motoboy.active ? "Desativar" : "Ativar"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-ghost--small"
          onClick={() => onGenerateQr && onGenerateQr(motoboy)}
        >
          QR Code
        </button>
      </td>
    </tr>
  );
};

export default MotoboyRow;
