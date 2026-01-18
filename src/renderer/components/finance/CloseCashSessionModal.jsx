// src/renderer/components/finance/CloseCashSessionModal.jsx
import React from "react";
import Modal from "../common/Modal";

const formatCurrency = (value) =>
  (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/**
 * Modal de fechamento de sessão de caixa
 *
 * Props:
 * - open / isOpen: boolean
 * - onClose: () => void
 * - hasOpenSession: boolean
 * - openingAmount: number ? (valor de abertura da sessão atual)
 * - orderCount: number ? (qtd de pedidos no período)
 * - paidTotal: number ? (total recebido em todos os meios)
 * - cashPaid: number ? (total recebido em dinheiro)
 * - expectedCashInDrawer: number (abertura + dinheiro de pedidos pagos)
 * - closingDifference: number ? (valor contado - expectedCashInDrawer)
 * - closeForm: { countedAmount, notes }
 * - onChangeField: (field: "countedAmount" | "notes", value: string) => void
 * - onConfirm: () => void
 */
const CloseCashSessionModal = ({
  open,
  isOpen,
  onClose,
  hasOpenSession,
  openingAmount,
  orderCount,
  paidTotal,
  cashPaid,
  expectedCashInDrawer,
  closingDifference,
  closeForm,
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
      title="Fechar sessão de caixa"
    >
      <div className="cash-modal">
        {hasOpenSession ? (
          <>
            <p className="cash-modal-description">
              Confira os valores do dia, conte o dinheiro em caixa e
              registre o fechamento.
            </p>

            <div className="cash-summary-grid">
              <div className="cash-summary-card">
                <span className="label">Abertura</span>
                <strong>{formatCurrency(openingAmount)}</strong>
              </div>

              <div className="cash-summary-card">
                <span className="label">Pedidos pagos</span>
                <strong>{formatCurrency(paidTotal)}</strong>
                <small>{orderCount} pedidos</small>
              </div>

              <div className="cash-summary-card">
                <span className="label">
                  Esperado em dinheiro (abertura + dinheiro pagos)
                </span>
                <strong>
                  {formatCurrency(expectedCashInDrawer)}
                </strong>
                <small>
                  Dinheiro em pedidos pagos:{" "}
                  {formatCurrency(cashPaid)}
                </small>
              </div>
            </div>

            <label className="field">
              <span className="field-label">
                Valor contado em dinheiro
              </span>
              <input
                className="input"
                value={closeForm.countedAmount}
                onChange={handleChange("countedAmount")}
                placeholder="Ex: 540,00"
              />
            </label>

            <div className="cash-diff-row">
              <span className="label">Diferença do caixa</span>
              <strong
                className={
                  closingDifference === 0
                    ? "cash-diff-zero"
                    : closingDifference > 0
                    ? "cash-diff-positive"
                    : "cash-diff-negative"
                }
              >
                {formatCurrency(closingDifference)}
              </strong>
            </div>

            <label className="field">
              <span className="field-label">
                Observações do fechamento (opcional)
              </span>
              <textarea
                className="textarea"
                rows={3}
                value={closeForm.notes}
                onChange={handleChange("notes")}
                placeholder="Ex: diferença por troco, sangria durante o turno, etc."
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
                className="btn btn-danger"
                onClick={onConfirm}
              >
                Confirmar fechamento
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="cash-modal-description">
              Não há sessão aberta para fechar.
            </p>
            <div className="cash-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
              >
                Voltar
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default CloseCashSessionModal;
