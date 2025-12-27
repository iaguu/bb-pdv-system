import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import { digitsOnly, lookupCep, normalizeCustomer } from "./utils";
import { emitToast } from "../../utils/toast";

export default function ClientDetailsModal({
  customer,
  onClose,
  onSave,
  onDelete,
}) {
  const [editing, setEditing] = useState(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  useEffect(() => {
    setEditing(normalizeCustomer(customer));
    setCepLoading(false);
    setCepError("");
  }, [customer]);

  if (!customer || !editing) return null;

  const update = (field, value) => {
    setEditing((prev) => ({ ...prev, [field]: value }));
  };

  const updateAddr = (field, value) => {
    setEditing((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  };

  const handleCepSearch = async () => {
    try {
      setCepError("");
      setCepLoading(true);
      const addr = await lookupCep(editing.address.cep);
      setEditing((prev) => ({
        ...prev,
        address: { ...prev.address, ...addr },
      }));
    } catch (err) {
      setCepError(err.message);
    } finally {
      setCepLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const nm = editing.name.trim();
    if (!nm) {
      emitToast({
        type: "warning",
        message: "Informe o nome do cliente.",
      });
      return;
    }
    onSave({ ...editing, name: nm });
  };

  const triggerDelete = () => {
    if (!window.confirm(`Excluir o cliente "${editing.name}"?`)) return;
    onDelete(editing.id);
  };

  const formId = "client-details-form";

  return (
    <Modal
      isOpen={Boolean(customer)}
      onClose={onClose}
      title={`Cliente: ${editing.name}`}
      className="modal-client"
      bodyClassName="modal-form"
      footer={
        <div className="modal-footer-actions modal-footer-actions--split">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            Voltar
          </button>

          <div className="modal-footer-actions">
            <button
              type="button"
              className="btn btn-outline btn-danger-soft"
              onClick={triggerDelete}
            >
              Excluir
            </button>
            <button type="submit" className="btn btn-primary" form={formId}>
              Salvar alterações
            </button>
          </div>
        </div>
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
              value={editing.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="modal-grid modal-grid-2-main">
            <div>
              <div className="field-label">Telefone</div>
              <input
                className="field-input"
                value={editing.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>

            <div>
              <div className="field-label">CPF</div>
              <input
                className="field-input"
                value={editing.cpf}
                onChange={(e) => update("cpf", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ENDEREÇO */}
        <div className="modal-section">
          <div className="modal-section-title">Endereço</div>

          {/* CEP + botão */}
          <div className="modal-grid modal-grid-cep">
            <div>
              <div className="field-label">CEP</div>
              <input
                className="field-input"
                value={editing.address.cep}
                onChange={(e) => updateAddr("cep", e.target.value)}
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

          {/* Rua + número */}
          <div className="modal-grid modal-grid-street">
            <div>
              <div className="field-label">Rua</div>
              <input
                className="field-input"
                value={editing.address.street}
                onChange={(e) => updateAddr("street", e.target.value)}
              />
            </div>
            <div>
              <div className="field-label">Número</div>
              <input
                className="field-input"
                value={editing.address.number}
                onChange={(e) => updateAddr("number", e.target.value)}
              />
            </div>
          </div>

          {/* Complemento + bairro */}
          <div className="modal-grid modal-grid-complement">
            <div>
              <div className="field-label">Complemento</div>
              <input
                className="field-input"
                value={editing.address.complement}
                onChange={(e) => updateAddr("complement", e.target.value)}
              />
            </div>
            <div>
              <div className="field-label">Bairro</div>
              <input
                className="field-input"
                value={editing.address.neighborhood}
                onChange={(e) => updateAddr("neighborhood", e.target.value)}
              />
            </div>
          </div>

          {/* Cidade + UF */}
          <div className="modal-grid modal-grid-city">
            <div>
              <div className="field-label">Cidade</div>
              <input
                className="field-input"
                value={editing.address.city}
                onChange={(e) => updateAddr("city", e.target.value)}
              />
            </div>
            <div>
              <div className="field-label">UF</div>
              <input
                className="field-input"
                value={editing.address.state}
                onChange={(e) => updateAddr("state", e.target.value)}
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
            value={editing.notes || ""}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>

        {/* METADADOS */}
        {editing.createdAt && (
          <div className="modal-section">
            <div className="modal-section-title">Metadados</div>
            <div className="modal-meta">
              <span>
                <strong>Cadastrado em:</strong> {editing.createdAt}
              </span>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
