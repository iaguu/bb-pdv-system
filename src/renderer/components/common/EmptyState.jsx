import React from "react";

const EmptyState = ({ title, description, actions }) => {
  return (
    <div className="empty-state">
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
};

export default EmptyState;
