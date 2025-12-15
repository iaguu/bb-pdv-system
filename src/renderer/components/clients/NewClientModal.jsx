import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import { digitsOnly, lookupCep } from "./utils";

export default function NewClientModal({ isOpen, onClose, onConfirm }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    cpf: "",
    notes: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: "",
        phone: "",
        cpf: "",
        notes: "",
        cep: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      });
      setCepLoading(false);
      setCepError("");
    }
  }, [isOpen]);

  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleCepSearch = async () => {
    try {
      setCepError("");
      setCepLoading(true);
      const addr = await lookupCep(form.cep);
      setForm((f) => ({
        ...f,
        cep: addr.cep,
        street: addr.street,
        neighborhood: addr.neighborhood,
        city: addr.city,
        state: addr.state,
      }));
    } catch (err) {
      setCepError(err.message || "Não foi possível buscar o CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const nm = form.name.trim();
    if (!nm) return alert("Informe o nome do cliente.");

    onConfirm({
      name: nm,
      phone: form.phone.trim(),
      cpf: form.cpf.trim(),
      notes: form.notes.trim(),
      address: {
        cep: form.cep.trim(),
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim(),
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
      },
    });
  };

  if (!isOpen) return null;

  const formId = "new-client-form";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo cliente"
      className="modal-client"
      bodyClassName="modal-form"
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            Voltar
          </button>

          <button type="submit" className="btn btn-primary" form={formId}>
            Cadastrar
          </button>
        </>
      }
    >
      <form id={formId} className="modal-form" onSubmit={submit}>
        {/* DADOS PRINCIPAIS */}
        <div className="modal-section">
          <div className="modal-section-title">Dados principais</div>

          <div className="modal-field-block">
            <div className="field-label">Nome completo *</div>
            <input
              className="field-input"
              placeholder="Ex: Iago Ferreira"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoFocus
            />
          </div>

          <div className="modal-grid modal-grid-2-main">
            <div>
              <div className="field-label">Telefone</div>
              <input
                className="field-input"
                placeholder="Ex: (11) 99999-0000"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>

            <div>
              <div className="field-label">CPF</div>
              <input
                className="field-input"
                placeholder="Ex: 123.456.789-00"
                value={form.cpf}
                onChange={(e) => update("cpf", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ENDEREÇO */}
        <div className="modal-section">
          <div className="modal-section-title">Endereço</div>

          <div className="modal-grid modal-grid-cep">
            <div>
              <div className="field-label">CEP</div>
              <input
                className="field-input"
                placeholder="Ex: 01001-000"
                value={form.cep}
                onChange={(e) => update("cep", e.target.value)}
              />
            </div>

            <div className="modal-cep-button-wrapper">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCepSearch}
                disabled={cepLoading}
              >
                {cepLoading ? "Buscando..." : "Buscar CEP"}
              </button>
            </div>
          </div>

          {cepError && <div className="field-error">{cepError}</div>}

          <div className="modal-grid modal-grid-street">
            <div>
              <div className="field-label">Rua</div>
              <input
                className="field-input"
                value={form.street}
                onChange={(e) => update("street", e.target.value)}
              />
            </div>

            <div>
              <div className="field-label">Número</div>
              <input
                className="field-input"
                value={form.number}
                onChange={(e) => update("number", e.target.value)}
                placeholder="Ex: 123"
              />
            </div>
          </div>

          <div className="modal-grid modal-grid-complement">
            <div>
              <div className="field-label">Complemento</div>
              <input
                className="field-input"
                value={form.complement}
                onChange={(e) => update("complement", e.target.value)}
              />
            </div>

            <div>
              <div className="field-label">Bairro</div>
              <input
                className="field-input"
                value={form.neighborhood}
                onChange={(e) => update("neighborhood", e.target.value)}
              />
            </div>
          </div>

          <div className="modal-grid modal-grid-city">
            <div>
              <div className="field-label">Cidade</div>
              <input
                className="field-input"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>

            <div>
              <div className="field-label">UF</div>
              <input
                className="field-input"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                maxLength={2}
              />
            </div>
          </div>
        </div>

        {/* OBSERVAÇÕES */}
        <div className="modal-section">
          <div className="modal-section-title">Observações</div>
          <textarea
            className="field-textarea"
            rows={2}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
