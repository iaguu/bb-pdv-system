import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import Modal from '../common/Modal';
import { OrderIcon } from './OrderIcons';
import { emitToast } from '../../utils/toast';
import ProductPickerModal from './ProductPickerModal';
import OrderItemsModal from './modals/OrderItemsModal';
import CustomerInfoModal from './modals/CustomerInfoModal';
import DeliveryAddressModal from './modals/DeliveryAddressModal';
import OrderStatusModal from './modals/OrderStatusModal';
import OrderSummaryModal from './modals/OrderSummaryModal';
import PaymentModal from './modals/PaymentModal';
import OrderOptionsModal from './modals/OrderOptionsModal';
import CustomerHistoryModal from './modals/CustomerHistoryModal';

const customerSchema = z.object({
  customerName: z.string().min(1, 'Informe o nome do cliente'),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional()
});

const OrderFormModal = ({ isOpen, onClose, onConfirm, formatCurrency, initialOrder }) => {
  // Estados do Formulrio
  const [items, setItems] = useState([]);
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [paymentMethod, setPaymentMethod] = useState('money');
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [notes, setNotes] = useState('');
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [orderStatus, setOrderStatus] = useState('open');
  const [cashGiven, setCashGiven] = useState('');

  // Estados de Busca de Produto
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [activeProductPickerType, setActiveProductPickerType] = useState('pizza');
  const [showPizzaModal, setShowPizzaModal] = useState(false);
  const [showDrinkModal, setShowDrinkModal] = useState(false);

  const [showOrderItemsModal, setShowOrderItemsModal] = useState(false);
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
  const [showDeliveryAddressModal, setShowDeliveryAddressModal] = useState(false);
  const [showOrderStatusModal, setShowOrderStatusModal] = useState(false);
  const [showOrderSummaryModal, setShowOrderSummaryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOrderOptionsModal, setShowOrderOptionsModal] = useState(false);
  const [showCustomerHistoryModal, setShowCustomerHistoryModal] = useState(false);
  
  const [pizzas, setPizzas] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [extras, setExtras] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [customerMode, setCustomerMode] = useState('registered');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [counterLabel, setCounterLabel] = useState('Balcao');
  const [selectedCustomerAddressId, setSelectedCustomerAddressId] = useState('primary');
  const [customerAltAddresses, setCustomerAltAddresses] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerAddress: ''
    }
  });

  const customerName = watch('customerName');
  const customerPhone = watch('customerPhone');
  const customerAddress = watch('customerAddress');

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => String(c.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  const normalizePaymentMethod = (value) => {
    const method = (value || '').toString().toLowerCase();
    if (method === 'credit_card' || method === 'credit') return 'credit';
    if (method === 'debit_card' || method === 'debit') return 'debit';
    if (method === 'card') return 'credit';
    if (method === 'pix') return 'pix';
    if (method === 'money') return 'money';
    if (method === 'to_define') return 'to_define';
    return 'money';
  };

  const toPaymentModalMethod = (method) => {
    if (method === 'credit' || method === 'debit') return 'card';
    return method || 'to_define';
  };

  const fromPaymentModalMethod = (method) => {
    if (method === 'card') return 'credit';
    return method || 'to_define';
  };

  const formatAddressLine = (address) => {
    if (!address) return '';
    const parts = [];
    if (address.street) {
      parts.push(address.number ? `${address.street}, ${address.number}` : address.street);
    }
    if (address.neighborhood) parts.push(address.neighborhood);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.cep) parts.push(address.cep);
    return parts.filter(Boolean).join(' - ');
  };

  const sectionMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: 'easeOut' }
  };

  const deliveryTypeLabel = deliveryType === 'delivery'
    ? 'Entrega'
    : deliveryType === 'pickup'
      ? 'Retirada'
      : 'Balcao';

  const paymentLabel = paymentMethod === 'money'
    ? 'Dinheiro'
    : paymentMethod === 'pix'
      ? 'PIX'
      : 'Cartao';

  const statusLabelMap = {
    open: 'Em aberto',
    preparing: 'Em preparo',
    ready: 'Pronto',
    out_for_delivery: 'Em entrega',
    done: 'Finalizado',
    cancelled: 'Cancelado'
  };
  const statusLabel = statusLabelMap[orderStatus] || 'Em aberto';

  // Inicializao (Novo ou Edio)
  useEffect(() => {
    if (initialOrder) {
      const initialCustomer = initialOrder.customerSnapshot || initialOrder.customer || { name: '', phone: '', address: '' };
      reset({
        customerName: initialCustomer.name || '',
        customerPhone: initialCustomer.phone || '',
        customerAddress: typeof initialCustomer.address === 'string'
          ? initialCustomer.address
          : formatAddressLine(initialCustomer.address)
      });
      setItems(initialOrder.items || []);
      setDeliveryType(initialOrder.type || 'delivery');
      setPaymentMethod(normalizePaymentMethod(initialOrder.payment?.method || initialOrder.paymentMethod || 'money'));
      const initialDiscount = Number(initialOrder.totals?.discount || 0);
      setDiscountType(initialDiscount > 0 ? 'value' : 'none');
      setDiscountValue(String(initialDiscount || 0));
      setDeliveryFee(initialOrder.totals?.deliveryFee || 0);
      setNotes(initialOrder.orderNotes || '');
      setKitchenNotes(initialOrder.kitchenNotes || '');
      setOrderStatus(initialOrder.status || 'open');
      const initialAddress =
        initialOrder.delivery?.address ||
        initialOrder.customerSnapshot?.address ||
        initialOrder.customer?.address ||
        null;
      if (initialAddress) {
        const normalized = typeof initialAddress === 'string' ? { street: initialAddress } : initialAddress;
        setDeliveryAddress(normalized);
      } else {
        setDeliveryAddress(null);
      }
    } else {
      reset({
        customerName: '',
        customerPhone: '',
        customerAddress: ''
      });
      setItems([]);
      setDeliveryType('delivery');
      setPaymentMethod('money');
      setDiscountType('none');
      setDiscountValue('0');
      setDeliveryFee(0);
      setNotes('');
      setKitchenNotes('');
      setOrderStatus('open');
      setDeliveryAddress(null);
    }
  }, [initialOrder, isOpen, reset]);

  // Carregar produtos do DataEngine
  useEffect(() => {
    const loadProducts = async () => {
      if (window.dataEngine && isOpen) {
        try {
          const data = await window.dataEngine.get('products');
          const loadedProducts = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
          
          setPizzas(loadedProducts.filter(p => p.type === 'pizza' || (p.category || '').toLowerCase().includes('pizza')));
          setDrinks(loadedProducts.filter(p => p.type === 'drink' || (p.category || '').toLowerCase().includes('bebida')));
          setExtras(loadedProducts.filter(p => p.type === 'extra'));
        } catch (e) {
          console.error("Erro ao carregar produtos:", e);
        }
      }
    };
    loadProducts();
  }, [isOpen]);

  useEffect(() => {
    if (showPizzaModal) {
      setActiveProductPickerType('pizza');
      setShowProductPicker(true);
      setShowPizzaModal(false);
    }
  }, [showPizzaModal]);

  useEffect(() => {
    if (showDrinkModal) {
      setActiveProductPickerType('drink');
      setShowProductPicker(true);
      setShowDrinkModal(false);
    }
  }, [showDrinkModal]);

  useEffect(() => {
    const loadCustomersAndOrders = async () => {
      if (!window.dataEngine || !isOpen) return;
      try {
        const [customersData, ordersData] = await Promise.all([
          window.dataEngine.get('customers'),
          window.dataEngine.get('orders')
        ]);
        const loadedCustomers = Array.isArray(customersData?.items)
          ? customersData.items
          : (Array.isArray(customersData) ? customersData : []);
        const loadedOrders = Array.isArray(ordersData?.items)
          ? ordersData.items
          : (Array.isArray(ordersData) ? ordersData : []);
        setCustomers(loadedCustomers);
        setAllOrders(loadedOrders);
        if (!loadedCustomers.length) {
          setCustomerMode('counter');
        }
      } catch (e) {
        console.error("Erro ao carregar clientes/pedidos:", e);
      }
    };
    loadCustomersAndOrders();
  }, [isOpen]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setValue('customerName', selectedCustomer.name || '');
    setValue('customerPhone', selectedCustomer.phone || '');
    setValue('customerAddress', selectedCustomer.address ? formatAddressLine(selectedCustomer.address) : '');
    setCustomerAltAddresses(Array.isArray(selectedCustomer.addresses) ? selectedCustomer.addresses : []);
    setSelectedCustomerAddressId('primary');
    if (selectedCustomer.address) {
      setDeliveryAddress(selectedCustomer.address);
    }
  }, [selectedCustomer, setValue]);

  useEffect(() => {
    if (customerMode === 'counter') {
      setValue('customerName', counterLabel, { shouldValidate: true });
    }
  }, [customerMode, counterLabel, setValue]);

  useEffect(() => {
    if (deliveryType !== 'delivery' && Number(deliveryFee) !== 0) {
      setDeliveryFee(0);
    }
  }, [deliveryType, deliveryFee]);

  const handleAddressChange = (addressId) => {
    setSelectedCustomerAddressId(addressId);
    if (addressId === 'primary') {
      const primaryAddress = selectedCustomer?.address || deliveryAddress;
      if (primaryAddress) {
        setDeliveryAddress(primaryAddress);
        setValue('customerAddress', formatAddressLine(primaryAddress));
      }
      return;
    }
    const altAddress = customerAltAddresses.find((address) => String(address.id) === String(addressId));
    if (altAddress) {
      setDeliveryAddress(altAddress);
      setValue('customerAddress', formatAddressLine(altAddress));
    }
  };

  const handleNewAddress = (address) => {
    const newAddress = { ...address, id: `alt-${Date.now()}` };
    setCustomerAltAddresses((prev) => [...prev, newAddress]);
    setSelectedCustomerAddressId(newAddress.id);
    setDeliveryAddress(newAddress);
    setValue('customerAddress', formatAddressLine(newAddress));
  };

  const handleDiscountValueChange = (value) => {
    setDiscountValue(value);
  };

  // Aes de Itens
  const handleAddItem = (newItem) => {
    setItems([...items, newItem]);
    setShowProductPicker(false);
  };

  const removeItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const updateItemQuantity = (index, delta) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    const newQty = Math.max(1, item.quantity + delta);
    item.quantity = newQty;
    item.total = item.unitPrice * newQty;
    newItems[index] = item;
    setItems(newItems);
  };

  const handleEditItem = (index) => {
    // Placeholder para edio futura
    emitToast({ type: 'info', message: 'Edio de item em breve.' });
  };

  // Clculos
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = discountType === 'percent'
    ? subtotal * (Number(discountValue) / 100)
    : Number(discountValue);
  const finalTotal = Math.max(0, subtotal + Number(deliveryFee) - Number(discountAmount));

  const submitForm = (options = {}) => {
    handleSubmit(
      (values) => {
        if (items.length === 0) {
          emitToast({ type: 'warning', message: 'Adicione pelo menos um item ao pedido.' });
          return;
        }
      const nameValue = customerMode === 'counter' ? counterLabel : values.customerName;
      if (!nameValue) {
        emitToast({ type: 'warning', message: 'Informe o nome do cliente.' });
        return;
      }

      const customerSnapshot = {
        name: nameValue,
        phone: values.customerPhone || '',
        address: deliveryAddress || values.customerAddress || ''
      };

      const deliveryPayload = deliveryAddress
        ? { ...(initialOrder?.delivery || {}), address: deliveryAddress }
        : initialOrder?.delivery;

      const draft = {
        ...initialOrder,
        customerSnapshot,
        items,
        type: deliveryType,
        payment: { method: paymentMethod },
        subtotal,
        deliveryFee: Number(deliveryFee),
        discount: Number(discountAmount),
        total: finalTotal,
        totals: {
          subtotal,
          deliveryFee: Number(deliveryFee),
          discount: Number(discountAmount),
          finalTotal
        },
        orderNotes: notes,
        kitchenNotes,
        status: orderStatus || initialOrder?.status || 'open',
        delivery: deliveryPayload
      };
      onConfirm(draft, options);
      },
      (formErrors) => {
        if (formErrors.customerName) {
          emitToast({ type: 'warning', message: 'Informe o nome do cliente.' });
        }
      }
    )();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="orderform-modal"
      size="lg"
      title={initialOrder ? 'Editar Pedido' : 'Novo Pedido'}
      footer={(
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => submitForm()}>
            {initialOrder ? 'Salvar Alteraes' : 'Criar Pedido'}
          </button>
          <button className="btn btn-success" onClick={() => submitForm({ action: 'save_and_print' })}>
            Salvar e Imprimir
          </button>
        </>
      )}
    >
      <input type="hidden" {...register('customerName')} />
      <input type="hidden" {...register('customerPhone')} />
      <input type="hidden" {...register('customerAddress')} />

      <div className="orderform-modular-grid">
        <motion.div {...sectionMotion} className="modular-card customer-card">
          <div className="card-header">
            <h3>
              <OrderIcon name="user" /> Cliente
            </h3>
          </div>
          <div className="card-content">
            <div className="summary-label">Nome</div>
            <div className="summary-value">{customerName || 'Nao informado'}</div>
            <div className="summary-meta">Telefone: {customerPhone || '-'}</div>
            {errors.customerName && (
              <div className="field-error-text">{errors.customerName.message}</div>
            )}
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-outline btn-block" onClick={() => setShowCustomerInfoModal(true)}>
              <OrderIcon name="user" /> Editar cliente
            </button>
            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={() => setShowCustomerHistoryModal(true)}
              disabled={!selectedCustomer}
            >
              <OrderIcon name="summary" /> Historico
            </button>
          </div>
        </motion.div>

        <motion.div {...sectionMotion} className="modular-card address-card">
          <div className="card-header">
            <h3>
              <OrderIcon name="pin" /> Endereco
            </h3>
          </div>
          <div className="card-content">
            <div className="summary-label">Endereco ativo</div>
            <div className="summary-value">{customerAddress || 'Nao informado'}</div>
            <div className="summary-meta">Tipo: {deliveryTypeLabel}</div>
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-outline btn-block" onClick={() => setShowDeliveryAddressModal(true)}>
              <OrderIcon name="pin" /> Gerenciar endereco
            </button>
          </div>
        </motion.div>

        <motion.div {...sectionMotion} className="modular-card">
          <div className="card-header">
            <h3>
              <OrderIcon name="pizza" /> Itens
            </h3>
          </div>
          <div className="card-content">
            <div className="summary-label">Itens no pedido</div>
            <div className="summary-value">{items.length}</div>
            <div className="summary-meta">Subtotal: {formatCurrency(subtotal)}</div>
          </div>
          <div className="card-actions">
            <div className="btn-group">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setActiveProductPickerType('pizza');
                  setShowProductPicker(true);
                }}
              >
                <OrderIcon name="plus" /> Pizza
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setActiveProductPickerType('drink');
                  setShowProductPicker(true);
                }}
              >
                <OrderIcon name="plus" /> Bebida
              </button>
            </div>
            <button type="button" className="btn btn-outline btn-block" onClick={() => setShowOrderItemsModal(true)}>
              <OrderIcon name="edit" /> Editar itens
            </button>
          </div>
        </motion.div>

        <motion.div {...sectionMotion} className="modular-card">
          <div className="card-header">
            <h3>
              <OrderIcon name="payment" /> Pagamento
            </h3>
          </div>
          <div className="card-content">
            <div className="summary-label">Forma</div>
            <div className="summary-value">{paymentLabel}</div>
            <div className="summary-meta">Total: {formatCurrency(finalTotal)}</div>
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-outline btn-block" onClick={() => setShowPaymentModal(true)}>
              <OrderIcon name="payment" /> Editar pagamento
            </button>
          </div>
        </motion.div>

        <motion.div {...sectionMotion} className="modular-card">
          <div className="card-header">
            <h3>
              <OrderIcon name="options" /> Informacoes adicionais
            </h3>
          </div>
          <div className="card-content">
            <div className="summary-label">Desconto</div>
            <div className="summary-value">{formatCurrency(discountAmount)}</div>
            <div className="summary-meta">Observacoes: {(notes || kitchenNotes) ? 'Sim' : 'Nao'}</div>
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-outline btn-block" onClick={() => setShowOrderOptionsModal(true)}>
              <OrderIcon name="options" /> Editar informacoes
            </button>
          </div>
        </motion.div>

        <motion.div {...sectionMotion} className="modular-card status-card">
          <div className="card-header">
            <h3>
              <OrderIcon name="status" /> Status
            </h3>
          </div>
          <div className="card-content">
            <div className="summary-label">Status atual</div>
            <div className="summary-value">{statusLabel}</div>
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-outline btn-block" onClick={() => setShowOrderStatusModal(true)}>
              <OrderIcon name="status" /> Editar status
            </button>
          </div>
        </motion.div>

        <motion.div {...sectionMotion} className="modular-card summary-card">
          <div className="card-header">
            <h3>
              <OrderIcon name="summary" /> Resumo
            </h3>
          </div>
          <div className="card-content">
            <div className="summary-row">
              <span className="label">Subtotal</span>
              <span className="value">{formatCurrency(subtotal)}</span>
            </div>
            <div className="summary-row">
              <span className="label">Entrega</span>
              <span className="value">{formatCurrency(Number(deliveryFee) || 0)}</span>
            </div>
            <div className="summary-row">
              <span className="label">Desconto</span>
              <span className="value">-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="summary-row">
              <span className="label">Total</span>
              <span className="value highlight">{formatCurrency(finalTotal)}</span>
            </div>
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn-outline btn-block" onClick={() => setShowOrderSummaryModal(true)}>
              <OrderIcon name="summary" /> Ver resumo
            </button>
          </div>
        </motion.div>
      </div>

      {showProductPicker && (
        <ProductPickerModal
          isOpen={true}
          initialType={activeProductPickerType}
          onClose={() => { setShowProductPicker(false); }}
          onAddItem={handleAddItem}
          pizzas={pizzas}
          drinks={drinks}
          extras={extras}
          formatCurrency={formatCurrency}
        />
      )}

      {showOrderItemsModal && (
        <OrderItemsModal
          isOpen={true}
          onClose={() => setShowOrderItemsModal(false)}
          orderItems={items}
          setOrderItems={setItems}
          pizzaCatalog={pizzas}
          drinkCatalog={drinks}
          extraCatalog={extras}
          formatCurrency={formatCurrency}
          showPizzaModal={showPizzaModal}
          setShowPizzaModal={setShowPizzaModal}
          showDrinkModal={showDrinkModal}
          setShowDrinkModal={setShowDrinkModal}
        />
      )}

      {showCustomerInfoModal && (
        <CustomerInfoModal
          isOpen={true}
          onClose={() => setShowCustomerInfoModal(false)}
          customerMode={customerMode}
          selectedCustomer={selectedCustomer}
          customers={customers}
          counterLabel={counterLabel}
          onCustomerChange={(customerId) => setSelectedCustomerId(customerId)}
          onCustomerModeChange={setCustomerMode}
          onCounterLabelChange={setCounterLabel}
        />
      )}

      {showDeliveryAddressModal && (
        <DeliveryAddressModal
          isOpen={true}
          onClose={() => setShowDeliveryAddressModal(false)}
          activeCustomerAddress={selectedCustomer?.address || deliveryAddress}
          customerAltAddresses={customerAltAddresses}
          selectedCustomerAddressId={selectedCustomerAddressId}
          onAddressChange={handleAddressChange}
          onNewAddress={handleNewAddress}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          isOpen={true}
          onClose={() => setShowPaymentModal(false)}
          paymentMethod={toPaymentModalMethod(paymentMethod)}
          onPaymentMethodChange={(method) => setPaymentMethod(fromPaymentModalMethod(method))}
          total={finalTotal}
          cashGiven={cashGiven}
          onCashGivenChange={setCashGiven}
          formatCurrency={formatCurrency}
        />
      )}

      {showOrderStatusModal && (
        <OrderStatusModal
          isOpen={true}
          onClose={() => setShowOrderStatusModal(false)}
          status={orderStatus}
          onStatusChange={(payload) => setOrderStatus(payload.status)}
        />
      )}

      {showOrderSummaryModal && (
        <OrderSummaryModal
          isOpen={true}
          onClose={() => setShowOrderSummaryModal(false)}
          orderItems={items}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          discountAmount={discountAmount}
          total={finalTotal}
          orderType={deliveryType}
          paymentMethod={toPaymentModalMethod(paymentMethod)}
          customerInfo={{ name: customerName, phone: customerPhone, address: customerAddress }}
          addressInfo={deliveryAddress}
          formatCurrency={formatCurrency}
        />
      )}

      {showOrderOptionsModal && (
        <OrderOptionsModal
          isOpen={true}
          onClose={() => setShowOrderOptionsModal(false)}
          orderType={deliveryType}
          onOrderTypeChange={setDeliveryType}
          discountType={discountType}
          discountValue={discountValue}
          onDiscountChange={setDiscountType}
          onDiscountValueChange={handleDiscountValueChange}
          deliveryFee={deliveryFee}
          onDeliveryFeeChange={setDeliveryFee}
          orderNotes={notes}
          kitchenNotes={kitchenNotes}
          onOrderNotesChange={setNotes}
          onKitchenNotesChange={setKitchenNotes}
        />
      )}

      {showCustomerHistoryModal && (
        <CustomerHistoryModal
          isOpen={true}
          onClose={() => setShowCustomerHistoryModal(false)}
          customer={selectedCustomer}
          orders={allOrders}
        />
      )}
    </Modal>
  );
};

export default OrderFormModal;

