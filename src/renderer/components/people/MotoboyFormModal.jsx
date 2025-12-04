// src/renderer/components/people/MotoboyFormModal.jsx
import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";

const VEHICLE_OPTIONS = [
  { value: "moto", label: "Moto" },
  { value: "carro", label: "Carro" },
  { value: "bike", label: "Bicicleta" },
  { value: "a_pe", label: "A pé" },
];

function digitsOnly(s) {
  return (s || "").replace(/\D/g, "");
}

function parseCurrencyToNumber(raw) {
  if (!raw) return 0;
  const onlyDigits = raw.replace(/[^\d,-]/g, "").replace(".", "").replace(",", ".");
  const n = Number(onlyDigits);
  return Number.isNaN(n) ? 0 : n;
}

function formatCurrencyInput(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MotoboyFormModal = ({ initialData, onClose, onSaved }) => {
  const isEdit = Boolean(initialData && initialData.id);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("moto");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [baseNeighborhood, setBaseNeighborhood] = useState("");
  const [baseFeeRaw, setBaseFeeRaw] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Carrega dados iniciais
  useEffect(() => {
    if (!initialData) return;

    setName(initialData.name || "");
    setPhone(initialData.phone || "");
    setVehicleType(initialData.vehicleType || "moto");
    setVehiclePlate(initialData.vehiclePlate || "");
    setBaseNeighborhood(initialData.baseNeighborhood || "");
    setBaseFeeRaw(
      initialData.baseFee != null
        ? formatCurrencyInput(initialData.baseFee)
        : ""
    );
    setIsActive(initialData.isActive !== false);
    setNotes(initialData.notes || "");
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Informe o nome do motoboy.");
      return;
    }

    if (!phone.trim()) {
      setError("Informe um telefone para contato.");
      return;
    }

    const payload = {
      ...(initialData || {}),
      name: name.trim(),
      phone: phone.trim(),
      vehicleType,
      vehiclePlate: vehiclePlate.trim().toUpperCase(),
      baseNeighborhood: baseNeighborhood.trim(),
      baseFee: parseCurrencyToNumber(baseFeeRaw),
      isActive,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    // se for novo, garante um id
    if (!payload.id) {
      payload.id = `motoboy-${Date.now()}`;
      payload.createdAt = new Date().toISOString();
      payload.totalDeliveries = payload.totalDeliveries || 0;
    }

    try {
      setSaving(true);

      if (window.dataEngine && window.dataEngine.updateItem) {
        await window.dataEngine.updateItem(
          "motoboys",
          payload.id,
          payload
        );
      } else if (window.dataEngine && window.dataEngine.createItem) {
        await window.dataEngine.createItem("motoboys", payload);
      } else {
        console.error(
          "dataEngine.updateItem/createItem não disponível."
        );
        throw new Error(
          "Não foi possível salvar o motoboy. API de dados indisponível."
        );
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar motoboy:", err);
      setError(
        err?.message || "Erro ao salvar motoboy. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePhoneChange = (value) => {
    // deixa livre, mas você pode simplificar para só dígitos se quiser
    setPhone(value);
  };

  const handleBaseFeeChange = (value) => {
    setBaseFeeRaw(value);
  };

  return (
    <Modal
      title={isEdit ? "Editar motoboy" : "Novo motoboy"}
      onClose={onClose}
      footer={
        <div className="modal-footer-actions">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="motoboy-form"
            disabled={saving}
          >
            {saving
              ? "Salvando..."
              : isEdit
              ? "Salvar alterações"
              : "Cadastrar motoboy"}
          </Button>
        </div>
      }
    >
      <form
        id="motoboy-form"
        className="motoboy-form"
        onSubmit={handleSubmit}
      >
        <div className="motoboy-form-grid">
          <div className="motoboy-form-col">
            <div className="field-label">Nome</div>
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo do motoboy"
            />

            <div className="field-label" style={{ marginTop: 10 }}>
              Telefone
            </div>
            <input
              className="field-input"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(11) 99999-9999"
            />
            <div className="field-helper">
              Use um telefone válido para contato rápido.
            </div>

            <div className="field-label" style={{ marginTop: 10 }}>
              Observações
            </div>
            <textarea
              className="field-input motoboy-notes-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: só trabalha sexta a domingo, prefere recebimento em dinheiro..."
            />
          </div>

          <div className="motoboy-form-col">
            <div className="field-label">Tipo de veículo</div>
            <select
              className="field-input"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
            >
              {VEHICLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="field-label" style={{ marginTop: 10 }}>
              Placa
            </div>
            <input
              className="field-input"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              placeholder="Ex: ABC1D23"
            />
            <div className="field-helper">
              Para bike/a pé, você pode deixar em branco.
            </div>

            <div className="field-label" style={{ marginTop: 10 }}>
              Bairro base
            </div>
            <input
              className="field-input"
              value={baseNeighborhood}
              onChange={(e) => setBaseNeighborhood(e.target.value)}
              placeholder="Ex: Chora Menino"
            />
            <div className="field-helper">
              Bairro principal onde ele costuma ficar.
            </div>

            <div className="field-label" style={{ marginTop: 10 }}>
              Taxa base por entrega (R$)
            </div>
            <input
              className="field-input"
              value={baseFeeRaw}
              onChange={(e) => handleBaseFeeChange(e.target.value)}
              placeholder="Ex: 6,00"
            />
            <div className="field-helper">
              Valor padrão por entrega. Você pode ajustar por pedido.
            </div>

            <div className="motoboy-active-row">
              <div className="field-label">Status</div>
              <button
                type="button"
                className={
                  "motoboy-active-toggle" +
                  (isActive ? " motoboy-active-toggle-on" : "")
                }
                onClick={() => setIsActive((prev) => !prev)}
              >
                <span className="motoboy-active-knob" />
                <span className="motoboy-active-label">
                  {isActive ? "Ativo" : "Pausado"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {error && <div className="motoboy-form-error">{error}</div>}
      </form>
    </Modal>
  );
};

export default MotoboyFormModal;
