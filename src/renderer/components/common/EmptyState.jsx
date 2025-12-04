import React from "react";

const EmptyState = ({ title, description }) => {
  return (
    <div className="empty-state">
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
    </div>
  );
};

export default EmptyState;
