import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import Modal from "../common/Modal";

const MotoboyQrModal = ({ motoboy, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copiar token");

  useEffect(() => {
    let mounted = true;

    const buildQr = async () => {
      if (!motoboy?.qrToken) {
        setQrDataUrl("");
        return;
      }
      try {
        const url = await QRCode.toDataURL(motoboy.qrToken, {
          margin: 1,
          width: 220,
        });
        if (mounted) setQrDataUrl(url);
      } catch (err) {
        console.error("Erro ao gerar QR Code:", err);
        if (mounted) setQrDataUrl("");
      }
    };

    buildQr();
    return () => {
      mounted = false;
    };
  }, [motoboy?.qrToken]);

  const handleCopy = async () => {
    if (!motoboy?.qrToken) return;
    try {
      if (!navigator.clipboard) {
        window.prompt("Copie o token:", motoboy.qrToken);
        return;
      }
      await navigator.clipboard.writeText(motoboy.qrToken);
      setCopyLabel("Copiado");
      setTimeout(() => setCopyLabel("Copiar token"), 1500);
    } catch (err) {
      console.error("Erro ao copiar token:", err);
      setCopyLabel("Falha ao copiar");
      setTimeout(() => setCopyLabel("Copiar token"), 1500);
    }
  };

  return (
    <Modal
      isOpen={Boolean(motoboy)}
      onClose={onClose}
      title="QR Code do motoboy"
      subtitle="Use este QR para identificação rápida do entregador."
      className="motoboy-qr-modal"
    >
      <div className="motoboy-qr">
        <div className="motoboy-qr-card">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code do motoboy"
              className="motoboy-qr-image"
            />
          ) : (
            <div className="motoboy-qr-placeholder">
              QR Code indisponível
            </div>
          )}
        </div>

        <div className="motoboy-qr-info">
          <div className="motoboy-qr-name">{motoboy?.name || "Motoboy"}</div>
          <div className="motoboy-qr-token">{motoboy?.qrToken || "--"}</div>
          <div className="motoboy-qr-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopy}
            >
              {copyLabel}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MotoboyQrModal;
