import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Modal from "../../common/Modal";
import MapLink, { EmbeddedMap, DeliveryInfo } from "../../common/MapLink";
import { OrderIcon } from "../OrderIcons";

export default function DeliveryAddressModal({
  isOpen,
  onClose,
  activeCustomerAddress,
  customerAltAddresses,
  selectedCustomerAddressId,
  onAddressChange,
  onNewAddress,
  storeAddress = {
    street: "Rua das Pizzas",
    number: "123",
    neighborhood: "Centro",
    city: "Sao Paulo",
    state: "SP",
    cep: "01234-567"
  },
}) {
  const defaultNewAddress = {
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    reference: "",
  };
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState(defaultNewAddress);
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  useEffect(() => {
    if (!isOpen) return;
    setShowNewAddressForm(false);
    setNewAddress(defaultNewAddress);
  }, [isOpen]);

  const handleSelectAddress = (addressId) => {
    onAddressChange(addressId);
  };

  const handleCreateNewAddress = () => {
    setShowNewAddressForm(true);
  };

  const handleSaveNewAddress = () => {
    // Basic validation
    if (!newAddress.street || !newAddress.number || !newAddress.neighborhood) {
      alert("Preencha os campos obrigatorios: rua, numero e bairro");
      return;
    }
    
    onNewAddress(newAddress);
    setNewAddress(defaultNewAddress);
    setShowNewAddressForm(false);
  };

  const formatAddress = (address) => {
    if (!address) return "Endereco nao definido";
    
    const parts = [];
    if (address.street) parts.push(`${address.street}, ${address.number}`);
    if (address.complement) parts.push(`(${address.complement})`);
    if (address.neighborhood) parts.push(address.neighborhood);
    if (address.city && address.state) parts.push(`${address.city}/${address.state}`);
    
    return parts.join(" - ");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="orderform-modal" size="lg">
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">Endereco de Entrega</div>
          <div className="modal-title">Gerenciar Endereco</div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <OrderIcon name="close" />
        </button>
      </div>

      <motion.div className="modal-body" {...bodyMotion}>
        {/* Address Selection */}
        <div className="modal-section">
          <div className="modal-section-header-row">
            <div className="modal-section-title">Selecionar Endereco</div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateNewAddress}
            >
              <OrderIcon name="plus" />
              Novo Endereco
            </button>
          </div>

          {/* Primary Address */}
          <div className="address-option">
            <label className="address-radio">
              <input
                type="radio"
                name="address"
                checked={selectedCustomerAddressId === "primary"}
                onChange={() => handleSelectAddress("primary")}
              />
              <div className="address-card">
                <div className="address-header">
                  <span className="address-type">
                    <OrderIcon name="home" />
                    Endereco Principal
                  </span>
                  {selectedCustomerAddressId === "primary" && (
                    <span className="address-selected">
                        <OrderIcon name="check" />
                        Selecionado
                      </span>
                  )}
                </div>
                <div className="address-content">
                  {formatAddress(activeCustomerAddress)}
                </div>
                
                {/* Map and Route Info for Primary Address */}
                {activeCustomerAddress && (
                  <div className="address-map-section">
                    <MapLink
                      address={activeCustomerAddress}
                      storeAddress={storeAddress}
                      type="delivery"
                      size="sm"
                    />
                    <DeliveryInfo
                      storeAddress={storeAddress}
                      customerAddress={activeCustomerAddress}
                    />
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Alternative Addresses */}
          {customerAltAddresses && customerAltAddresses.length > 0 && (
            <div className="address-list">
              <div className="field-label">Enderecos Alternativos</div>
              {customerAltAddresses.map(address => (
                <div key={address.id} className="address-option">
                  <label className="address-radio">
                    <input
                      type="radio"
                      name="address"
                      checked={selectedCustomerAddressId === address.id}
                      onChange={() => handleSelectAddress(address.id)}
                    />
                    <div className="address-card">
                      <div className="address-header">
                        <span className="address-type">
                        <OrderIcon name="pin" />
                        {address.label || address.apelido || "Alternativo"}
                      </span>
                        {selectedCustomerAddressId === address.id && (
                          <span className="address-selected">
                        <OrderIcon name="check" />
                        Selecionado
                      </span>
                        )}
                      </div>
                      <div className="address-content">
                        {formatAddress(address)}
                      </div>
                      {address.cep && (
                        <div className="address-meta">
                          <span className="address-cep">CEP: {address.cep}</span>
                        </div>
                      )}
                      
                      {/* Map and Route Info for Alternative Address */}
                      <div className="address-map-section">
                        <MapLink
                          address={address}
                          storeAddress={storeAddress}
                          type="delivery"
                          size="sm"
                        />
                        <DeliveryInfo
                          storeAddress={storeAddress}
                          customerAddress={address}
                        />
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Address Form */}
        {showNewAddressForm && (
          <div className="modal-section">
            <div className="modal-section-title">Novo Endereco</div>
            
            <div className="address-form-grid">
              <div className="form-row">
                <label className="field">
                  <span className="field-label">Rua *</span>
                  <input
                    type="text"
                    className="field-input"
                    value={newAddress.street}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, street: e.target.value }))}
                    placeholder="Nome da rua"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Numero *</span>
                  <input
                    type="text"
                    className="field-input"
                    value={newAddress.number}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, number: e.target.value }))}
                    placeholder="123"
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="field">
                  <span className="field-label">Complemento</span>
                  <input
                    type="text"
                    className="field-input"
                    value={newAddress.complement}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, complement: e.target.value }))}
                    placeholder="Apto 101, Casa 2, etc."
                  />
                </label>
                <label className="field">
                  <span className="field-label">Bairro *</span>
                  <input
                    type="text"
                    className="field-input"
                    value={newAddress.neighborhood}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, neighborhood: e.target.value }))}
                    placeholder="Centro"
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="field">
                  <span className="field-label">Cidade *</span>
                  <input
                    type="text"
                    className="field-input"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Sao Paulo"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Estado *</span>
                  <input
                    type="text"
                    className="field-input"
                    value={newAddress.state}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="SP"
                    maxLength={2}
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="field">
                  <span className="field-label">CEP</span>
                  <input
                    type="text"
                    className="field-input"
                    value={newAddress.cep}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, cep: e.target.value }))}
                    placeholder="00000-000"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Referencia</span>
                  <input
                    type="text"
                    className="field-input"
                    value={newAddress.reference}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="Proximo ao mercado verde"
                  />
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowNewAddressForm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveNewAddress}
              >
                Salvar Endereco
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onClose}
        >
          Confirmar Endereco
        </button>
      </div>
    </Modal>
  );
}

