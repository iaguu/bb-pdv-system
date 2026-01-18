import React, { useEffect, useRef, useState } from "react";
import Modal from "../common/Modal";
import { digitsOnly, lookupCep } from "./utils";
import { emitToast } from "../../utils/toast";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastCepLookupRef = useRef("");
  const autoCepTimerRef = useRef(null);

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
      lastCepLookupRef.current = "";
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const validateForm = () => {
    const errors = [];
    
    if (!form.name.trim()) {
      errors.push("Nome é obrigatório");
    }
    
    if (!form.phone.trim()) {
      errors.push("Telefone é obrigatório");
    }
    
    if (form.cpf && form.cpf.length !== 11 && form.cpf.length !== 14) {
      errors.push("CPF inválido");
    }
    
    if (form.cep && form.cep.replace(/\D/g, "").length !== 8) {
      errors.push("CEP deve ter 8 dígitos");
    }
    
    return errors;
  };

  const runCepLookup = async ({ auto = false } = {}) => {
    try {
      const cepDigits = digitsOnly(form.cep);
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
      setForm((f) => ({
        ...f,
        cep: addr.cep,
        street: auto ? f.street || addr.street : addr.street || f.street,
        neighborhood: auto
          ? f.neighborhood || addr.neighborhood
          : addr.neighborhood || f.neighborhood,
        city: addr.city,
        state: addr.state,
      }));
      lastCepLookupRef.current = cepDigits;
      
      if (auto && addr.street) {
        emitToast({
          type: "success",
          message: "Endereço encontrado automaticamente!",
        });
      }
    } catch (err) {
      setCepError(err.message || "Não foi possível buscar o CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepSearch = () => runCepLookup();

  useEffect(() => {
    if (!isOpen) return;
    const cepDigits = digitsOnly(form.cep);
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
    }, 800);

    return () => {
      if (autoCepTimerRef.current) {
        clearTimeout(autoCepTimerRef.current);
      }
    };
  }, [form.cep, isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      emitToast({
        type: "error",
        message: errors[0],
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const nm = form.name.trim();
      if (!nm) {
        emitToast({
          type: "warning",
          message: "Informe o nome do cliente.",
        });
        return;
      }

      const clientData = {
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
      };

      await onConfirm(clientData);
      
      emitToast({
        type: "success",
        message: "Cliente cadastrado com sucesso!",
      });
      
      onClose();
    } catch (error) {
      console.error("Erro ao cadastrar cliente:", error);
      emitToast({
        type: "error",
        message: "Erro ao cadastrar cliente. Tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formId = "new-client-form";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="👤 Novo Cliente"
      className="modal-client modal-client-enhanced"
      bodyClassName="modal-form-enhanced"
      footer={
        <div className="modal-footer-actions">
          <button
            type="button"
            className="btn btn-outline btn-enhanced"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ❌ Cancelar
          </button>
          
          <button type="submit" form={formId} className="btn btn-primary btn-enhanced" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="btn-spinner"></span>
                Cadastrando...
              </>
            ) : (
              <>
                ✅ Cadastrar Cliente
              </>
            )}
          </button>
        </div>
      }
    >
      <form id={formId} className="modal-form form-enhanced" onSubmit={submit}>
        {/* DADOS PRINCIPAIS */}
        <div className="modal-section">
          <div className="modal-section-header">
            <span className="section-icon">👤</span>
            <h3 className="modal-section-title">Dados Principais</h3>
          </div>

          <div className="modal-field-group">
            <div className="modal-field">
              <label className="field-label field-label-enhanced">
                <span className="field-icon">👤</span>
                Nome Completo
                <span className="field-required">*</span>
              </label>
              <input
                className="field-input field-input-enhanced"
                placeholder="Ex: Iago Ferreira"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="modal-field-row">
              <div className="modal-field">
                <label className="field-label field-label-enhanced">
                  <span className="field-icon">📱</span>
                  Telefone
                  <span className="field-required">*</span>
                </label>
                <input
                  className="field-input field-input-enhanced"
                  placeholder="Ex: (11) 99999-0000"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  required
                />
              </div>

              <div className="modal-field">
                <label className="field-label field-label-enhanced">
                  <span className="field-icon">🆔</span>
                  CPF
                </label>
                <input
                  className="field-input field-input-enhanced"
                  placeholder="Ex: 123.456.789-00"
                  value={form.cpf}
                  onChange={(e) => update("cpf", e.target.value)}
                  maxLength={14}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ENDEREÇO */}
        <div className="modal-section">
          <div className="modal-section-header">
            <span className="section-icon">📍</span>
            <h3 className="modal-section-title">Endereço</h3>
          </div>

          <div className="modal-field-group">
            <div className="modal-field cep-field">
              <label className="field-label field-label-enhanced">
                <span className="field-icon">📮</span>
                CEP
              </label>
              <div className="cep-input-wrapper">
                <input
                  className="field-input field-input-enhanced"
                  placeholder="Ex: 01001-000"
                  value={form.cep}
                  onChange={(e) => update("cep", e.target.value)}
                  maxLength={9}
                />
                <button
                  type="button"
                  className="cep-search-btn"
                  onClick={handleCepSearch}
                  disabled={cepLoading}
                  title="Buscar CEP"
                >
                  {cepLoading ? (
                    <span className="cep-spinner"></span>
                  ) : (
                    "🔍"
                  )}
                </button>
              </div>
              {cepError && <div className="field-error field-error-enhanced">{cepError}</div>}
            </div>

            <div className="modal-field-row address-row">
              <div className="modal-field">
                <label className="field-label field-label-enhanced">
                  <span className="field-icon">🏠</span>
                  Rua
                </label>
                <input
                  className="field-input field-input-enhanced"
                  placeholder="Ex: Rua das Flores"
                  value={form.street}
                  onChange={(e) => update("street", e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="field-label field-label-enhanced">
                  <span className="field-icon">🏢</span>
                  Número
                </label>
                <input
                  className="field-input field-input-enhanced"
                  placeholder="Ex: 123"
                  value={form.number}
                  onChange={(e) => update("number", e.target.value)}
                />
              </div>
            </div>

            <div className="modal-field-row">
              <div className="modal-field">
                <label className="field-label field-label-enhanced">
                  <span className="field-icon">📝</span>
                  Complemento
                </label>
                <input
                  className="field-input field-input-enhanced"
                  placeholder="Ex: Apto 101"
                  value={form.complement}
                  onChange={(e) => update("complement", e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="field-label field-label-enhanced">
                  <span className="field-icon">🏘</span>
                  Bairro
                </label>
                <input
                  className="field-input field-input-enhanced"
                  placeholder="Ex: Centro"
                  value={form.neighborhood}
                  onChange={(e) => update("neighborhood", e.target.value)}
                />
              </div>
            </div>

            <div className="modal-field-row">
              <div className="modal-field">
                <label className="field-label field-label-enhanced">
                  <span className="field-icon">🏙️</span>
                  Cidade
                </label>
                <input
                  className="field-input field-input-enhanced"
                  placeholder="Ex: São Paulo"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="field-label field-label-enhanced">
                  <span className="field-icon">🗺️</span>
                  UF
                </label>
                <input
                  className="field-input field-input-enhanced uf-input"
                  placeholder="Ex: SP"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  maxLength={2}
                />
              </div>
            </div>
          </div>
        </div>

        {/* OBSERVAÇÕES */}
        <div className="modal-section">
          <div className="modal-section-header">
            <span className="section-icon">📋</span>
            <h3 className="modal-section-title">Observações</h3>
          </div>
          <div className="modal-field">
            <label className="field-label field-label-enhanced">
              <span className="field-icon">💬</span>
              Observações (opcional)
            </label>
            <textarea
              className="field-textarea field-textarea-enhanced"
              rows={3}
              placeholder="Informações adicionais sobre o cliente..."
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
