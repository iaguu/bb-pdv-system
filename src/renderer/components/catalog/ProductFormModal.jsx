import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";

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
  return Number.isNaN(n)  null : n;
};

const formatMoneyInput = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  return n.toFixed(2).replace(".", ",");
};

const ProductFormModal = ({
  isOpen,
  onClose,
  onSave,
  product,
  activeTab = "pizzas",
}) => {
  const [form, setForm] = useState(() => ({
    id: product.id || null,
    name: product.name || "",
    description: product.description || "",
    type: product.type || inferTypeFromTab(activeTab),
    price: product.price || null,
    priceBroto: product.priceBroto || null,
    priceGrande: product.priceGrande || null,
    active: product.active  true,
    ingredients: Array.isArray(product.ingredients)  product.ingredients : [],
  }));

  const [newIngredient, setNewIngredient] = useState("");

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      id: product.id || null,
      name: product.name || "",
      description: product.description || "",
      type: product.type || inferTypeFromTab(activeTab),
      price: product.price || null,
      priceBroto: product.priceBroto || null,
      priceGrande: product.priceGrande || null,
      active: product.active  true,
      ingredients: Array.isArray(product.ingredients)  product.ingredients : [],
    }));
  }, [product, activeTab]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePriceChange = (field, raw) => {
    const parsed = parseMoney(raw);
    setForm((prev) => ({
      ...prev,
      [field]: parsed,
    }));
  };

  const addIngredientFromInput = () => {
    const trimmed = newIngredient.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), trimmed],
    }));
    setNewIngredient("");
  };

  const handleIngredientKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addIngredientFromInput();
    }
  };

  const handleRemoveIngredient = (index) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      type: form.type || inferTypeFromTab(activeTab),
    };
    if (typeof onSave === "function") onSave(payload);
  };

  const canSave = form.name.trim().length > 2;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={form.id  "Editar produto" : "Novo produto"}
      className="product-form-modal"
    >
      <div className="product-form__body">
        <section className="form-section">
          <div className="form-grid">
            <div className="form-field form-field--wide">
              <label className="field-label">Nome</label>
              <input
                className="field-input"
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Ex: Calabresa, Portuguesa..."
              />
            </div>
            <div className="form-field">
              <label className="field-label">Tipo</label>
              <select
                className="field-input"
                value={form.type}
                onChange={(e) => handleChange("type", e.target.value)}
              >
                <option value="pizza">Pizza</option>
                <option value="drink">Bebida</option>
                <option value="extra">Extra</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label className="field-label">Descricao</label>
            <textarea
              className="field-input neworder-textarea"
              rows={2}
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Descricao curta para ajudar o cliente na escolha"
            />
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Precos</h3>
          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Preco unico</label>
              <input
                className="field-input"
                type="text"
                value={formatMoneyInput(form.price)}
                onChange={(e) => handlePriceChange("price", e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Preco broto</label>
              <input
                className="field-input"
                type="text"
                value={formatMoneyInput(form.priceBroto)}
                onChange={(e) => handlePriceChange("priceBroto", e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Preco grande</label>
              <input
                className="field-input"
                type="text"
                value={formatMoneyInput(form.priceGrande)}
                onChange={(e) => handlePriceChange("priceGrande", e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__header">
            <h3 className="form-section__title">Ingredientes</h3>
            <span className="form-section__hint">
              Digite e pressione <strong>Enter</strong> ou <strong>virgula</strong> para
              adicionar.
            </span>
          </div>

          <div className="ingredients-input">
            <input
              className="field-input"
              type="text"
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyDown={handleIngredientKeyDown}
              placeholder="Ex: mussarela, calabresa, cebola..."
            />
            <button type="button" className="btn btn-ghost" onClick={addIngredientFromInput}>
              Adicionar
            </button>
          </div>

          <div className="ingredients-badges">
            {(form.ingredients || []).length === 0 && (
              <span className="ingredients-badges__empty">Nenhum ingrediente cadastrado.</span>
            )}
            {(form.ingredients || []).map((ing, index) => (
              <span key={index} className="badge badge--ingredient">
                <span className="badge__label">{ing}</span>
                <button
                  type="button"
                  className="badge__remove"
                  onClick={() => handleRemoveIngredient(index)}
                  aria-label={`Remover ${ing}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="form-section form-section--compact">
          <label className="switch">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => handleChange("active", e.target.checked)}
            />
            <span className="switch__track">
              <span className="switch__thumb" />
            </span>
            <span className="switch__label">Produto ativo no catalogo</span>
          </label>
        </section>
      </div>

      <div className="product-form__footer">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!canSave}>
          Salvar produto
        </Button>
      </div>
    </Modal>
  );
};

export default ProductFormModal;
