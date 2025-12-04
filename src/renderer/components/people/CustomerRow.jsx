// src/renderer/components/people/CustomerRow.jsx
import React from "react";
import Tag from "../common/Tag";

const VIP_THRESHOLD = 20;
const FREQUENT_THRESHOLD = 5;

const CustomerRow = ({ customer, onClick }) => {
  const addr = customer.address || {};
  const totalOrders = Number(customer.totalOrders || 0);

  let loyaltyTag = null;
  if (totalOrders >= VIP_THRESHOLD) {
    loyaltyTag = <Tag tone="success">VIP</Tag>;
  } else if (totalOrders >= FREQUENT_THRESHOLD) {
    loyaltyTag = <Tag tone="info">Frequente</Tag>;
  }

  return (
    <div className="customer-row" onClick={() => onClick(customer)}>
      <div className="customer-row-main">
        <div className="customer-row-title">
          <div className="customer-row-name">
            {customer.name || "(Sem nome)"}
          </div>
          {loyaltyTag}
        </div>

        <div className="customer-row-meta">
          {customer.phone && <span>{customer.phone}</span>}
          {addr.neighborhood && (
            <span className="customer-row-neighborhood">
              {addr.neighborhood}
            </span>
          )}
        </div>
      </div>

      <div className="customer-row-side">
        {customer.totalOrders != null && (
          <span>{customer.totalOrders} pedidos</span>
        )}
      </div>
    </div>
  );
};

export default CustomerRow;
