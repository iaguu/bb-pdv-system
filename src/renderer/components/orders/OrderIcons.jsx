import React from "react";

const IconBase = ({ children, size = 18, className = "" }) => (
  <span
    className={["order-icon", className].filter(Boolean).join(" ")}
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

export const OrderIcon = ({ name, size = 18, className = "" }) => {
  switch (name) {
    case "plus":
      return (
        <IconBase size={size} className={className}>
          <path d="M12 5v14M5 12h14" />
        </IconBase>
      );
    case "pizza":
      return (
        <IconBase size={size} className={className}>
          <path d="M3 3l18 6-6 18L3 3z" />
          <path d="M12 11h.01M9 8h.01M14 15h.01" />
        </IconBase>
      );
    case "drink":
      return (
        <IconBase size={size} className={className}>
          <path d="M7 4h10l-1 14a4 4 0 0 1-4 4h-0a4 4 0 0 1-4-4L7 4z" />
          <path d="M9 4l1-2h4l1 2" />
        </IconBase>
      );
    case "summary":
      return (
        <IconBase size={size} className={className}>
          <path d="M5 5h14M5 12h14M5 19h10" />
        </IconBase>
      );
    case "options":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <path d="M8 6v0M12 12v0M16 18v0" />
        </IconBase>
      );
    case "print":
      return (
        <IconBase size={size} className={className}>
          <path d="M7 8V4h10v4" />
          <path d="M6 16h12v4H6z" />
          <path d="M6 12h12" />
        </IconBase>
      );
    case "payment":
      return (
        <IconBase size={size} className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 14h4" />
        </IconBase>
      );
    case "card":
      return (
        <IconBase size={size} className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 14h4" />
        </IconBase>
      );
    case "cash":
      return (
        <IconBase size={size} className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M7 9h.01M17 15h.01" />
        </IconBase>
      );
    case "pix":
      return (
        <IconBase size={size} className={className}>
          <path d="M12 3l6 6-6 6-6-6 6-6z" />
          <path d="M9 12l-3 3M15 12l3 3" />
        </IconBase>
      );
    case "help":
      return (
        <IconBase size={size} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.3-1.5 1.1-1.5 2.2" />
          <path d="M12 17h.01" />
        </IconBase>
      );
    case "back":
      return (
        <IconBase size={size} className={className}>
          <path d="M15 6l-6 6 6 6" />
          <path d="M21 12H9" />
        </IconBase>
      );
    case "refresh":
      return (
        <IconBase size={size} className={className}>
          <path d="M20 12a8 8 0 1 1-2.3-5.7" />
          <path d="M20 5v5h-5" />
        </IconBase>
      );
    case "truck":
      return (
        <IconBase size={size} className={className}>
          <path d="M3 7h11v7H3z" />
          <path d="M14 9h4l3 3v2h-7" />
          <circle cx="7" cy="17" r="1.5" />
          <circle cx="18" cy="17" r="1.5" />
        </IconBase>
      );
    case "bag":
      return (
        <IconBase size={size} className={className}>
          <path d="M6 7h12l-1 12H7L6 7z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        </IconBase>
      );
    case "store":
      return (
        <IconBase size={size} className={className}>
          <path d="M3 9l1-4h16l1 4" />
          <path d="M4 9v10h16V9" />
          <path d="M9 19v-6h6v6" />
        </IconBase>
      );
    case "home":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 11l8-6 8 6" />
          <path d="M6 10v9h12v-9" />
        </IconBase>
      );
    case "pin":
      return (
        <IconBase size={size} className={className}>
          <path d="M12 21s6-6 6-11a6 6 0 1 0-12 0c0 5 6 11 6 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </IconBase>
      );
    case "user":
      return (
        <IconBase size={size} className={className}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </IconBase>
      );
    case "phone":
      return (
        <IconBase size={size} className={className}>
          <path d="M5 4h5l2 5-3 2c1 2 3 4 5 5l2-3 5 2v5c-8 0-16-8-16-16z" />
        </IconBase>
      );
    case "mic":
      return (
        <IconBase size={size} className={className}>
          <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </IconBase>
      );
    case "id":
      return (
        <IconBase size={size} className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="9" cy="12" r="2" />
          <path d="M13 10h5M13 14h5" />
        </IconBase>
      );
    case "clock":
      return (
        <IconBase size={size} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </IconBase>
      );
    case "cook":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5z" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </IconBase>
      );
    case "box":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 9l8-4 8 4-8 4-8-4z" />
          <path d="M4 9v8l8 4 8-4V9" />
        </IconBase>
      );
    case "check":
      return (
        <IconBase size={size} className={className}>
          <path d="M5 13l4 4L19 7" />
        </IconBase>
      );
    case "ban":
      return (
        <IconBase size={size} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M7 7l10 10" />
        </IconBase>
      );
    case "status":
      return (
        <IconBase size={size} className={className}>
          <circle cx="6" cy="6" r="2" />
          <circle cx="6" cy="12" r="2" />
          <circle cx="6" cy="18" r="2" />
          <path d="M11 6h7M11 12h7M11 18h7" />
        </IconBase>
      );
    case "search":
      return (
        <IconBase size={size} className={className}>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </IconBase>
      );
    case "close":
      return (
        <IconBase size={size} className={className}>
          <path d="M6 6l12 12M18 6l-12 12" />
        </IconBase>
      );
    case "edit":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 20h4l10-10-4-4L4 16v4z" />
          <path d="M13 6l4 4" />
        </IconBase>
      );
    case "copy":
      return (
        <IconBase size={size} className={className}>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <rect x="4" y="4" width="12" height="12" rx="2" />
        </IconBase>
      );
    case "trash":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="M7 7l1 12h8l1-12" />
        </IconBase>
      );
    case "send":
      return (
        <IconBase size={size} className={className}>
          <path d="M4 12l16-8-6 16-2-6-8-2z" />
        </IconBase>
      );
    case "mail":
      return (
        <IconBase size={size} className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 8l9 6 9-6" />
        </IconBase>
      );
    default:
      return null;
  }
};
