// src/renderer/components/finance/OpenCashSessionModal.jsx
import React from "react";
import Modal from "../common/Modal";

/**
 * Modal de abertura de sessão de caixa
 *
 * Props:
 * - open / isOpen: boolean (controle de visibilidade)
 * - onClose: () => void
 * - form: { operator, openingAmount, notes }
 * - onChangeField: (field: "operator" | "openingAmount" | "notes", value: string) => void
 * - onConfirm: () => void
 */
const OpenCashSessionModal = ({
  open,
  isOpen,
  onClose,
  form,
  onChangeField,
  onConfirm,
}) => {
  const visible = typeof open === "boolean" ? open : isOpen || false;

  const handleChange =
    (field) =>
    (e) => {
      onChangeField(field, e.target.value);
    };

  return (
    <Modal
      isOpen={visible}
      open={visible}
      onClose={onClose}
      title="Abrir sessão de caixa"
    >
      <div className="cash-modal">
        <p className="cash-modal-description">
          Informe o operador e o valor inicial em dinheiro no caixa para
          começar a sessão.
        </p>

        <label className="field">
          <span className="field-label">Operador</span>
          <input
            className="input"
            value={form.operator}
            onChange={handleChange("operator")}
            placeholder="Nome do operador"
          />
        </label>

        <label className="field">
          <span className="field-label">Valor em caixa</span>
          <input
            className="input"
            value={form.openingAmount}
            onChange={handleChange("openingAmount")}
            placeholder="Ex: 150,00"
          />
        </label>

        <label className="field">
          <span className="field-label">Observações (opcional)</span>
          <textarea
            className="textarea"
            rows={3}
            value={form.notes}
            onChange={handleChange("notes")}
            placeholder="Ex: conferido com o turno anterior, troco separado..."
          />
        </label>

        <div className="cash-modal-footer">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
          >
            Confirmar abertura
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OpenCashSessionModal;
