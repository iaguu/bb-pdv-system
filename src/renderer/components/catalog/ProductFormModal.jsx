// src/renderer/components/catalog/ProductFormModal.jsx
import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";

const normalizeProductsData = (data) => {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data)) return data;
  return [];
};

const inferTypeFromTab = (tab) => {
  if (tab === "pizzas") return "pizza";
  if (tab === "drinks") return "drink";
  if (tab === "extras") return "extra";
  return "pizza";
};

// ----- Helpers de dinheiro -----
const parseMoney = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = value.toString().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
};

const formatNumberToCurrencyString = (num) => {
  if (typeof num !== "number" || Number.isNaN(num)) return "";
  const cents = Math.round(num * 100);
  const value = (cents / 100).toFixed(2);
  const [intPart, decimal] = value.split(".");
  const intWithDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intWithDots},${decimal}`;
};

const maskCurrency = (raw) => {
  if (!raw) return "";
  const digits = raw.toString().replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const value = (cents / 100).toFixed(2);
  const [intPart, decimal] = value.split(".");
  const intWithDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intWithDots},${decimal}`;
};

const ProductFormModal = ({ tab, initialData, product, onClose, onSaved }) => {
  const editingData = initialData || product || null;
  const isEditing = !!(editingData && editingData.id);

  const baseType = editingData?.type || inferTypeFromTab(tab);

  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState(() => ({
    id: editingData?.id || undefined,
    name: editingData?.name || "",
    description: editingData?.description || "",
    type: baseType,
    category: editingData?.category || "",
    priceBroto:
      typeof editingData?.priceBroto === "number"
        ? formatNumberToCurrencyString(editingData.priceBroto)
        : "",
    priceGrande:
      typeof editingData?.priceGrande === "number"
        ? formatNumberToCurrencyString(editingData.priceGrande)
        : "",
    price:
      typeof editingData?.price === "number"
        ? formatNumberToCurrencyString(editingData.price)
        : "",
    isAvailable:
      typeof editingData?.isAvailable === "boolean"
        ? editingData.isAvailable
        : editingData?.active !== false,
  }));

  const isPizza = form.type === "pizza";

  // Ajusta tipo ao trocar de aba se não estiver editando
  useEffect(() => {
    if (editingData) return;
    setForm((prev) => ({
      ...prev,
      type: inferTypeFromTab(tab),
    }));
  }, [tab, editingData]);

  // Recarrega form ao mudar o produto em edição
  useEffect(() => {
    if (!editingData) return;
    setForm({
      id: editingData.id || undefined,
      name: editingData.name || "",
      description: editingData.description || "",
      type: editingData.type || baseType,
      category: editingData.category || "",
      priceBroto:
        typeof editingData.priceBroto === "number"
          ? formatNumberToCurrencyString(editingData.priceBroto)
          : "",
      priceGrande:
        typeof editingData.priceGrande === "number"
          ? formatNumberToCurrencyString(editingData.priceGrande)
          : "",
      price:
        typeof editingData.price === "number"
          ? formatNumberToCurrencyString(editingData.price)
          : "",
      isAvailable:
        typeof editingData.isAvailable === "boolean"
          ? editingData.isAvailable
          : editingData.active !== false,
    });
  }, [editingData, baseType]);

  // Carrega categorias
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await window.dataEngine.get("products");
        const items = normalizeProductsData(data);
        const cats = Array.from(
          new Set(
            items
              .map((p) => (p.category || "").trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, "pt-BR"));
        setCategories(cats);
      } catch (err) {
        console.error("Erro ao carregar categorias:", err);
      }
    }
    loadCategories();
  }, []);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePriceChange = (field, raw) => {
    const masked = maskCurrency(raw);
    setForm((prev) => ({
      ...prev,
      [field]: masked,
    }));
  };

  const handleTypeClick = (typeValue) => {
    setForm((prev) => ({
      ...prev,
      type: typeValue,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const description = form.description.trim();
    const category = form.category.trim();

    if (!name) {
      alert("Informe o nome do produto.");
      return;
    }

    const payload = {
      id: form.id,
      name,
      description,
      type: form.type,
      category,
      isAvailable: !!form.isAvailable,
      active: !!form.isAvailable,
    };

    if (isPizza) {
      const priceBrotoNum = parseMoney(form.priceBroto);
      const priceGrandeNum = parseMoney(form.priceGrande);

      if (priceBrotoNum === null && priceGrandeNum === null) {
        const confirmar = window.confirm(
          "Os preços de broto e grande estão vazios. Deseja salvar mesmo assim?"
        );
        if (!confirmar) return;
      }

      payload.priceBroto = priceBrotoNum;
      payload.priceGrande = priceGrandeNum;
      payload.price = null;
    } else {
      const priceNum = parseMoney(form.price);

      if (priceNum === null) {
        const confirmar = window.confirm(
          "O preço está vazio. Deseja salvar mesmo assim?"
        );
        if (!confirmar) return;
      }

      payload.price = priceNum;
      payload.priceBroto = null;
      payload.priceGrande = null;
    }

    try {
      if (isEditing) {
        await window.dataEngine.updateItem("products", editingData.id, payload);
      } else {
        await window.dataEngine.addItem("products", payload);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
      alert("Não foi possível salvar o produto. Verifique o console.");
    }
  };

  const title = isEditing ? "Editar produto" : "Novo produto";
  const primaryLabel = isEditing ? "Atualizar produto" : "Cadastrar produto";

  return (
    <Modal title={title} onClose={onClose}>
      <form
        id="product-form"
        className="product-form"
        onSubmit={handleSubmit}
      >
        <div className="product-form-layout">
          {/* COLUNA ESQUERDA */}
          <section className="product-panel product-panel--main">
            <header className="product-panel-header">
              <div>
                <h4>Informações do produto</h4>
                <p>Nome, descrição, tipo e categoria exibidos no cardápio.</p>
              </div>
              <div className="product-type-switch">
                {[
                  { value: "pizza", label: "Pizza" },
                  { value: "drink", label: "Bebida" },
                  { value: "extra", label: "Adicional" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={
                      "product-type-pill" +
                      (form.type === opt.value
                        ? " product-type-pill--active"
                        : "")
                    }
                    onClick={() => handleTypeClick(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </header>

            <div className="product-panel-body">
              <label className="product-field">
                <span className="product-field-label">Nome</span>
                <input
                  className="product-input"
                  value={form.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  required
                  placeholder="Ex: Musa, Calabresa, Refrigerante 2L..."
                />
              </label>

              <label className="product-field">
                <span className="product-field-label">Descrição</span>
                <textarea
                  className="product-input product-input--textarea"
                  value={form.description}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  placeholder={
                    isPizza
                      ? "Ex: Mussarela, tomate fresco e orégano."
                      : "Ex: Refrigerante 2L, sabor cola."
                  }
                  rows={3}
                />
              </label>

              <div className="product-field-row">
                <label className="product-field">
                  <span className="product-field-label">Categoria</span>
                  <input
                    className="product-input"
                    list="product-categories"
                    value={form.category}
                    onChange={(e) =>
                      handleFieldChange("category", e.target.value)
                    }
                    placeholder={
                      isPizza
                        ? "Queijo, doce, especial..."
                        : "Refrigerante, água, sucos..."
                    }
                  />
                  <datalist id="product-categories">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                  <span className="product-field-hint">
                    Use categorias para organizar o cardápio e relatórios.
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* COLUNA DIREITA */}
          <section className="product-panel product-panel--side">
            <header className="product-panel-header">
              <div>
                <h4>Precificação & status</h4>
                <p>Valores usados nos pedidos e disponibilidade.</p>
              </div>
            </header>

            <div className="product-panel-body">
              {isPizza ? (
                <div className="product-field-row product-field-row--2cols">
                  <label className="product-field">
                    <span className="product-field-label">
                      Preço broto (R$)
                    </span>
                    <input
                      className="product-input product-input--money"
                      type="text"
                      inputMode="decimal"
                      value={form.priceBroto}
                      onChange={(e) =>
                        handlePriceChange("priceBroto", e.target.value)
                      }
                      placeholder="0,00"
                    />
                  </label>

                  <label className="product-field">
                    <span className="product-field-label">
                      Preço grande (R$)
                    </span>
                    <input
                      className="product-input product-input--money"
                      type="text"
                      inputMode="decimal"
                      value={form.priceGrande}
                      onChange={(e) =>
                        handlePriceChange("priceGrande", e.target.value)
                      }
                      placeholder="0,00"
                    />
                  </label>
                </div>
              ) : (
                <label className="product-field">
                  <span className="product-field-label">Preço único (R$)</span>
                  <input
                    className="product-input product-input--money"
                    type="text"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) =>
                      handlePriceChange("price", e.target.value)
                    }
                    placeholder="0,00"
                  />
                </label>
              )}

              <label className="product-field product-field--inline">
                <input
                  type="checkbox"
                  checked={!!form.isAvailable}
                  onChange={(e) =>
                    handleFieldChange("isAvailable", e.target.checked)
                  }
                />
                <span className="product-field-label-inline">
                  Disponível para venda
                  <span className="product-field-hint-inline">
                    {" "}
                    (desmarque para pausar no cardápio)
                  </span>
                </span>
              </label>

              <div className="product-mini-summary">
                <span className="product-mini-summary-label">
                  Resumo rápido
                </span>
                <div className="product-mini-summary-body">
                  <span>
                    Tipo:{" "}
                    <strong>
                      {form.type === "pizza"
                        ? "Pizza"
                        : form.type === "drink"
                        ? "Bebida"
                        : "Adicional"}
                    </strong>
                  </span>
                  <span>
                    Categoria:{" "}
                    <strong>{form.category || "não definida"}</strong>
                  </span>
                  <span>
                    Status:{" "}
                    <strong>
                      {form.isAvailable ? "Ativo no catálogo" : "Pausado"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 🎯 AQUI ESTÃO OS BOTÕES */}
        <div className="product-form-actions">
          <div className="product-form-actions-left">
            {isEditing && (
              <span className="product-modal-id-badge">
                ID: {form.id || "-"}
              </span>
            )}
            <br />
            <br />

          </div>
          <div className="product-form-actions-right">
            <Button variant="ghost" type="button" onClick={onClose}>
              Voltar
            </Button>
            <Button variant="primary" type="submit">
              {primaryLabel}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default ProductFormModal;
