import React, { useEffect, useRef, useState } from "react";
import Modal from "../common/Modal";
import ConfirmDialog from "../common/ConfirmDialog";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastCepLookupRef = useRef("");
  const autoCepTimerRef = useRef(null);

  useEffect(() => {
    setEditing(normalizeCustomer(customer));
    setCepLoading(false);
    setCepError("");
    lastCepLookupRef.current = "";
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

  const runCepLookup = async ({ auto = false } = {}) => {
    try {
      if (!editing) return;
      const cepDigits = digitsOnly(editing.address.cep);
      if (cepDigits.length !== 8) {
        if (!auto) {
          setCepError("CEP deve ter 8 dígitos.");
        }
        return;
      }

      if (cepLoading) return;
      if (auto && cepDigits === lastCepLookupRef.current) return;

      setCepError("");
      setCepLoading(true);
      const addr = await lookupCep(cepDigits);
      setEditing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          address: {
            ...prev.address,
            cep: addr.cep || prev.address.cep,
            street: auto
              ? prev.address.street || addr.street
              : addr.street || prev.address.street,
            neighborhood: auto
              ? prev.address.neighborhood || addr.neighborhood
              : addr.neighborhood || prev.address.neighborhood,
            city: addr.city || prev.address.city,
            state: addr.state || prev.address.state,
          },
        };
      });
      lastCepLookupRef.current = cepDigits;
    } catch (err) {
      setCepError(err.message || "Não foi possível buscar o CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepSearch = () => runCepLookup();

  useEffect(() => {
    if (!editing) return;
    const cepDigits = digitsOnly(editing.address.cep);
    if (cepDigits.length !== 8) {
      if (autoCepTimerRef.current) {
        clearTimeout(autoCepTimerRef.current);
      }
      return;
    }

    if (cepDigits === lastCepLookupRef.current) return;

    if (autoCepTimerRef.current) {
      clearTimeout(autoCepTimerRef.current);
    }
    autoCepTimerRef.current = setTimeout(() => {
      runCepLookup({ auto: true });
    }, 600);

    return () => {
      if (autoCepTimerRef.current) {
        clearTimeout(autoCepTimerRef.current);
      }
    };
  }, [editing?.address?.cep]);
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
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete(editing.id);
  };

  const formId = "client-details-form";

  return (
    <>
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

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Excluir cliente"
        message={`Excluir o cliente "${editing.name}"?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
