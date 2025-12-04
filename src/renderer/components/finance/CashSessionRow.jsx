import React from "react";

const CashSessionRow = ({ session, onClick }) => {
  return (
    <div className="cash-row" onClick={() => onClick(session)}>
      <div className="cash-row-main">
        <div className="cash-row-title">
          {session.id} - {session.status === "open" ? "Aberto" : "Fechado"}
        </div>
        <div className="cash-row-meta">
          <span>Abertura: {session.openedAt}</span>
          {session.closedAt && <span>• Fechamento: {session.closedAt}</span>}
        </div>
      </div>
      <div className="cash-row-side">
        {session.closingAmount != null && (
          <span>R$ {session.closingAmount}</span>
        )}
      </div>
    </div>
  );
};

export default CashSessionRow;
