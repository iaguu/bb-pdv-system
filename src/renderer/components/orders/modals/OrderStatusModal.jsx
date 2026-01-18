import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Modal from "../../common/Modal";
import { OrderIcon } from "../OrderIcons";

const ORDER_STATUSES = [
  { id: "open", label: "Em Aberto", icon: "clock" },
  { id: "preparing", label: "Em Preparo", icon: "cook" },
  { id: "ready", label: "Pronto", icon: "box" },
  { id: "out_for_delivery", label: "Saiu para Entrega", icon: "truck" },
  { id: "done", label: "Finalizado", icon: "check" },
  { id: "cancelled", label: "Cancelado", icon: "ban" },
];

export default function OrderStatusModal({
  isOpen,
  onClose,
  status,
  onStatusChange,
}) {
  const [selectedStatus, setSelectedStatus] = useState(status || "open");

  const currentStatusLabel = ORDER_STATUSES.find(s => s.id == selectedStatus)?.label || "Em Aberto";
  const [observations, setObservations] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedStatus(status || "open");
    setObservations("");
    setIsScheduled(false);
    setScheduledDate("");
    setScheduledTime("");
  }, [isOpen, status]);

  const handleStatusSelect = (statusId) => {
    setSelectedStatus(statusId);
  };

  const handleConfirm = () => {
    onStatusChange({
      status: selectedStatus,
      observations,
      isScheduled,
      scheduledDate,
      scheduledTime,
    });
    onClose();
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    return {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
    };
  };

  const { date: currentDate, time: currentTime } = getCurrentDateTime();

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="orderform-modal" size="md">
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">Status do Pedido</div>
          <div className="modal-title">Gerenciar Status</div>
          <div className="modal-badge-row">
            <span className="modal-badge modal-badge--accent">Atual: {currentStatusLabel}</span>
          </div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <OrderIcon name="close" />
        </button>
      </div>

      <motion.div className="modal-body" {...bodyMotion}>
        {/* Status Selection */}
        <div className="modal-section">
          <div className="modal-section-title">Novo Status<span className="hint-dot" data-tooltip="Escolha o status atual do pedido.">?</span></div>
          <div className="status-grid">
            {ORDER_STATUSES.map(statusItem => (
              <button
                key={statusItem.id}
                type="button"
                className={`status-option ${
                  selectedStatus === statusItem.id ? "status-option-active" : ""
                }`}
                onClick={() => handleStatusSelect(statusItem.id)}
              >
                <div className="status-option-icon">
                  <OrderIcon name={statusItem.icon} />
                </div>
                <div className="status-option-label">{statusItem.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Status Timeline */}
        <div className="modal-section">
          <div className="modal-section-title">Timeline do Pedido<span className="hint-dot" data-tooltip="Marcos estimados da operacao.">?</span></div>
          <div className="status-timeline">
            <div className="timeline-item completed">
              <div className="timeline-dot completed"></div>
              <div className="timeline-content">
                <div className="timeline-title">Pedido Iniciado</div>
                <div className="timeline-time">{currentDate} {currentTime}</div>
              </div>
            </div>
            
            <div className={`timeline-item ${selectedStatus === "preparing" ? "active" : ""}`}>
              <div className={`timeline-dot ${selectedStatus === "preparing" ? "active" : ""}`}></div>
              <div className="timeline-content">
                <div className="timeline-title">Producao / Cozinha</div>
                <div className="timeline-time">
                  {selectedStatus === "preparing" ? `${currentDate} ${currentTime}` : "Aguardando"}
                </div>
              </div>
            </div>
            
            <div className={`timeline-item ${selectedStatus === "ready" ? "active" : ""}`}>
              <div className={`timeline-dot ${selectedStatus === "ready" ? "active" : ""}`}></div>
              <div className="timeline-content">
                <div className="timeline-title">Pronto / Retirar</div>
                <div className="timeline-time">
                  {selectedStatus === "ready" ? `${currentDate} ${currentTime}` : "Aguardando"}
                </div>
              </div>
            </div>
            
            <div className={`timeline-item ${selectedStatus === "out_for_delivery" ? "active" : ""}`}>
              <div className={`timeline-dot ${selectedStatus === "out_for_delivery" ? "active" : ""}`}></div>
              <div className="timeline-content">
                <div className="timeline-title">Saiu p/ Entrega</div>
                <div className="timeline-time">
                  {selectedStatus === "out_for_delivery" ? `${currentDate} ${currentTime}` : "Aguardando"}
                </div>
              </div>
            </div>
            
            <div className={`timeline-item ${selectedStatus === "done" ? "active" : ""}`}>
              <div className={`timeline-dot ${selectedStatus === "done" ? "active" : ""}`}></div>
              <div className="timeline-content">
                <div className="timeline-title">Pedido Finalizado</div>
                <div className="timeline-time">
                  {selectedStatus === "done" ? `${currentDate} ${currentTime}` : "Aguardando"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Observations */}
        <div className="modal-section">
          <div className="modal-section-title">Observacoes</div>
          <textarea
            className="field-input"
            rows={3}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Adicione observacoes sobre a mudanca de status..."
          />
        </div>

        {/* Scheduling */}
        <div className="modal-section">
          <div className="modal-section-title">Agendamento<span className="hint-dot" data-tooltip="Defina data e hora para pedidos futuros.">?</span></div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
            />
            <span>Pedido Agendado</span>
          </label>
          
          {isScheduled && (
            <div className="schedule-grid">
              <label className="field">
                <span className="field-label">Data</span>
                <input
                  type="date"
                  className="field-input"
                  value={scheduledDate || currentDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={currentDate}
                />
              </label>
              <label className="field">
                <span className="field-label">Hora</span>
                <input
                  type="time"
                  className="field-input"
                  value={scheduledTime || currentTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </motion.div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirm}
        >
          Confirmar Mudanca
        </button>
      </div>
    </Modal>
  );
}

