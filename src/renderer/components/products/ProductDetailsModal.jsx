// src/renderer/components/products/ProductDetailsModal.jsx
import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import { CATEGORY_LABELS } from "../../pages/Products";
import { emitToast } from "../../utils/toast";

export default function ProductDetailsModal({ product, onClose, onSave }) {
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    setEditing(product || null);
  }, [product]);

  if (!product || !editing) return null;

  const handleChange = (field, value) => {
    setEditing((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editing.name?.trim()) {
      emitToast({
        type: "warning",
        message: "Informe o nome do produto.",
      });
      return;
    }
    onSave({
      ...editing,
      name: editing.name.trim(),
    });
  };

  const formId = "product-details-form";

  return (
    <Modal
      isOpen={Boolean(product)}
      onClose={onClose}
      title={`Produto: ${editing.name || "(Sem nome)"}`}
      className="product-modal"
      bodyClassName="modal-form product-modal-body"
      footer={
        <div className="modal-footer-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            Voltar
          </button>
          <button type="submit" className="btn btn-primary" form={formId}>
            Salvar alterações
          </button>
        </div>
      }
    >
      <form id={formId} className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-section">
          <div className="modal-section-title">Informações</div>

          <div style={{ marginTop: 6 }}>
            <div className="field-label">Nome</div>
            <input
              className="field-input"
              value={editing.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

          {editing.type === "pizza" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 8,
              }}
            >
              <div>
                <div className="field-label">Preço broto</div>
                <input
                  className="field-input"
                  type="number"
                  value={editing.priceBroto ?? 0}
                  onChange={(e) =>
                    handleChange("priceBroto", Number(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <div className="field-label">Preço grande</div>
                <input
                  className="field-input"
                  type="number"
                  value={editing.priceGrande ?? 0}
                  onChange={(e) =>
                    handleChange("priceGrande", Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div className="field-label">Preço único</div>
              <input
                className="field-input"
                type="number"
                value={editing.price ?? 0}
                onChange={(e) => handleChange("price", Number(e.target.value) || 0)}
              />
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <div className="field-label">Descrição</div>
            <textarea
              className="field-textarea"
              rows={2}
              value={editing.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Tipo</div>
          <div className="field-label" style={{ marginBottom: 4 }}>
            Tipo selecionado
          </div>
          <div className="modal-helper-text">
            {CATEGORY_LABELS[editing.type] || editing.type}
          </div>
        </div>
      </form>
    </Modal>
  );
}
