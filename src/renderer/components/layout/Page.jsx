import React from "react";

const Page = ({ title, subtitle, actions, children }) => {
  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header-main">
          <h2 className="page-title">{title}</h2>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </header>
      <div className="page-body">{children}</div>
    </div>
  );
};

export default Page;
