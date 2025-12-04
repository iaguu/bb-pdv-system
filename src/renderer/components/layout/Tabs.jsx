import React from "react";

const Tabs = ({ value, onChange, options }) => {
  return (
    <div className="tabs">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={
            "tab-item" + (opt.value === value ? " tab-item-active" : "")
          }
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
