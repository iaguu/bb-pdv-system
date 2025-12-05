import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";

const digitsOnly = (s) => (s || "").replace(/\D/g, "");

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

  const [form, setForm] = useState(() => ({
    id: editingData?.id || undefined,
    name: editingData?.name || "",
    phone: editingData?.phone || "",
    cpf: editingData?.cpf || "",
    notes: editingData?.notes || "",
    deliveryFee:
      typeof editingData?.deliveryFee === "number"
        ? String(editingData.deliveryFee)
        : "",
    address: {
      cep: editingData?.address?.cep || "",
      street: editingData?.address?.street || "",
      number: editingData?.address?.number || "",
      neighborhood: editingData?.address?.neighborhood || "",
      city: editingData?.address?.city || "",
      state: editingData?.address?.state || "",
      complement: editingData?.address?.complement || "",
      reference: editingData?.address?.reference || "",
    },
  }));

  const [cepStatus, setCepStatus] = useState("idle"); // idle | loading | ok | error
  const [cepMessage, setCepMessage] = useState("");

  // se o cliente mudar (editar outro), atualiza o form
  useEffect(() => {
    if (!editingData) return;
    setForm({
      id: editingData.id || undefined,
      name: editingData.name || "",
      phone: editingData.phone || "",
      cpf: editingData.cpf || "",
      notes: editingData.notes || "",
      deliveryFee:
        typeof editingData.deliveryFee === "number"
          ? String(editingData.deliveryFee)
          : "",
      address: {
        cep: editingData.address?.cep || "",
        street: editingData.address?.street || "",
        number: editingData.address?.number || "",
        neighborhood: editingData.address?.neighborhood || "",
        city: editingData.address?.city || "",
        state: editingData.address?.state || "",
        complement: editingData.address?.complement || "",
        reference: editingData.address?.reference || "",
      },
    });
  }, [editingData]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddressChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value,
      },
    }));
  };

  const handleCepSearch = async () => {
    try {
      setCepStatus("loading");
      setCepMessage("Buscando CEP...");
      const data = await lookupCep(form.address.cep);

      setForm((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          cep: digitsOnly(prev.address.cep),
          street: data.logradouro || prev.address.street,
          neighborhood: data.bairro || prev.address.neighborhood,
          city: data.localidade || prev.address.city,
          state: data.uf || prev.address.state,
        },
      }));

      setCepStatus("ok");
      setCepMessage("Endereço atualizado pelo CEP.");
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
      setCepStatus("error");
      setCepMessage(err.message || "Não foi possível buscar o CEP.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      id: form.id,
      name: form.name.trim(),
      phone: digitsOnly(form.phone),
      cpf: digitsOnly(form.cpf),
      notes: form.notes.trim(),
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
      createdAt: editingData?.createdAt || new Date().toISOString(),
    };

    if (editingData && editingData.id) {
      await window.dataEngine.updateItem("customers", editingData.id, payload);
    } else {
      await window.dataEngine.addItem("customers", payload);
    }

    if (onSaved) onSaved();
    onClose();
  };

  return (
    <Modal
      title={editingData ? "Editar cliente" : "Novo cliente"}
      onClose={onClose}
      footer={
        <div className="modal-footer-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="customer-form">
            Salvar
          </Button>
        </div>
      }
    >
      <form
        id="customer-form"
        className="customer-form-grid"
        onSubmit={handleSubmit}
      >
        {/* Dados principais */}
        <section className="customer-form-section">
          <header className="customer-form-section-header">
            <h4>Dados do cliente</h4>
            <p>Informações de identificação e contato.</p>
          </header>

          <div className="customer-form-row">
            <label className="field">
              <span className="field-label">Nome</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Telefone</span>
              <input
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
        <section className="customer-form-section">
          <header className="customer-form-section-header">
            <h4>Endereço e entrega</h4>
            <p>Dados usados para cálculo de rota e taxa de entrega.</p>
          </header>

          <div className="customer-form-row customer-form-row-cep">
            <label className="field">
              <span className="field-label">CEP</span>
              <div className="customer-cep-inline">
                <input
                  className="input"
                  value={form.address.cep}
                  onChange={(e) =>
                    handleAddressChange("cep", e.target.value)
                  }
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
                className="input"
                value={form.address.street}
                onChange={(e) =>
                  handleAddressChange("street", e.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Número</span>
              <input
                className="input"
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
                className="input"
                value={form.address.neighborhood}
                onChange={(e) =>
                  handleAddressChange("neighborhood", e.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Cidade</span>
              <input
                className="input"
                value={form.address.city}
                onChange={(e) =>
                  handleAddressChange("city", e.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Estado</span>
              <input
                className="input"
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
        <section className="customer-form-section">
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
        </section>
      </form>
    </Modal>
  );
};

export default CustomerFormModal;
