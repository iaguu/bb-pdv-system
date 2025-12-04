// src/renderer/components/orders/NewOrderModal.jsx
import React, { useEffect, useMemo, useState } from "react";

function digitsOnly(s) {
  return (s || "").replace(/\D/g, "");
}

// Normaliza coleção de produtos vinda do DataEngine
// Aceita:
// - { items: [...] }
// - { products: [...] }
// - [ ... ]
function normalizeProductsCollection(raw) {
  let arr = [];

  if (!raw) return [];

  if (Array.isArray(raw.items)) {
    arr = raw.items;
  } else if (Array.isArray(raw.products)) {
    arr = raw.products;
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    arr = [];
  }

  // Só pizzas, e normalização de campos
  return arr
    .filter((p) => {
      const type = (p.type || "").toLowerCase();
      // Se tiver type, usa; se não tiver, assume pizza como default
      if (!type) return true;
      return type === "pizza";
    })
    .map((p, index) => {
      const id = p.id || `pizza-${index + 1}`;
      const name = p.name || p.nome || "Pizza sem nome";

      // Aceita tanto priceBroto/priceGrande quanto preco_broto/preco_grande
      const priceBroto =
        p.priceBroto ??
        p.preco_broto ??
        0;
      const priceGrande =
        p.priceGrande ??
        p.preco_grande ??
        0;

      return {
        id,
        name,
        description: p.description || "",
        prices: {
          broto: Number(priceBroto) || 0,
          grande: Number(priceGrande) || 0,
        },
      };
    })
    .filter((p) => p.prices.broto > 0 || p.prices.grande > 0);
}

function findPizza(id, catalog) {
  return catalog.find((p) => String(p.id) === String(id));
}

