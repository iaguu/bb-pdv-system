import React from "react";

const Tabs = ({ value, onChange, options }) => {
  return (
    <div className="tabs">
      {options.map((opt) => {
        const active = opt.value === value;

        return (
          <button
            key={opt.value}
            className={"tab-item" + (active  " tab-item-active" : "")}
            onClick={() => onChange(opt.value)}
            type="button"
          >
            {opt.icon && <span className="tab-item-icon">{opt.icon}</span>}
            <span className="tab-item-label">{opt.label}</span>
            {(opt.badge || opt.badge === 0) && (
              <span className="tab-item-badge">{opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
