import React, { useEffect, useMemo, useState } from "react";
import Modal from "../common/Modal";
import { formatCurrencyBR } from "../../utils/orderUtils";

const MotoboyTipModal = ({ motoboy, onClose, onSave }) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!motoboy) return;
    setAmount("");
    setNote("");
    setDate("");
  }, [motoboy]);

  const tips = Array.isArray(motoboy.tips)  motoboy.tips : [];
  const tipsTotal =
    typeof motoboy.tipsTotal === "number"
       motoboy.tipsTotal
      : tips.reduce((sum, tip) => sum + (Number(tip.amount) || 0), 0);

  const parsedAmount = useMemo(() => {
    const value = Number(String(amount).replace(",", "."));
    return Number.isNaN(value)  0 : value;
  }, [amount]);

  const canSave = parsedAmount > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    const at = date  new Date(date).toISOString() : new Date().toISOString();
    onSave.(motoboy.id, {
      amount: parsedAmount,
      note: note.trim(),
      at,
    });
  };

  return (
    <Modal
      isOpen={Boolean(motoboy)}
      onClose={onClose}
      title="Registrar gorjeta"
      subtitle="Controle rápido de valores recebidos pelo entregador."
      className="motoboy-tip-modal"
      footer={
        <div className="motoboy-tip-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!canSave}
          >
            Salvar gorjeta
          </button>
        </div>
      }
    >
      <div className="motoboy-tip">
        <div className="motoboy-tip-header">
          <div>
            <div className="motoboy-tip-name">
              {motoboy.name || "Motoboy"}
            </div>
            <div className="motoboy-tip-total">
              Total acumulado: {formatCurrencyBR(tipsTotal)}
            </div>
          </div>
          <div className="motoboy-tip-count">
            {tips.length} registro(s)
          </div>
        </div>

        <div className="motoboy-tip-form">
          <label className="motoboy-tip-field">
            <span>Valor da gorjeta</span>
            <input
              type="text"
              placeholder="Ex: 8,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="motoboy-tip-field">
            <span>Data (opcional)</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="motoboy-tip-field motoboy-tip-field--wide">
            <span>Observação (opcional)</span>
            <input
              type="text"
              placeholder="Ex: corrida extra, chuva..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        {tips.length > 0 && (
          <div className="motoboy-tip-history">
            <div className="motoboy-tip-history-title">
              Últimas gorjetas
            </div>
            <div className="motoboy-tip-history-list">
              {tips.slice(0, 5).map((tip) => (
                <div key={tip.id} className="motoboy-tip-history-item">
                  <div>
                    <strong>{formatCurrencyBR(tip.amount || 0)}</strong>
                    {tip.note  (
                      <span className="motoboy-tip-history-note">
                        {tip.note}
                      </span>
                    ) : null}
                  </div>
                  <span className="motoboy-tip-history-date">
                    {tip.at
                       new Date(tip.at).toLocaleDateString("pt-BR")
                      : "--"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </Modal>
  );
};

export default MotoboyTipModal;