export default function NewOrderModal({
  isOpen,
  onClose,
  onConfirm,
  formatCurrency,
}) {
  // -----------------------------
  // Estado vindo do DB
  // -----------------------------
  const [customers, setCustomers] = useState([]);
  const [pizzaCatalog, setPizzaCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // -----------------------------
  // Cliente
  // -----------------------------
  const [customerMode, setCustomerMode] = useState("registered"); // registered | counter
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(true);
  const [counterLabel, setCounterLabel] = useState("Balcão");

  // -----------------------------
  // Pizza atual (editor)
  // -----------------------------
  const [size, setSize] = useState("grande");
  const [quantity, setQuantity] = useState(1);
  const [flavorSearch, setFlavorSearch] = useState("");
  const [flavor1, setFlavor1] = useState("");
  const [flavor2, setFlavor2] = useState("");
  const [twoFlavorsEnabled, setTwoFlavorsEnabled] = useState(false);

  // -----------------------------
  // Itens (múltiplas pizzas)
  // -----------------------------
  const [orderItems, setOrderItems] = useState([]);

  // -----------------------------
  // Dados adicionais do pedido
  // -----------------------------
  const [status] = useState("open"); // padrão: em aberto
  const [orderType, setOrderType] = useState("delivery"); // delivery | counter
  const [paymentMethod, setPaymentMethod] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [discountType, setDiscountType] = useState("none"); // none | value | percent
  const [discountValue, setDiscountValue] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");
  const [kitchenNotes, setKitchenNotes] = useState("");

  // -----------------------------
  // Load do banco
  // -----------------------------
  useEffect(() => {
    if (!isOpen) return;

    let cancel = false;

    async function load() {
      setIsLoading(true);
      setLoadError("");

      try {
        if (!window.dataEngine) {
          throw new Error("API local window.dataEngine não encontrada.");
        }

        const [customersDb, productsDb] = await Promise.all([
          window.dataEngine.get("customers"),
          window.dataEngine.get("products"),
        ]);

        if (cancel) return;

        const customersArr = Array.isArray(customersDb?.items)
          ? customersDb.items
          : Array.isArray(customersDb)
          ? customersDb
          : [];

        const pizzas = normalizeProductsCollection(productsDb);

        setCustomers(customersArr);
        setPizzaCatalog(pizzas);

        // resets gerais
        setCustomerMode(customersArr.length ? "registered" : "counter");
        setCustomerSearch("");
        setSelectedCustomerId(null);
        setShowCustomerSearch(true);
        setCounterLabel("Balcão");

        setFlavorSearch("");
        setTwoFlavorsEnabled(false);
        setSize("grande");
        setQuantity(1);
        setFlavor2("");
        setOrderItems([]);

        setOrderType("delivery");
        setPaymentMethod("");
        setDeliveryFee("0");
        setDiscountType("none");
        setDiscountValue("0");
        setOrderNotes("");
        setKitchenNotes("");

        if (pizzas.length > 0) {
          setFlavor1(pizzas[0].id);
        } else {
          setFlavor1("");
        }
      } catch (err) {
        console.error("[NewOrderModal] load error:", err);
        if (!cancel) setLoadError(err.message || "Erro ao carregar dados.");
      } finally {
        if (!cancel) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancel = true;
    };
  }, [isOpen]);

  // -----------------------------
  // Filtro de clientes
  // -----------------------------
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;

    const digits = digitsOnly(term);

    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const cpf = (c.cpf || "").toLowerCase();

      return (
        name.includes(term) ||
        phone.includes(term) ||
        cpf.includes(term) ||
        digitsOnly(c.phone || "").includes(digits) ||
        digitsOnly(c.cpf || "").includes(digits)
      );
    });
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customers]);

  // -----------------------------
  // Filtro de pizzas
  // -----------------------------
  const filteredPizzas = useMemo(() => {
    const t = flavorSearch.trim().toLowerCase();
    if (!t) return pizzaCatalog;

    return pizzaCatalog.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(t) ||
        (p.description || "").toLowerCase().includes(t)
    );
  }, [pizzaCatalog, flavorSearch]);

  // -----------------------------
  // Preço unitário da pizza atual
  // -----------------------------
  const unitPrice = useMemo(() => {
    const p1 = findPizza(flavor1, pizzaCatalog);
    if (!p1) return 0;

    const price1 = p1.prices[size] || 0;

    if (!twoFlavorsEnabled || !flavor2) return price1;

    const p2 = findPizza(flavor2, pizzaCatalog);
    const price2 = p2?.prices[size] || 0;

    // regra: metade/metade cobra o MAIOR valor
    return Math.max(price1, price2);
  }, [flavor1, flavor2, size, pizzaCatalog, twoFlavorsEnabled]);

  // -----------------------------
  // Adicionar pizza à lista
  // -----------------------------
  const handleAddPizza = () => {
    if (!pizzaCatalog.length) {
      alert("Nenhuma pizza cadastrada.");
      return;
    }

    const q = Number(quantity) || 0;
    if (q <= 0) {
      alert("Quantidade inválida.");
      return;
    }

    const pizza1 = findPizza(flavor1, pizzaCatalog);
    if (!pizza1) {
      alert("Selecione o sabor 1.");
      return;
    }

    let pizza2 = null;
    if (twoFlavorsEnabled) {
      if (!flavor2) {
        alert("Selecione o sabor 2 ou desative a opção de dois sabores.");
        return;
      }
      pizza2 = findPizza(flavor2, pizzaCatalog);
      if (!pizza2) {
        alert("Sabor 2 inválido.");
        return;
      }
    }

    const sizeLabel = size === "broto" ? "Broto" : "Grande";
    const lineUnit = unitPrice;
    const lineTotal = lineUnit * q;

    const newItem = {
      lineId: `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      size,
      sizeLabel,
      quantity: q,
      flavor1Id: pizza1.id,
      flavor1Name: pizza1.name,
      flavor2Id: pizza2?.id || null,
      flavor2Name: pizza2?.name || null,
      twoFlavors: !!pizza2,
      unitPrice: lineUnit,
      total: lineTotal,
    };

    setOrderItems((prev) => [...prev, newItem]);

    // reset só da quantidade (e sabor 2)
    setQuantity(1);
    setTwoFlavorsEnabled(false);
    setFlavor2("");
  };

  const handleRemovePizza = (lineId) => {
    setOrderItems((prev) => prev.filter((it) => it.lineId !== lineId));
  };

  // -----------------------------
  // Totais
  // -----------------------------
  const subtotal = useMemo(
    () => orderItems.reduce((acc, it) => acc + (it.total || 0), 0),
    [orderItems]
  );

  const deliveryFeeNumber = useMemo(
    () => Number(String(deliveryFee).replace(",", ".")) || 0,
    [deliveryFee]
  );

  const discountRaw = useMemo(
    () => Number(String(discountValue).replace(",", ".")) || 0,
    [discountValue]
  );

  const discountAmount = useMemo(() => {
    if (discountType === "value") {
      return Math.min(discountRaw, subtotal + deliveryFeeNumber);
    }
    if (discountType === "percent") {
      if (discountRaw <= 0) return 0;
      const base = subtotal + deliveryFeeNumber;
      return (base * discountRaw) / 100;
    }
    return 0;
  }, [discountType, discountRaw, subtotal, deliveryFeeNumber]);

  const total = useMemo(
    () => Math.max(subtotal + deliveryFeeNumber - discountAmount, 0),
    [subtotal, deliveryFeeNumber, discountAmount]
  );

  // -----------------------------
  // Submit geral do pedido
  // -----------------------------
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!orderItems.length) {
      alert("Adicione pelo menos uma pizza ao pedido.");
      return;
    }

    let customerName = "";
    let customerId = null;
    let customerPhone = "";
    let customerCpf = "";
    let customerAddress = null;

    if (customerMode === "registered") {
      if (!selectedCustomer) {
        alert("Selecione um cliente ou troque para Balcão / rápido.");
        return;
      }
      customerId = selectedCustomer.id;
      customerName = selectedCustomer.name || "";
      customerPhone = selectedCustomer.phone || "";
      customerCpf = selectedCustomer.cpf || "";
      if (selectedCustomer.address) {
        const addr = selectedCustomer.address;
        customerAddress = {
          cep: addr.cep || "",
          street: addr.street || "",
          number: addr.number || "",
          complement: addr.complement || "",
          neighborhood: addr.neighborhood || "",
          city: addr.city || "",
          state: addr.state || "",
        };
      }
    } else {
      const label = (counterLabel || "").trim();
      if (!label) {
        alert("Informe uma identificação para Balcão / rápido.");
        return;
      }
      customerName = label;
    }

    const summaryLines = orderItems.map((item) => {
      if (item.twoFlavors && item.flavor2Name) {
        return `${item.quantity}x ${item.sizeLabel} ${item.flavor1Name} / ${item.flavor2Name}`;
      }
      return `${item.quantity}x ${item.sizeLabel} ${item.flavor1Name}`;
    });

    const summary = summaryLines.join(" | ");

    const draft = {
      status, // "open" → Em aberto
      orderType, // delivery | counter
      paymentMethod,
      customerMode,
      customerId,
      customerName,
      customerPhone,
      customerCpf,
      customerAddress,
      counterLabel: customerMode === "counter" ? counterLabel.trim() : null,
      items: orderItems,
      subtotal,
      deliveryFee: deliveryFeeNumber,
      discount: {
        type: discountType,
        value: discountRaw,
        amount: discountAmount,
      },
      total,
      orderNotes,
      kitchenNotes,
      summary,
    };

    onConfirm(draft);
  };

  if (!isOpen) return null;

  const hasCustomers = customers.length > 0;
  const hasPizzas = pizzaCatalog.length > 0;

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="modal-backdrop">
      <div className="modal-window neworder-modal">
        {/* HEADER */}
        <div className="modal-header">
          <div>
            <div className="modal-title">Novo pedido</div>
            <div className="modal-subtitle">
              Defina o cliente, adicione pizzas e finalize o pedido.
            </div>
            {isLoading && (
              <div className="modal-helper-text">
                Carregando clientes e produtos...
              </div>
            )}
            {loadError && <div className="modal-error-text">{loadError}</div>}
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {/* ===================== COLUNA ESQUERDA ===================== */}
          <div className="neworder-grid">
            <div className="neworder-column">
              {/* CLIENTE */}
              <div className="modal-section">
                <div className="modal-section-title">Cliente</div>

                <div className="field-label">Origem</div>
                <div className="field-pill-group">
                  <button
                    type="button"
                    className={
                      "field-pill" +
                      (customerMode === "registered"
                        ? " field-pill-active"
                        : "")
                    }
                    onClick={() => {
                      setCustomerMode("registered");
                      if (!selectedCustomerId) {
                        setShowCustomerSearch(true);
                      }
                    }}
                    disabled={!hasCustomers}
                  >
                    Clientes cadastrados
                  </button>

                  <button
                    type="button"
                    className={
                      "field-pill" +
                      (customerMode === "counter" ? " field-pill-active" : "")
                    }
                    onClick={() => {
                      setCustomerMode("counter");
                      setShowCustomerSearch(false);
                    }}
                  >
                    Balcão / rápido
                  </button>
                </div>

                {/* Cliente cadastrado → card resumido + botão trocar */}
                {customerMode === "registered" && selectedCustomer && (
                  <div className="customer-summary-card">
                    <div className="customer-summary-header">
                      <div>
                        <div className="customer-summary-name">
                          {selectedCustomer.name || "(Sem nome)"}
                        </div>
                        <div className="customer-summary-meta">
                          {selectedCustomer.phone && (
                            <span>📞 {selectedCustomer.phone}</span>
                          )}
                          {selectedCustomer.cpf && (
                            <span> • CPF: {selectedCustomer.cpf}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setShowCustomerSearch(true);
                        }}
                      >
                        Trocar cliente
                      </button>
                    </div>

                    {selectedCustomer.address && (
                      <div className="customer-summary-body">
                        <div>
                          {selectedCustomer.address.street &&
                            `${selectedCustomer.address.street}${
                              selectedCustomer.address.number
                                ? ", " + selectedCustomer.address.number
                                : ""
                            }`}
                        </div>
                        <div>
                          {selectedCustomer.address.neighborhood &&
                            selectedCustomer.address.neighborhood}
                          {selectedCustomer.address.city &&
                            ` - ${selectedCustomer.address.city}`}
                          {selectedCustomer.address.state &&
                            ` / ${selectedCustomer.address.state}`}
                        </div>
                        {selectedCustomer.address.cep && (
                          <div>CEP: {selectedCustomer.address.cep}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Lista de clientes + busca (só quando habilitado) */}
                {customerMode === "registered" &&
                  hasCustomers &&
                  showCustomerSearch && (
                    <div className="customer-list-block">
                      <div className="field-label">Buscar cliente</div>
                      <input
                        className="field-input"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Nome, telefone, CPF..."
                      />

                      <div className="neworder-customer-list">
                        {filteredCustomers.length === 0 && (
                          <div className="empty small">
                            Nenhum cliente encontrado.
                          </div>
                        )}

                        {filteredCustomers.map((c) => {
                          const isSelect = selectedCustomerId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={
                                "customer-item" +
                                (isSelect ? " customer-item-active" : "")
                              }
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setShowCustomerSearch(false);
                              }}
                            >
                              <div className="customer-item-name">
                                {c.name || "(Sem nome)"}
                              </div>
                              <div className="customer-item-meta">
                                {c.phone && <span>📞 {c.phone}</span>}
                                {c.cpf && <span> • CPF: {c.cpf}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Balcão */}
                {customerMode === "counter" && (
                  <div className="counter-block">
                    <div className="field-label">Identificação rápida</div>
                    <input
                      className="field-input"
                      value={counterLabel}
                      onChange={(e) => setCounterLabel(e.target.value)}
                      placeholder="Ex: Balcão, Mesa 2..."
                    />
                    <div className="field-helper">
                      Será mostrado nos relatórios e na cozinha.
                    </div>
                  </div>
                )}
              </div>

              {/* CONFIGURAÇÕES GERAIS DO PEDIDO */}
              <div className="modal-section">
                <div className="modal-section-title">Configurações</div>

                <div className="modal-grid-2">
                  <div>
                    <div className="field-label">Tipo de pedido</div>
                    <select
                      className="field-input"
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value)}
                    >
                      <option value="delivery">Entrega</option>
                      <option value="counter">Balcão / retirada</option>
                    </select>
                  </div>

                  <div>
                    <div className="field-label">Forma de pagamento</div>
                    <select
                      className="field-input"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="">Definir depois</option>
                      <option value="money">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="credit_card">Cartão crédito</option>
                      <option value="debit_card">Cartão débito</option>
                      <option value="vr">Vale refeição</option>
                    </select>
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div>
                    <div className="field-label">Taxa de entrega</div>
                    <input
                      className="field-input"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      placeholder="0,00"
                    />
                    <div className="field-helper">
                      Use 0 para pedidos de balcão ou retirada.
                    </div>
                  </div>

                  <div>
                    <div className="field-label">Desconto</div>
                    <div className="discount-row">
                      <select
                        className="field-input discount-type-select"
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                      >
                        <option value="none">Nenhum</option>
                        <option value="value">Valor (R$)</option>
                        <option value="percent">Percentual (%)</option>
                      </select>
                      {discountType !== "none" && (
                        <input
                          className="field-input discount-value-input"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder={
                            discountType === "value" ? "Ex: 10,00" : "Ex: 10"
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div>
                    <div className="field-label">Status do pedido</div>
                    <div className="status-chip status-chip-open">
                      Em aberto
                    </div>
                    <div className="field-helper">
                      Após salvar, o status pode ser alterado na tela de
                      Pedidos.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===================== COLUNA DIREITA ===================== */}
            <div className="neworder-column">
              {/* EDITOR DE PIZZA ATUAL */}
              <div className="modal-section">
                <div className="modal-section-title">Adicionar pizza</div>

                {!hasPizzas && (
                  <div className="alert alert-warning">
                    Cadastre pizzas na tela de Produtos para montar pedidos.
                  </div>
                )}

                <div className="modal-grid-2 pizza-grid-top">
                  <div>
                    <div className="field-label">Tamanho</div>
                    <div className="field-pill-group">
                      <button
                        type="button"
                        className={
                          "field-pill" +
                          (size === "broto" ? " field-pill-active" : "")
                        }
                        onClick={() => setSize("broto")}
                        disabled={!hasPizzas}
                      >
                        Broto
                      </button>
                      <button
                        type="button"
                        className={
                          "field-pill" +
                          (size === "grande" ? " field-pill-active" : "")
                        }
                        onClick={() => setSize("grande")}
                        disabled={!hasPizzas}
                      >
                        Grande
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="field-label">Quantidade</div>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      disabled={!hasPizzas}
                    />
                  </div>
                </div>

                <div className="pizza-search-and-select">
                  <div className="field-label">Sabor 1</div>

                  <div className="field-input-with-icon">
                    <span className="field-input-icon">🔍</span>
                    <input
                      className="field-input"
                      value={flavorSearch}
                      onChange={(e) => setFlavorSearch(e.target.value)}
                      placeholder="Buscar por nome ou ingrediente..."
                      disabled={!hasPizzas}
                    />
                  </div>

                  <select
                    className="field-input"
                    value={flavor1}
                    onChange={(e) => setFlavor1(e.target.value)}
                    disabled={!hasPizzas || filteredPizzas.length === 0}
                  >
                    {filteredPizzas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {`${p.name} — ${formatCurrency(
                          p.prices[size] || 0
                        )}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pizza-two-flavors-toggle">
                  <div className="field-label">Dois sabores (meio a meio)</div>
                  <button
                    type="button"
                    className={
                      "toggle-pill" +
                      (twoFlavorsEnabled ? " toggle-pill-active" : "")
                    }
                    onClick={() =>
                      setTwoFlavorsEnabled((prev) => {
                        const next = !prev;
                        if (!next) setFlavor2("");
                        return next;
                      })
                    }
                    disabled={!hasPizzas}
                  >
                    <span className="toggle-pill-knob" />
                    <span className="toggle-pill-label">
                      {twoFlavorsEnabled ? "Ativado" : "Desligado"}
                    </span>
                  </button>
                </div>

                {twoFlavorsEnabled && (
                  <div className="pizza-flavor-block">
                    <div className="field-label">Sabor 2</div>
                    <select
                      className="field-input"
                      value={flavor2}
                      onChange={(e) => setFlavor2(e.target.value)}
                      disabled={!hasPizzas || filteredPizzas.length === 0}
                    >
                      <option value="">Selecione</option>
                      {filteredPizzas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {`${p.name} — ${formatCurrency(
                            p.prices[size] || 0
                          )}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pizza-summary-chip-row">
                  <span className="chip chip-soft">
                    {quantity || 1}x {size === "broto" ? "Broto" : "Grande"}
                  </span>
                  {flavor1 && <span className="chip">Sabor principal</span>}
                  {twoFlavorsEnabled && flavor2 && (
                    <span className="chip chip-alt">Meio a meio</span>
                  )}
                  <span className="chip chip-outline">
                    Unitário: {formatCurrency(unitPrice)}
                  </span>
                </div>

                <div className="neworder-addline-footer">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleAddPizza}
                    disabled={!hasPizzas || isLoading}
                  >
                    + Adicionar pizza ao pedido
                  </button>
                </div>
              </div>

              {/* LISTA DE ITENS DO PEDIDO */}
              <div className="modal-section">
                <div className="modal-section-title">Itens do pedido</div>

                {orderItems.length === 0 && (
                  <div className="empty">
                    Nenhuma pizza adicionada ainda. Monte a pizza e clique em{" "}
                    <strong>“Adicionar pizza ao pedido”</strong>.
                  </div>
                )}

                {orderItems.length > 0 && (
                  <div className="order-items-list">
                    {orderItems.map((item) => (
                      <div
                        key={item.lineId}
                        className="order-item-row"
                      >
                        <div className="order-item-main">
                          <div className="order-item-title">
                            {item.quantity}x {item.sizeLabel}{" "}
                            {item.flavor1Name}
                            {item.twoFlavors && item.flavor2Name
                              ? ` / ${item.flavor2Name}`
                              : ""}
                          </div>
                          <div className="order-item-meta">
                            <span>
                              Unitário: {formatCurrency(item.unitPrice)}
                            </span>
                            <span>
                              Linha: {formatCurrency(item.total)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="order-item-remove"
                          onClick={() => handleRemovePizza(item.lineId)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RESUMO E OBSERVAÇÕES */}
              <div className="modal-section">
                <div className="modal-section-title">Resumo financeiro</div>

                <div className="order-totals-grid">
                  <div className="order-totals-row">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="order-totals-row">
                    <span>Taxa de entrega</span>
                    <span>{formatCurrency(deliveryFeeNumber)}</span>
                  </div>
                  <div className="order-totals-row">
                    <span>Desconto</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                  <div className="order-totals-row order-totals-row-total">
                    <span>Total do pedido</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <div className="modal-section">
                <div className="modal-section-title">Observações</div>
                <div className="modal-grid-2">
                  <div>
                    <div className="field-label">Observações gerais</div>
                    <textarea
                      className="field-input neworder-textarea"
                      rows={3}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ex: Entregar no portão, troco para 100..."
                    />
                  </div>
                  <div>
                    <div className="field-label">Observações para cozinha</div>
                    <textarea
                      className="field-input neworder-textarea"
                      rows={3}
                      value={kitchenNotes}
                      onChange={(e) => setKitchenNotes(e.target.value)}
                      placeholder="Ex: Tirar cebola, ponto da massa..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !hasPizzas}
            >
              Salvar pedido
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
