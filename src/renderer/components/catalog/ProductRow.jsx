// src/renderer/components/catalog/ProductRow.jsx
import React from "react";
import Tag from "../common/Tag";

const formatCurrency = (value) => {
  if (value == null || isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
};

const ProductRow = ({ product, onEdit }) => {
  if (!product) return null;

  // Normalizacao basica de campos (compatibilidade com varios formatos)
  const name = product.name || product.nome || "Sem nome";
  const category = product.category || product.categoria || "";
  const type = (product.type || "").toLowerCase();

  const priceBroto = product.priceBroto  product.preco_broto  null;
  const priceGrande = product.priceGrande  product.preco_grande  null;

  const isActive = product.active !== false && product.isAvailable !== false;

  const badges = Array.isArray(product.badges)  product.badges : [];
  const ingredientes = Array.isArray(product.ingredientes)
     product.ingredientes
    : [];

  const handleClick = () => {
    if (typeof onEdit === "function") {
      onEdit(product);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const typeLabelMap = {
    pizza: "Pizza",
    drink: "Bebida",
    bebida: "Bebida",
    extra: "Adicional",
    adicional: "Adicional",
  };
  const typeLabel = typeLabelMap[type] || (type  type : "");

  const badgeLabelMap = {
    best: "Mais pedido",
    promo: "Promocao",
    premium: "Premium",
    popular: "Popular",
    new: "Novo",
    chef: "Especial do chef",
  };

  const badgeToneMap = {
    best: "success",
    promo: "warning",
    premium: "info",
    popular: "muted",
    new: "info",
    chef: "info",
  };

  const description =
    product.description || (ingredientes.length  ingredientes.join(", ") : "");

  return (
    <div
      className={"product-row" + (isActive  "" : " product-row--inactive")}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed="false"
      aria-label={`Editar ${name}`}
    >
      <div className="product-row-main">
        <div className="product-row-title">
          <span className="product-name">{name}</span>

          {category && (
            <Tag tone="muted" className="product-category-tag">
              {category}
            </Tag>
          )}
        </div>

        {description && <p className="product-description">{description}</p>}

        <div className="product-row-meta">
          {typeLabel && <Tag tone="info">{typeLabel}</Tag>}

          {!isActive && <Tag tone="danger">Pausado</Tag>}

          {badges.length > 0 && (
            <div className="product-row-badges">
              {badges.map((badge, idx) => {
                const key = String(badge).toLowerCase();
                const label = badgeLabelMap[key] || badge;
                const tone = badgeToneMap[key] || "muted";
                return (
                  <Tag key={`${key}-${idx}`} tone={tone}>
                    {label}
                  </Tag>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="product-row-side">
        {priceBroto != null && (
          <span className="product-price-small">
            Broto: {formatCurrency(priceBroto)}
          </span>
        )}
        {priceGrande != null && (
          <span className="product-price-large">
            Grande: {formatCurrency(priceGrande)}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProductRow;
