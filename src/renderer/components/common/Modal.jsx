// src/renderer/components/common/Modal.jsx
import React, { useEffect, useCallback } from "react";

/**
 * Modal genérico
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
  size = "md",
  children,
}) => {
  const hasControlProp =
    typeof open === "boolean" || typeof isOpen === "boolean";

  // Se tiver open/isOpen -> usa; senão, considera sempre visível
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
        className={`modal-dialog modal-${size}`}
        onMouseDown={stopPropagation}
      >
        <div className="modal-header">
          {title && <h2 className="modal-title">{title}</h2>}
          {onClose && (
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Fechar"
            >
              ×
            </button>
          )}
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
