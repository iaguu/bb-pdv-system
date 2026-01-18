import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import Modal from "../../common/Modal";
import CustomerFormModal from "../../people/CustomerFormModal";
import { OrderIcon } from "../OrderIcons";

export default function CustomerInfoModal({
  isOpen,
  onClose,
  customerMode,
  selectedCustomer,
  customers,
  counterLabel,
  onCustomerChange,
  onCustomerModeChange,
  onCounterLabelChange,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const bodyMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: "easeOut" }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm("");
    setShowCustomerForm(false);
  }, [isOpen]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    
    const term = searchTerm.toLowerCase();
    return customers.filter(customer => 
      customer.name?.toLowerCase().includes(term) ||
      customer.phone?.includes(term) ||
      customer.cpf?.includes(term)
    );
  }, [customers, searchTerm]);

  const handleSelectCustomer = (customerId) => {
    onCustomerChange(customerId);
    onClose();
  };

  const handleCreateNewCustomer = () => {
    setShowCustomerForm(true);
  };

  const handleCustomerCreated = (newCustomer) => {
    setShowCustomerForm(false);
    // Aqui voce pode adicionar logica para atualizar a lista de clientes
    // ou selecionar automaticamente o novo cliente criado
    if (onCustomerChange && newCustomer && newCustomer.id) {
      onCustomerChange(newCustomer.id);
    }
  };

  const handleSwitchMode = (mode) => {
    onCustomerModeChange(mode);
    if (mode === "counter") {
      setSearchTerm("");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="orderform-modal" size="lg">
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">Informacoes do Cliente</div>
          <div className="modal-title">Gerenciar Cliente</div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          <OrderIcon name="close" />
        </button>
      </div>

      <motion.div className="modal-body" {...bodyMotion}>
        {/* Customer Mode Selection */}
        <div className="modal-section">
          <div className="modal-section-title">Tipo de Cliente<span className="hint-dot" data-tooltip="Escolha entre cliente cadastrado ou balcao.">?</span></div>
          <div className="field-pill-group">
            <button
              type="button"
              className={`field-pill ${customerMode === "registered" ? "field-pill-active" : ""}`}
              onClick={() => handleSwitchMode("registered")}
            >
              <OrderIcon name="user" />
              Cliente Cadastrado
            </button>
            <button
              type="button"
              className={`field-pill ${customerMode === "counter" ? "field-pill-active" : ""}`}
              onClick={() => handleSwitchMode("counter")}
            >
              <OrderIcon name="store" />
              Balcao / Rapido
            </button>
          </div>
        </div>

        {/* Registered Customer Section */}
        {customerMode === "registered" && (
          <div className="modal-section">
            <div className="modal-section-header-row">
              <div className="modal-section-title">Selecionar Cliente</div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateNewCustomer}
              >
                <OrderIcon name="plus" />
                Novo Cliente
              </button>
            </div>

            {/* Search */}
            <div className="field-label">Buscar Cliente</div>
            <input
              type="text"
              className="field-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, telefone ou CPF..."
            />

            {/* Customer List */}
            <div className="customer-list">
              {filteredCustomers.length === 0 ? (
                <div className="empty">
                  {searchTerm ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
                </div>
              ) : (
                filteredCustomers.map(customer => (
                  <button
                    key={customer.id}
                    type="button"
                    className={`customer-item ${
                      selectedCustomer?.id === customer.id ? "customer-item-active" : ""
                    }`}
                    onClick={() => handleSelectCustomer(customer.id)}
                  >
                    <div className="customer-item-name">{customer.name || "Sem nome"}</div>
                    <div className="customer-item-meta">
                      {customer.phone && (
                        <span>
                          <OrderIcon name="phone" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.cpf && (
                        <span>
                          <OrderIcon name="id" />
                          {customer.cpf}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Counter Customer Section */}
        {customerMode === "counter" && (
          <div className="modal-section">
            <div className="modal-section-title">Cliente de Balcao</div>
            <div className="field-label">
              Identificacao
              <span className="field-helper">Mostrado nos relatorios e na cozinha</span>
            </div>
            <input
              type="text"
              className="field-input"
              value={counterLabel || ""}
              onChange={(e) => onCounterLabelChange(e.target.value)}
              placeholder="Ex: Balcao, Mesa 2, Cliente Local..."
            />
            
            <div className="alert alert-info">
              <strong>Cliente de Balcao</strong><br />
              Use esta opcao para vendas rapidas onde nao e necessario cadastrar o cliente. 
              A identificacao sera usada apenas para controle interno.
            </div>
          </div>
        )}

        {/* Selected Customer Info */}
        {selectedCustomer && customerMode === "registered" && (
          <div className="modal-section">
            <div className="modal-section-title">Cliente Selecionado</div>
            <div className="selected-customer-card">
              <div className="selected-customer-header">
                <div className="selected-customer-name">{selectedCustomer.name}</div>
                <span className="modal-badge modal-badge--success">Selecionado</span>
                <div className="selected-customer-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => onCustomerChange(null)}
                  >
                    <OrderIcon name="close" />
                    Limpar Selecao
                  </button>
                </div>
              </div>
              <div className="selected-customer-details">
                {selectedCustomer.phone && (
                  <div className="detail-row">
                    <span className="detail-label">Telefone:</span>
                    <span className="detail-value">{selectedCustomer.phone}</span>
                  </div>
                )}
                {selectedCustomer.cpf && (
                  <div className="detail-row">
                    <span className="detail-label">CPF:</span>
                    <span className="detail-value">{selectedCustomer.cpf}</span>
                  </div>
                )}
                {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Enderecos:</span>
                    <span className="detail-value">{selectedCustomer.addresses.length} cadastrado(s)</span>
                  </div>
                )}
              </div>
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
          Confirmar Cliente
        </button>
      </div>

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerFormModal
          isOpen={true}
          onClose={() => setShowCustomerForm(false)}
          onSaved={handleCustomerCreated}
        />
      )}
    </Modal>
  );
}

