// src/renderer/components/products/NewProductModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import ConfirmDialog from "../common/ConfirmDialog";
import { CATEGORY_LABELS } from "../../pages/Products";
import { emitToast } from "../../utils/toast";

export default function NewProductModal({ isOpen, onClose, onConfirm }) {
  const [type, setType] = useState("pizza");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [priceBroto, setPriceBroto] = useState("");
  const [priceGrande, setPriceGrande] = useState("");
  const [priceSingle, setPriceSingle] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showPriceConfirm, setShowPriceConfirm] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [priceConfirmMessage, setPriceConfirmMessage] = useState("");

  // sempre que abrir, reseta o formulário
  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen]);

  const reset = () => {
    setType("pizza");
    setName("");
    setCategory("");
    setPriceBroto("");
    setPriceGrande("");
    setPriceSingle("");
    setDescription("");
    setIsActive(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      emitToast({
        type: "warning",
        message: "Informe o nome do produto.",
      });
      return;
    }

    let productDraft;

    if (type === "pizza") {
      const broto = Number(priceBroto) || 0;
      const grande = Number(priceGrande) || 0;

      productDraft = {
        type,
        name: name.trim(),
        category: category.trim(),
        priceBroto: broto,
        priceGrande: grande,
        description: description.trim(),
        active: isActive,
      };
    } else {
      const price = Number(priceSingle) || 0;

      productDraft = {
        type,
        name: name.trim(),
        category: category.trim(),
        price,
        description: description.trim(),
        active: isActive,
      };
    }

    if (
      (type === "pizza" && !productDraft.priceBroto && !productDraft.priceGrande) ||
      (type !== "pizza" && !productDraft.price)
    ) {
      setPendingDraft(productDraft);
      setPriceConfirmMessage(
        type === "pizza"
           "Os preços de broto e grande estão zerados. Deseja continuar mesmo assim"
          : "O preço está zerado. Deseja continuar mesmo assim"
      );
      setShowPriceConfirm(true);
      return;
    }

    if (typeof onConfirm === "function") {
      onConfirm(productDraft);
    }
  };

  const handleCancel = () => {
    reset();
    setShowPriceConfirm(false);
    setPendingDraft(null);
    if (typeof onClose === "function") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const typeLabel = CATEGORY_LABELS[type] || "Produto";
  const formId = "new-product-form";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        title="Novo produto"
        subtitle="Cadastre pizzas, bebidas ou adicionais do catálogo."
        className="product-modal"
        headerContent={<span className="product-type-badge">{typeLabel}</span>}
        bodyClassName="modal-form product-modal-body"
        footer={
          <div className="modal-footer-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCancel}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" form={formId}>
              Cadastrar produto
            </button>
          </div>
        }
      >
      <form id={formId} className="modal-form" onSubmit={handleSubmit}>
        {/* SEÇÃO: TIPO */}
        <div className="modal-section">
          <div className="modal-section-title">Tipo do produto</div>
          <p className="product-modal-helper">
            Escolha se o item será uma pizza, bebida ou adicional.
          </p>
          <div className="field-pill-group">
            {["pizza", "drink", "extra"].map((c) => (
              <button
                key={c}
                type="button"
                className={"field-pill" + (type === c  " field-pill-active" : "")}
                onClick={() => setType(c)}
              >
                {CATEGORY_LABELS[c] || c}
              </button>
            ))}
          </div>
        </div>

        {/* SEÇÃO: DADOS PRINCIPAIS */}
        <div className="modal-section">
          <div className="modal-section-title">Dados do produto</div>

          <div className="field-group">
            <label className="field">
              <span className="field-label">Nome</span>
              <input
                className="field-input"
                placeholder="Ex: Frango Catupiry"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field-label">
                Categoria (opcional)
                <span className="field-helper">
                  {" "}
                  Ex: Tradicionais, Especiais, Bebidas lata...
                </span>
              </span>
              <input
                className="field-input"
                placeholder="Ex: Especiais da casa"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
          </div>

          {/* Preços */}
          {type === "pizza"  (
            <div className="field-grid-2">
              <label className="field">
                <span className="field-label">Preço broto</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceBroto}
                  onChange={(e) => setPriceBroto(e.target.value)}
                  placeholder="Ex: 42.00"
                />
              </label>

              <label className="field">
                <span className="field-label">Preço grande</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceGrande}
                  onChange={(e) => setPriceGrande(e.target.value)}
                  placeholder="Ex: 69.00"
                />
              </label>
            </div>
          ) : (
            <div className="field-group">
              <label className="field">
                <span className="field-label">Preço</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceSingle}
                  onChange={(e) => setPriceSingle(e.target.value)}
                  placeholder="Ex: 8.00"
                />
              </label>
            </div>
          )}

          {/* Descrição */}
          <div className="field-group">
            <label className="field">
              <span className="field-label">Descrição (opcional)</span>
              <textarea
                className="field-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Mussarela, frango desfiado, catupiry e orégano..."
              />
            </label>
          </div>

          {/* Status */}
          <div className="field-group">
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>
                Disponível para vendas
                <span className="field-helper">
                  {" "}
                  (desmarque para deixar o produto pausado no catálogo)
                </span>
              </span>
            </label>
          </div>
        </div>
      </form>
      </Modal>

      <ConfirmDialog
        open={showPriceConfirm}
        title="Preço zerado"
        message={priceConfirmMessage}
        confirmLabel="Continuar"
        cancelLabel="Revisar"
        tone="warning"
        onConfirm={() => {
          setShowPriceConfirm(false);
          if (typeof onConfirm === "function" && pendingDraft) {
            onConfirm(pendingDraft);
          }
          setPendingDraft(null);
        }}
        onCancel={() => {
          setShowPriceConfirm(false);
          setPendingDraft(null);
        }}
      />
    </>
  );
}
