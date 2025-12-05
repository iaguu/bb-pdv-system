import React from "react";

const Button = ({ variant = "primary", size = "md", children, ...rest }) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      type={rest.type || "button"}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
