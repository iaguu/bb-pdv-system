import React from "react";

const IconBase = ({ children, size = 18, className = "" }) => (
  <span
    className={["nav-icon", className].filter(Boolean).join(" ")}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 24 24"
      role="img"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  </span>
);

const NavIcon = ({ name, size = 18, className = "" }) => {
  switch (name) {
    case "dashboard":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </IconBase>
      );
    case "orders":
      return (
        <IconBase size={size} className={className}>
          <path d="M6 5h12M6 12h12M6 19h8" />
        </IconBase>
      );
    case "catalog":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 6h16v12H4z" />
          <path d="M8 6v12" />
          <path d="M12 6v12" />
        </IconBase>
      );
    case "people":
      return (
        <IconBase size={size} className={className}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M14 20a4 4 0 0 1 7 0" />
        </IconBase>
      );
    case "stock":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 7h16v10H4z" />
          <path d="M7 7V5h10v2" />
          <path d="M8 12h8" />
        </IconBase>
      );
    case "finance":
      return (
        <IconBase size={size} className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 14h4" />
        </IconBase>
      );
    case "settings":
      return (
        <IconBase size={size} className={className}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 7.5 4 7 3 10l2 1v2l-2 1 1 3 2-.5L7.5 18l-.5 2 3 1 1-2h2l1 2 3-1-.5-2L18 16.5l2 .5 1-3-2-1z" />
        </IconBase>
      );
    case "plus":
      return (
        <IconBase size={size} className={className}>
          <path d="M12 5v14M5 12h14" />
        </IconBase>
      );
    case "search":
      return (
        <IconBase size={size} className={className}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </IconBase>
      );
    case "sync":
      return (
        <IconBase size={size} className={className}>
          <path d="M20 12a8 8 0 1 1-2.3-5.7" />
          <path d="M20 5v5h-5" />
        </IconBase>
      );
    case "collapse":
      return (
        <IconBase size={size} className={className}>
          <path d="M15 6l-6 6 6 6" />
        </IconBase>
      );
    case "expand":
      return (
        <IconBase size={size} className={className}>
          <path d="M9 6l6 6-6 6" />
        </IconBase>
      );
    default:
      return null;
  }
};

export default NavIcon;
