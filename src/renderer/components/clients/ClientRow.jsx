import React from "react";

export default function ClientRow({ customer, onSelect }) {
  const addr = customer.address || {};

  return (
    <div className="client-row" onClick={onSelect}>
      <div className="client-main">
        <div className="client-name">{customer.name || "(Sem nome)"}</div>

        <div className="client-meta">
          {customer.phone && <span>📞 {customer.phone}</span>}
          {customer.cpf && <span>• CPF: {customer.cpf}</span>}
        </div>

        {(addr.street || addr.neighborhood || addr.city) && (
          <div className="client-address">
            {addr.street}
            {addr.number && `, ${addr.number}`}
            {(addr.street || addr.number) && (addr.neighborhood || addr.city) && " • "}
            {addr.neighborhood}
            {addr.neighborhood && addr.city && " - "}
            {addr.city}
            {addr.state && ` / ${addr.state}`}
          </div>
        )}

        {customer.createdAt && (
          <div className="client-time">Cadastrado em {customer.createdAt}</div>
        )}
      </div>

      <div className="client-end">
        <button className="btn btn-outline">Ver mais</button>
      </div>
    </div>
  );
}
