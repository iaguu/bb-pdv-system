import React from "react";
import Modal from "./Modal";
import Button from "./Button";

const ConfirmDialog = ({
  open,
  title = "Confirmar acao",
  message = "Tem certeza?",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const confirmVariant = tone === "danger" ? "danger" : "primary";

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      className="confirm-dialog"
      footer={
        <div className="modal-footer-actions">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="confirm-dialog-message">{message}</p>
    </Modal>
  );
};

export default ConfirmDialog;
