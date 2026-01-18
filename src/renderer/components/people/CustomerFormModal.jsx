// src/renderer/components/people/CustomerFormModal.jsx
import React, { useEffect, useRef, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";

const digitsOnly = (s) => (s || "").replace(/\D/g, "");

const normalizeNeighborhoodKey = (value) => {
  if (!value) return "";
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

const findBlockedNeighborhood = (neighborhood, blockedList) => {
  if (!neighborhood || !Array.isArray(blockedList)) return null;
  const key = normalizeNeighborhoodKey(neighborhood);
  if (!key) return null;
  return (
    blockedList.find(
      (item) => normalizeNeighborhoodKey(item) === key
    ) || null
  );
};

const normalizeSettingsData = (data) => {
  if (!data) return null;
  if (Array.isArray(data.items) && data.items.length > 0) {
    return data.items[0];
  }
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }
  if (typeof data === "object") {
    return data;
  }
  return null;
};

async function lookupCep(cepRaw) {
  const cep = digitsOnly(cepRaw);
  if (cep.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos.");
  }

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) {
    throw new Error("Erro ao consultar CEP.");
  }
  const data = await res.json();
  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }
  return data;
}

const CustomerFormModal = ({ initialData, customer, onClose, onSaved }) => {
  // compat: aceita initialData OU customer
  const editingData = initialData || customer || null;

  const displayName = editingData
    ? editingData.name.trim() || "Cliente sem nome"
    : "Novo cliente";

  const [form, setForm] = useState(() => ({
    id: editingData.id || undefined,
    name: editingData.name || "",
    phone: editingData.phone || "",
    cpf: editingData.cpf || "",
    notes: editingData.notes || "",
    deliveryMinMinutes:
      typeof editingData.deliveryMinMinutes === "number"
        ? editingData.deliveryMinMinutes
        : null,
    deliveryMetrics: editingData.deliveryMetrics || null,
    deliveryFee:
      typeof editingData.deliveryFee === "number"
        ? String(editingData.deliveryFee)
        : "",
    address: {
      cep: editingData.address.cep || "",
      street: editingData.address.street || "",
      number: editingData.address.number || "",
      neighborhood: editingData.address.neighborhood || "",
      city:
        editingData.address.city ||
        editingData.address.cidade ||
        "",
      state:
        editingData.address.state ||
        editingData.address.uf ||
        "",
      complement: editingData.address.complement || "",
      reference: editingData.address.reference || "",
    },
  }));

  const [blockedNeighborhoods, setBlockedNeighborhoods] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [cepStatus, setCepStatus] = useState("idle"); // idle | loading | ok | error
  const [cepMessage, setCepMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastCepLookupRef = useRef("");
  const autoCepTimerRef = useRef(null);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const cepRef = useRef(null);
  const streetRef = useRef(null);
  const numberRef = useRef(null);
  const neighborhoodRef = useRef(null);
  const cityRef = useRef(null);
  const stateRef = useRef(null);
  const customerInitial =
    form.name.trim().charAt(0).toUpperCase() || displayName.charAt(0);

  // se o cliente mudar (editar outro), atualiza o form
  useEffect(() => {
    if (!editingData) {
      setFormErrors({});
      setFormErrorMessage("");
      setCepStatus("idle");
      setCepMessage("");
      lastCepLookupRef.current = "";
      return;
    }
    setForm({
      id: editingData.id || undefined,
      name: editingData.name || "",
      phone: editingData.phone || "",
      cpf: editingData.cpf || "",
      notes: editingData.notes || "",
      deliveryMinMinutes:
        typeof editingData.deliveryMinMinutes === "number"
          ? editingData.deliveryMinMinutes
          : null,
      deliveryMetrics: editingData.deliveryMetrics || null,
      deliveryFee:
        typeof editingData.deliveryFee === "number"
          ? String(editingData.deliveryFee)
          : "",
      address: {
        cep: editingData.address.cep || "",
        street: editingData.address.street || "",
        number: editingData.address.number || "",
        neighborhood: editingData.address.neighborhood || "",
        city:
          editingData.address.city ||
          editingData.address.cidade ||
          "",
        state:
          editingData.address.state ||
          editingData.address.uf ||
          "",
        complement: editingData.address.complement || "",
        reference: editingData.address.reference || "",
      },
    });
    setFormErrors({});
    setFormErrorMessage("");
    setCepStatus("idle");
    setCepMessage("");
    lastCepLookupRef.current = "";
  }, [editingData]);

  useEffect(() => {
    let cancel = false;

    async function loadBlockedNeighborhoods() {
      if (!window.dataEngine.get) return;
      try {
        const settings = await window.dataEngine.get("settings");
        const item = normalizeSettingsData(settings);
        const list = item.delivery.blockedNeighborhoods;
        if (cancel) return;
        if (Array.isArray(list)) {
          setBlockedNeighborhoods(
            list.map((b) => (b || "").toString().trim()).filter(Boolean)
          );
        } else {
          setBlockedNeighborhoods([]);
        }
      } catch (err) {
        console.error("Erro ao carregar bairros bloqueados:", err);
      }
    }

    loadBlockedNeighborhoods();
    return () => {
      cancel = true;
    };
  }, []);

  const clearFieldError = (key) => {
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (formErrorMessage) {
      setFormErrorMessage("");
    }
  };

  const handleFieldChange = (field, value) => {
    clearFieldError(field);
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddressChange = (field, value) => {
    clearFieldError(`address.${field}`);
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value,
      },
    }));
  };

  const focusFirstError = (errors) => {
    if (!errors) return;
    const order = [
      "name",
      "phone",
      "address.cep",
      "address.street",
      "address.number",
      "address.neighborhood",
      "address.city",
      "address.state",
    ];
    const refMap = {
      name: nameRef,
      phone: phoneRef,
      "address.cep": cepRef,
      "address.street": streetRef,
      "address.number": numberRef,
      "address.neighborhood": neighborhoodRef,
      "address.city": cityRef,
      "address.state": stateRef,
    };
    const firstKey = order.find((key) => errors[key]);
    if (!firstKey) return;
    const ref = refMap[firstKey];
    if (ref && ref.current) {
      ref.current.focus();
    }
  };

  const runCepLookup = async ({ auto = false } = {}) => {
    try {
      const cepDigits = digitsOnly(form.address.cep);
      if (cepDigits.length !== 8) {
        if (!auto) {
          setCepStatus("error");
          setCepMessage("CEP deve ter 8 dígitos.");
        }
        return;
      }

      if (cepStatus === "loading") return;
      if (auto && cepDigits === lastCepLookupRef.current) return;

      setCepStatus("loading");
      setCepMessage("Buscando CEP...");
      const data = await lookupCep(cepDigits);

      setForm((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          cep: digitsOnly(prev.address.cep),
          street:
            auto && prev.address.street
               ? prev.address.street
              : data.logradouro || prev.address.street,
          neighborhood:
            auto && prev.address.neighborhood
               ? prev.address.neighborhood
              : data.bairro || prev.address.neighborhood,
          city: data.localidade || prev.address.city,
          state: data.uf || prev.address.state,
        },
      }));

      lastCepLookupRef.current = cepDigits;
      setCepStatus("ok");
      setCepMessage(
        auto
           ? "Cidade e estado atualizados pelo CEP."
          : "Endereço atualizado pelo CEP."
      );
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
      setCepStatus("error");
      setCepMessage(err.message || "Não foi possível buscar o CEP.");
    }
  };

  const handleCepSearch = () => runCepLookup();

  useEffect(() => {
    const cepDigits = digitsOnly(form.address.cep);
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
  }, [form.address.cep]);
  const handleSubmit = async (e) => {
    e.preventDefault();

    setFormErrors({});
    setFormErrorMessage("");

    const baseErrors = {};
    const phoneDigits = digitsOnly(form.phone);

    if (!form.name.trim()) {
      baseErrors.name = true;
    }
    if (!phoneDigits || phoneDigits.length < 10) {
      baseErrors.phone = true;
    }

    if (Object.keys(baseErrors).length > 0) {
      setFormErrors(baseErrors);
      setFormErrorMessage(
        "Informe nome e telefone válidos antes de salvar."
      );
      focusFirstError(baseErrors);
      return;
    }

    const addressErrors = {};
    const missingLabels = [];

    if (!form.address.cep.trim()) {
      addressErrors["address.cep"] = true;
      missingLabels.push("CEP");
    }
    if (!form.address.street.trim()) {
      addressErrors["address.street"] = true;
      missingLabels.push("Rua");
    }
    if (!form.address.number.trim()) {
      addressErrors["address.number"] = true;
      missingLabels.push("Número");
    }
    if (!form.address.neighborhood.trim()) {
      addressErrors["address.neighborhood"] = true;
      missingLabels.push("Bairro");
    }
    if (!form.address.city.trim()) {
      addressErrors["address.city"] = true;
      missingLabels.push("Cidade");
    }
    if (!form.address.state.trim()) {
      addressErrors["address.state"] = true;
      missingLabels.push("Estado");
    }

    if (missingLabels.length > 0) {
      setFormErrors(addressErrors);
      setFormErrorMessage(
        `Endereço incompleto. Faltam: ${missingLabels.join(", ")}.`
      );
      focusFirstError(addressErrors);
      return;
    }

    const blockedMatch = findBlockedNeighborhood(
      form.address.neighborhood,
      blockedNeighborhoods
    );
    if (blockedMatch) {
      setFormErrors({ "address.neighborhood": true });
      setFormErrorMessage(
        `Bairro bloqueado para entrega: ${blockedMatch}.`
      );
      focusFirstError({ "address.neighborhood": true });
      return;
    }

    const payload = {
      id: form.id,
      name: form.name.trim(),
      phone: digitsOnly(form.phone),
      cpf: digitsOnly(form.cpf),
      notes: form.notes.trim(),
      deliveryMinMinutes:
        typeof form.deliveryMinMinutes === "number"
          ? form.deliveryMinMinutes
          : null,
      deliveryMetrics: form.deliveryMetrics || null,
      deliveryFee: form.deliveryFee ? Number(form.deliveryFee) : null,
      address: {
        cep: digitsOnly(form.address.cep),
        street: form.address.street.trim(),
        number: form.address.number.trim(),
        neighborhood: form.address.neighborhood.trim(),
        city: form.address.city.trim(),
        state: form.address.state.trim(),
        complement: form.address.complement.trim(),
        reference: form.address.reference.trim(),
      },
      createdAt: editingData.createdAt || new Date().toISOString(),
    };

    if (editingData && editingData.id) {
      await window.dataEngine.updateItem("customers", editingData.id, payload);
    } else {
      await window.dataEngine.addItem("customers", payload);
    }

    if (onSaved) onSaved();
    onClose();
  };

  const handleDelete = () => {
    if (!editingData.id) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!editingData.id) return;
    setShowDeleteConfirm(false);
    await window.dataEngine.removeItem("customers", editingData.id);
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <>
      <Modal
        title={editingData ? "Editar cliente" : "Novo cliente"}
        onClose={onClose}
        footer={
          <div className="modal-footer-actions">
            {editingData.id && (
              <Button variant="danger" type="button" onClick={handleDelete}>
                Excluir
              </Button>
            )}

            <Button variant="ghost" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="customer-form">
              Salvar
            </Button>
          </div>
        }
      >
      <div className="customer-form-header">
        <div className="customer-form-avatar">{customerInitial}</div>
        <div className="customer-form-header-body">
          <div className="customer-form-heading-row">
            <h3 className="customer-form-heading">{displayName}</h3>
            <span
              className={
                "customer-pill " +
                (editingData ? "customer-pill-edit" : "customer-pill-new")
              }
            >
              {editingData ? "Em edição" : "Novo cadastro"}
            </span>
          </div>
          <p className="customer-form-subtitle">
            {editingData
               ? "Revise contato, endereço e observações antes de salvar."
              : "Preencha os campos de contato e endereço para cadastrar."}
          </p>
          <div className="customer-form-meta">
            <span className="customer-pill-soft">
              {form.phone ? "Telefone informado" : "Telefone pendente"}
            </span>
            <span className="customer-pill-soft">
              {form.address.city || form.address.street
                 ? "Endereço preenchido"
                : "Endereço pendente"}
            </span>
          </div>
        </div>
      </div>

      <div className="customer-form-top-actions">
        <Button variant="primary" type="submit" form="customer-form">
          {editingData ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
        {editingData.id && (
          <Button variant="danger" type="button" onClick={handleDelete}>
            Excluir cliente
          </Button>
        )}
      </div>

      {formErrorMessage && (
        <div className="customer-form-error">{formErrorMessage}</div>
      )}

      <form
        id="customer-form"
        className="customer-form-grid"
        onSubmit={handleSubmit}
      >
        {/* Dados principais */}
        <section className="customer-form-section customer-form-card">
          <header className="customer-form-section-header">
            <h4>Dados do cliente</h4>
            <p>Informações de identificação e contato.</p>
          </header>

          <div className="customer-form-row">
            <label className="field">
              <span className="field-label">Nome</span>
              <input
                ref={nameRef}
                className="input"
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Telefone</span>
              <input
                ref={phoneRef}
                className="input"
                value={form.phone}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                placeholder="(11) 99999-0000"
              />
            </label>

            <label className="field">
              <span className="field-label">CPF</span>
              <input
                className="input"
                value={form.cpf}
                onChange={(e) => handleFieldChange("cpf", e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Endereço e entrega */}
        <section className="customer-form-section customer-form-card">
          <header className="customer-form-section-header">
            <h4>Endereço e entrega</h4>
            <p>Dados usados para cálculo de rota e taxa de entrega.</p>
          </header>

          <div className="customer-form-row customer-form-row-cep">
            <label className="field">
              <span className="field-label">CEP</span>
              <div className="customer-cep-inline">
                <input
                  ref={cepRef}
                  className={"input" + (formErrors["address.cep"] ? " input-error" : "")}
                  value={form.address.cep}
                  onChange={(e) => handleAddressChange("cep", e.target.value)}
                  placeholder="Somente números"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCepSearch}
                >
                  Buscar CEP
                </Button>
              </div>
              {cepMessage && (
                <span
                  className={
                    "cep-status" +
                    (cepStatus === "error"
                      ? " cep-status-error"
                      : " cep-status-ok")
                  }
                >
                  {cepMessage}
                </span>
              )}
            </label>

            <label className="field">
              <span className="field-label">Rua</span>
              <input
                ref={streetRef}
                className={"input" + (formErrors["address.street"] ? " input-error" : "")}
                value={form.address.street}
                onChange={(e) =>
                  handleAddressChange("street", e.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Número</span>
              <input
                ref={numberRef}
                className={"input" + (formErrors["address.number"] ? " input-error" : "")}
                value={form.address.number}
                onChange={(e) =>
                  handleAddressChange("number", e.target.value)
                }
              />
            </label>
          </div>

          <div className="customer-form-row">
            <label className="field">
              <span className="field-label">Bairro</span>
              <input
                ref={neighborhoodRef}
                className={"input" + (formErrors["address.neighborhood"] ? " input-error" : "")}
                value={form.address.neighborhood}
                onChange={(e) =>
                  handleAddressChange("neighborhood", e.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Cidade</span>
              <input
                ref={cityRef}
                className={"input" + (formErrors["address.city"] ? " input-error" : "")}
                value={form.address.city}
                onChange={(e) =>
                  handleAddressChange("city", e.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Estado</span>
              <input
                ref={stateRef}
                className={"input" + (formErrors["address.state"] ? " input-error" : "")}
                value={form.address.state}
                onChange={(e) =>
                  handleAddressChange("state", e.target.value)
                }
                placeholder="SP, RJ..."
              />
            </label>
          </div>

          <div className="customer-form-row">
            <label className="field">
              <span className="field-label">Referência</span>
              <input
                className="input"
                value={form.address.reference}
                onChange={(e) =>
                  handleAddressChange("reference", e.target.value)
                }
                placeholder="Perto de..., portão azul..."
              />
            </label>

            <label className="field">
              <span className="field-label">Complemento</span>
              <input
                className="input"
                value={form.address.complement}
                onChange={(e) =>
                  handleAddressChange("complement", e.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Taxa de entrega padrão</span>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.deliveryFee}
                onChange={(e) =>
                  handleFieldChange("deliveryFee", e.target.value)
                }
                placeholder="0,00"
              />
              <span className="field-hint">
                Sugestão de taxa para este endereço (pode ser ajustada no
                pedido).
              </span>
            </label>
          </div>
        </section>

        {/* Observações */}
        <section className="customer-form-section customer-form-card">
          <header className="customer-form-section-header">
            <h4>Observações</h4>
            <p>Informações importantes sobre este cliente.</p>
          </header>

          <label className="field">
            <span className="field-label">Observações</span>
            <textarea
              className="input input-multiline"
              value={form.notes}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              placeholder="Ex: prefere contato por WhatsApp, alergias, etc."
            />
          </label>
                <div className="customer-form-top-actions">
        <Button variant="primary" type="submit" form="customer-form">
          Cadastrar cliente
        </Button>
        {editingData.id && (
          <Button variant="danger" type="button" onClick={handleDelete}>
            Excluir cliente
          </Button>
        )}
      </div>
        </section>
      </form>
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Excluir cliente"
        message="Tem certeza que deseja excluir este cliente Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

export default CustomerFormModal;
