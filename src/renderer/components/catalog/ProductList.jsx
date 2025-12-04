// src/renderer/components/catalog/ProductList.jsx
import React from "react";
import EmptyState from "../common/EmptyState";
import ProductRow from "./ProductRow";

const ProductList = ({ items, products, currentTab, onEdit }) => {
  const source = items || products || [];

  const filtered = source.filter((p) => {
    if (currentTab === "pizzas") return p.type === "pizza";
    if (currentTab === "drinks") return p.type === "drink";
    if (currentTab === "extras") return p.type === "extra";
    return true; // todos
  });

  if (!filtered.length) {
    return (
      <EmptyState
        title="Nenhum item no catálogo"
        description="Cadastre novos produtos ou importe um JSON para começar a vender."
      />
    );
  }

  return (
    <div className="product-list">
      {filtered.map((p) => (
        <ProductRow key={p.id} product={p} onEdit={onEdit} />
      ))}
    </div>
  );
};

export default ProductList;
