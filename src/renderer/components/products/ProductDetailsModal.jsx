// src/renderer/components/products/ProductDetailsModal.jsx
import React, { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "../../pages/Products";

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
      alert("Informe o nome do produto.");
      return;
    }
    onSave({
      ...editing,
      name: editing.name.trim(),
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-window" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              Produto: {editing.name || "(Sem nome)"}
            </div>
            <div className="modal-subtitle">
              Edite os dados do produto. Tipo:{" "}
              {CATEGORY_LABELS[editing.type] || editing.type}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit} style={{ gap: 10 }}>
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
                      handleChange(
                        "priceBroto",
                        Number(e.target.value) || 0
                      )
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
                      handleChange(
                        "priceGrande",
                        Number(e.target.value) || 0
                      )
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
                  onChange={(e) =>
                    handleChange("price", Number(e.target.value) || 0)
                  }
                />
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <div className="field-label">Descrição</div>
              <textarea
                className="field-textarea"
                rows={2}
                value={editing.description || ""}
                onChange={(e) =>
                  handleChange("description", e.target.value)
                }
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Voltar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
