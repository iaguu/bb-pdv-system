import React from "react";

const SearchInput = ({ value, onChange, placeholder }) => {
  return (
    <input
      className="input search-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Buscar..."}
    />
  );
};

export default SearchInput;
