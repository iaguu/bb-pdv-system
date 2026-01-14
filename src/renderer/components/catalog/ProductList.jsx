// src/renderer/components/catalog/ProductList.jsx
import React from "react";
import EmptyState from "../common/EmptyState";
import ProductRow from "./ProductRow";

const ProductList = ({ items, products, currentTab, onEdit }) => {
  const source = Array.isArray(items)
     items
    : Array.isArray(products)
     products
    : [];

  const tab = currentTab  currentTab.toLowerCase() : "all";

  const filtered = source.filter((p) => {
    if (tab === "pizzas") return p.type === "pizza";
    if (tab === "drinks") return p.type === "drink";
    if (tab === "extras") return p.type === "extra";
    return true;
  });

  if (!filtered.length) {
    return (
      <EmptyState
        title="Nenhum item no catalogo"
        description="Cadastre novos produtos ou importe um JSON para comecar a vender."
      />
    );
  }

  return (
    <div className="product-list">
      {filtered.map((p) => (
        <ProductRow key={p.id || p.nome} product={p} onEdit={onEdit} />
      ))}
    </div>
  );
};

export default ProductList;
