import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";

const MotoboyFormModal = ({ isOpen, onClose, motoboy, onSave }) => {
  const [form, setForm] = useState({
    id: null,
    name: "",
    phone: "",
    document: "",
    active: true,
  });

  useEffect(() => {
    if (!motoboy) {
      setForm({
        id: null,
        name: "",
        phone: "",
        document: "",
        active: true,
      });
      return;
    }
    setForm({
      id: motoboy.id || null,
      name: motoboy.name || "",
      phone: motoboy.phone || "",
      document: motoboy.document || "",
      active: motoboy.active ? true : false,
    });
  }, [motoboy]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave &&
      onSave({
        ...form,
      });
  };

  const canSave = form.name.trim().length > 2;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={form.id ? "Editar motoboy" : "Novo motoboy"}
      className="motoboy-form-modal"
    >
      <div className="form-section">
        <div className="form-grid">
          <div className="form-field form-field--wide">
            <label>Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div className="form-field">
            <label>Telefone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="(11) 90000-0000"
            />
          </div>
        </div>

        <div className="form-field">
          <label>Documento</label>
          <input
            type="text"
            value={form.document}
            onChange={(e) => handleChange("document", e.target.value)}
            placeholder="CPF / CNH / outro"
          />
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => handleChange("active", e.target.checked)}
          />
          <span className="switch__track">
            <span className="switch__thumb" />
          </span>
          <span className="switch__label">Ativo para receber entregas</span>
        </label>
      </div>

      <div className="modal-footer">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!canSave}>
          Salvar
        </Button>
      </div>
    </Modal>
  );
};

export default MotoboyFormModal;
