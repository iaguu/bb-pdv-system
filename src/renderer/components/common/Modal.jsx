// src/renderer/components/common/Modal.jsx
import React, { useEffect, useCallback } from "react";

/**
 * Modal generico
 *
 * Modo 1 (controlado externamente):
 *   {isOpen && <Modal title="..." onClose={...}>...}
 *
 * Modo 2 (controlado por prop):
 *   <Modal open={isOpen} onClose={...}>...</Modal>
 *   <Modal isOpen={isOpen} onClose={...}>...</Modal>
 */
const Modal = ({
  open,
  isOpen,
  onClose,
  title,
  subtitle = null,
  headerContent = null,
  size = "md",
  className = "",
  bodyClassName = "",
  footer = null,
  children,
}) => {
  const hasControlProp =
    typeof open === "boolean" || typeof isOpen === "boolean";

  // Se tiver open/isOpen -> usa; senao, considera sempre visivel
  const visible = hasControlProp
    ? typeof open === "boolean"
      ? open
      : Boolean(isOpen)
    : true;

  if (!visible) {
    return null;
  }

  // Travar scroll do body enquanto QUALQUER modal estiver aberto
  useEffect(() => {
    document.body.classList.add("has-modal-open");
    return () => {
      document.body.classList.remove("has-modal-open");
    };
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape" && onClose) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  };

  const stopPropagation = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className={["modal-window", `modal-${size}`, className]
          .filter(Boolean)
          .join(" ")}
        onMouseDown={stopPropagation}
      >
        <div className="modal-header">
          <div className="modal-header-main">
            {title && <h2 className="modal-title">{title}</h2>}
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>

          <div className="modal-header-actions">
            {headerContent}
            {onClose && (
              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                aria-label="Fechar"
              >
                <svg
                  viewBox="0 0 24 24"
                  role="img"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div
          className={["modal-body", bodyClassName].filter(Boolean).join(" ")}
        >
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
