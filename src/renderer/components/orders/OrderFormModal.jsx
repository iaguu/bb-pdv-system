// src/renderer/components/orders/NewOrderModal.jsx
import React, { useEffect, useMemo, useState } from "react";

function digitsOnly(s) {
  return (s || "").replace(/\D/g, "");
}

/**
 * Tabela de taxas por bairro – pode ser customizada via settings em outro momento.
 */
const DELIVERY_FEES_BY_NEIGHBORHOOD = {
  Santana: 6,
  "Alto de Santana": 7,
  Tucuruvi: 7,
  Mandaqui: 7,
  "Santa Teresinha": 7,
  "Casa Verde": 8,
  "Vila Guilherme": 9,
  "Outros bairros": 10,
};

/**
 * Normaliza coleção de produtos vinda do DataEngine / catálogo
 * Aceita:
 * - { items: [...] }
 * - { products: [...] }
 * - [ ... ]
 *
 * Retorna:
 * {
 *   pizzas: [{ id, name, description, categoria, type: 'pizza', prices: { broto, grande } }],
 *   drinks: [{ ... type: 'drink', prices: { unit } (usa grande como base) }],
 *   extras: [{ ... type: 'extra', prices: { broto, grande } }]
 * }
 */
function normalizeProductsCollections(raw) {
  let arr = [];

  if (!raw) return { pizzas: [], drinks: [], extras: [] };

  if (Array.isArray(raw.items)) {
    arr = raw.items;
  } else if (Array.isArray(raw.products)) {
    arr = raw.products;
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    arr = [];
  }

  const pizzas = [];
  const drinks = [];
  const extras = [];

  arr.forEach((p, index) => {
    const typeRaw = (p.type || "").toLowerCase();
    const categoriaRaw = (p.categoria || p.category || "").toLowerCase();

    let normalizedType = typeRaw;
    if (!normalizedType) {
      if (
        categoriaRaw.includes("bebida") ||
        categoriaRaw.includes("refrigerante") ||
        categoriaRaw.includes("suco")
      ) {
        normalizedType = "drink";
      } else if (
        categoriaRaw.includes("extra") ||
        categoriaRaw.includes("adicional") ||
        categoriaRaw.includes("borda")
      ) {
        normalizedType = "extra";
      } else {
        normalizedType = "pizza";
      }
    }

    const id = p.id || `prod-${index + 1}`;
    const name = p.name || p.nome || "Produto sem nome";
    const description = p.description || p.descricao || "";
    const categoria = p.categoria || p.category || "";

    // Aceita tanto priceBroto/priceGrande quanto preco_broto/preco_grande/preco
    const priceBroto = p.priceBroto ?? p.preco_broto ?? null;

    const priceGrande = p.priceGrande ?? p.preco_grande ?? p.preco ?? null;

    const prices = {
      broto:
        priceBroto != null && !Number.isNaN(Number(priceBroto))
          ? Number(priceBroto)
          : 0,
      grande:
        priceGrande != null && !Number.isNaN(Number(priceGrande))
          ? Number(priceGrande)
          : 0,
    };

    const normalized = {
      id,
      name,
      description,
      categoria,
      type: normalizedType,
      prices,
    };

    if (normalizedType === "pizza") {
      if (prices.broto > 0 || prices.grande > 0) {
        pizzas.push(normalized);
      }
    } else if (normalizedType === "drink") {
      if (prices.broto > 0 || prices.grande > 0) {
        drinks.push(normalized);
      }
    } else if (normalizedType === "extra") {
      if (prices.broto > 0 || prices.grande > 0) {
        extras.push(normalized);
      }
    }
  });

  return { pizzas, drinks, extras };
}

function findById(id, collection) {
  return collection.find((p) => String(p.id) === String(id));
}

function getNeighborhoodFee(neighborhoodRaw) {
  if (!neighborhoodRaw) return 0;
  const key = neighborhoodRaw.trim();
  if (DELIVERY_FEES_BY_NEIGHBORHOOD[key] != null) {
    return DELIVERY_FEES_BY_NEIGHBORHOOD[key];
  }
  // fallback – se tiver "Santana" dentro, por exemplo
  const normalized = key.toLowerCase();
  const found = Object.entries(DELIVERY_FEES_BY_NEIGHBORHOOD).find(([name]) =>
    normalized.includes(name.toLowerCase())
  );
  if (found) return found[1];
  return DELIVERY_FEES_BY_NEIGHBORHOOD["Outros bairros"] || 0;
}

export default function NewOrderModal({
  isOpen,
  onClose,
  onConfirm,
  formatCurrency,
  /**
   * opcional: catálogo já carregado (para testes / injeção externa)
   * se não vier, usa window.dataEngine.get("products")
   */
  initialCatalog,
}) {
  // -----------------------------
  // Estado vindo do DB
  // -----------------------------
  const [customers, setCustomers] = useState([]);
  const [pizzaCatalog, setPizzaCatalog] = useState([]);
  const [drinkCatalog, setDrinkCatalog] = useState([]);
  const [extraCatalog, setExtraCatalog] = useState([]);
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
  const [flavor3, setFlavor3] = useState("");
  const [twoFlavorsEnabled, setTwoFlavorsEnabled] = useState(false);
  const [threeFlavorsEnabled, setThreeFlavorsEnabled] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState([]); // array de IDs de extras

  // -----------------------------
  // Bebida atual (editor)
  // -----------------------------
  const [drinkSearch, setDrinkSearch] = useState("");
  const [selectedDrinkId, setSelectedDrinkId] = useState("");
  const [drinkQuantity, setDrinkQuantity] = useState(1);

  // -----------------------------
  // Itens (múltiplas linhas: pizzas + bebidas)
  // -----------------------------
  const [orderItems, setOrderItems] = useState([]);

  // -----------------------------
  // Dados adicionais do pedido
  // -----------------------------
  const [status] = useState("open"); // padrão: em aberto
  const [orderType, setOrderType] = useState("delivery"); // delivery | counter
  const [paymentMethod, setPaymentMethod] = useState("");

  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0");

  const [discountType, setDiscountType] = useState("none"); // none | value | percent
  const [discountValue, setDiscountValue] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");
  const [kitchenNotes, setKitchenNotes] = useState("");

  // Troco
  const [cashGiven, setCashGiven] = useState("");

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
        let productsDb = initialCatalog || null;

        if (!productsDb) {
          if (!window.dataEngine) {
            throw new Error("API local window.dataEngine não encontrada.");
          }

          const [customersDb, products] = await Promise.all([
            window.dataEngine.get("customers"),
            window.dataEngine.get("products"),
          ]);

          if (cancel) return;

          const customersArr = Array.isArray(customersDb?.items)
            ? customersDb.items
            : Array.isArray(customersDb)
            ? customersDb
            : [];

          const { pizzas, drinks, extras } =
            normalizeProductsCollections(products);

          setCustomers(customersArr);
          setPizzaCatalog(pizzas);
          setDrinkCatalog(drinks);
          setExtraCatalog(extras);

          // resets gerais
          setCustomerMode(customersArr.length ? "registered" : "counter");
          setCustomerSearch("");
          setSelectedCustomerId(null);
          setShowCustomerSearch(true);
          setCounterLabel("Balcão");

          setFlavorSearch("");
          setTwoFlavorsEnabled(false);
          setThreeFlavorsEnabled(false);
          setSize("grande");
          setQuantity(1);
          setFlavor1("");
          setFlavor2("");
          setFlavor3("");
          setSelectedExtras([]);
          setOrderItems([]);

          setDrinkSearch("");
          setSelectedDrinkId(drinks[0]?.id || "");
          setDrinkQuantity(1);

          setOrderType("delivery");
          setPaymentMethod("");
          setDeliveryNeighborhood("");
          setDeliveryFee("0");
          setDiscountType("none");
          setDiscountValue("0");
          setOrderNotes("");
          setKitchenNotes("");
          setCashGiven("");

          if (pizzas.length > 0) {
            setFlavor1(pizzas[0].id);
          } else {
            setFlavor1("");
          }

          return;
        }

        // Caso catálogo seja injetado via props
        const { pizzas, drinks, extras } =
          normalizeProductsCollections(productsDb);

        setCustomers([]); // sem clientes via catálogo externo
        setPizzaCatalog(pizzas);
        setDrinkCatalog(drinks);
        setExtraCatalog(extras);

        setCustomerMode("counter");
        setCustomerSearch("");
        setSelectedCustomerId(null);
        setShowCustomerSearch(false);
        setCounterLabel("Balcão");

        setFlavorSearch("");
        setTwoFlavorsEnabled(false);
        setSize("grande");
        setQuantity(1);
        setFlavor2("");
        setSelectedExtras([]);
        setOrderItems([]);

        setDrinkSearch("");
        setSelectedDrinkId(drinks[0]?.id || "");
        setDrinkQuantity(1);

        setOrderType("delivery");
        setPaymentMethod("");
        setDeliveryNeighborhood("");
        setDeliveryFee("0");
        setDiscountType("none");
        setDiscountValue("0");
        setOrderNotes("");
        setKitchenNotes("");
        setCashGiven("");

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
  }, [isOpen, initialCatalog]);

  // -----------------------------
  // Cliente selecionado (memo)
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

  // Quando o cliente muda, tenta puxar bairro e taxa automaticamente
  useEffect(() => {
    if (!selectedCustomer || orderType !== "delivery") return;

    const addr = selectedCustomer.address || {};
    const neighborhood = addr.neighborhood || addr.bairro || "";
    if (!neighborhood) return;

    const fee = getNeighborhoodFee(neighborhood);
    setDeliveryNeighborhood(neighborhood);
    setDeliveryFee(String(fee).replace(".", ","));
  }, [selectedCustomer, orderType]);

  // Se mudar o tipo de pedido para balcão, zera taxa
  useEffect(() => {
    if (orderType === "counter") {
      setDeliveryFee("0");
    } else if (orderType === "delivery" && deliveryNeighborhood) {
      const fee = getNeighborhoodFee(deliveryNeighborhood);
      setDeliveryFee(String(fee).replace(".", ","));
    }
  }, [orderType, deliveryNeighborhood]);

  // -----------------------------
  // Filtro de pizzas
  // -----------------------------
  const filteredPizzas = useMemo(() => {
    const t = flavorSearch.trim().toLowerCase();
    if (!t) return pizzaCatalog;

    return pizzaCatalog.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(t) ||
        (p.description || "").toLowerCase().includes(t) ||
        (p.categoria || "").toLowerCase().includes(t)
    );
  }, [pizzaCatalog, flavorSearch]);

  // -----------------------------
  // Filtro de bebidas
  // -----------------------------
  const filteredDrinks = useMemo(() => {
    const t = drinkSearch.trim().toLowerCase();
    if (!t) return drinkCatalog;

    return drinkCatalog.filter(
      (d) =>
        (d.name || "").toLowerCase().includes(t) ||
        (d.description || "").toLowerCase().includes(t) ||
        (d.categoria || "").toLowerCase().includes(t)
    );
  }, [drinkCatalog, drinkSearch]);

  // -----------------------------
  // Extras selecionados → valor unitário por pizza
  // -----------------------------
  const extrasUnitTotal = useMemo(() => {
    if (!selectedExtras.length || !extraCatalog.length) return 0;

    return selectedExtras.reduce((acc, extraId) => {
      const extra = findById(extraId, extraCatalog);
      if (!extra) return acc;

      const price =
        size === "broto"
          ? extra.prices.broto || extra.prices.grande || 0
          : extra.prices.grande || extra.prices.broto || 0;

      return acc + (price || 0);
    }, 0);
  }, [selectedExtras, extraCatalog, size]);

  // -----------------------------
  // Preço unitário da pizza atual (pizza + extras)
  // -----------------------------
  const unitPizzaPrice = useMemo(() => {
    const pizza1 = findById(flavor1, pizzaCatalog);
    if (!pizza1) return 0;

    const basePrice1 = pizza1.prices[size] || 0;

    if ((!twoFlavorsEnabled && !threeFlavorsEnabled) || (!flavor2 && !flavor3)) {
      return basePrice1 + extrasUnitTotal;
    }

    const prices = [basePrice1];

    if (twoFlavorsEnabled && flavor2) {
      const pizza2 = findById(flavor2, pizzaCatalog);
      const basePrice2 = pizza2?.prices[size] || 0;
      if (basePrice2) prices.push(basePrice2);
    }

    if (threeFlavorsEnabled && flavor3) {
      const pizza3 = findById(flavor3, pizzaCatalog);
      const basePrice3 = pizza3?.prices[size] || 0;
      if (basePrice3) prices.push(basePrice3);
    }

    const base = Math.max(...prices);

    return base + extrasUnitTotal;
  }, [
    flavor1,
    flavor2,
    flavor3,
    size,
    pizzaCatalog,
    twoFlavorsEnabled,
    threeFlavorsEnabled,
    extrasUnitTotal,
  ]);

  // -----------------------------
  // Adicionar pizza à lista
  // -----------------------------
  const handleToggleExtra = (extraId) => {
    setSelectedExtras((prev) =>
      prev.includes(extraId)
        ? prev.filter((id) => id !== extraId)
        : [...prev, extraId]
    );
  };

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

    const pizza1 = findById(flavor1, pizzaCatalog);
    if (!pizza1) {
      alert("Selecione o sabor 1.");
      return;
    }

    let pizza2 = null;
    if (twoFlavorsEnabled || threeFlavorsEnabled) {
      if (!flavor2) {
        alert("Selecione o sabor 2 ou volte para 1 sabor.");
        return;
      }
      pizza2 = findById(flavor2, pizzaCatalog);
      if (!pizza2) {
        alert("Sabor 2 inválido.");
        return;
      }
    }

    let pizza3 = null;
    if (threeFlavorsEnabled) {
      if (!flavor3) {
        alert("Selecione o sabor 3 ou volte para 1/2 sabores.");
        return;
      }
      pizza3 = findById(flavor3, pizzaCatalog);
      if (!pizza3) {
        alert("Sabor 3 inválido.");
        return;
      }
    }

    const sizeLabel = size === "broto" ? "Broto" : "Grande";
    const lineUnit = unitPizzaPrice;
    const lineTotal = lineUnit * q;

    const extrasDetail = selectedExtras
      .map((extraId) => {
        const extra = findById(extraId, extraCatalog);
        if (!extra) return null;
        const price =
          size === "broto"
            ? extra.prices.broto || extra.prices.grande || 0
            : extra.prices.grande || extra.prices.broto || 0;
        return {
          id: extra.id,
          name: extra.name,
          unitPrice: price,
        };
      })
      .filter(Boolean);

    const newItem = {
      lineId: `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      kind: "pizza",
      size,
      sizeLabel,
      quantity: q,
      flavor1Id: pizza1.id,
      flavor1Name: pizza1.name,
      flavor2Id: pizza2?.id || null,
      flavor2Name: pizza2?.name || null,
      flavor3Id: pizza3?.id || null,
      flavor3Name: pizza3?.name || null,
      twoFlavors: !!pizza2,
      threeFlavors: !!pizza3,
      extras: extrasDetail,
      unitPrice: lineUnit,
      total: lineTotal,
    };

    setOrderItems((prev) => [...prev, newItem]);

    setQuantity(1);
    setTwoFlavorsEnabled(false);
    setThreeFlavorsEnabled(false);
    setFlavor2("");
    setFlavor3("");
    setSelectedExtras([]);
  };

  // -----------------------------
  // Adicionar bebida à lista
  // -----------------------------
  const handleAddDrink = () => {
    if (!drinkCatalog.length) {
      alert("Nenhuma bebida cadastrada.");
      return;
    }

    const q = Number(drinkQuantity) || 0;
    if (q <= 0) {
      alert("Quantidade inválida.");
      return;
    }

    const drink = findById(selectedDrinkId, drinkCatalog);
    if (!drink) {
      alert("Selecione uma bebida.");
      return;
    }

    const unit = drink.prices.grande || drink.prices.broto || 0;

    if (!unit) {
      alert("Bebida sem preço configurado.");
      return;
    }

    const newItem = {
      lineId: `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      kind: "drink",
      productId: drink.id,
      productName: drink.name,
      quantity: q,
      unitPrice: unit,
      total: unit * q,
    };

    setOrderItems((prev) => [...prev, newItem]);

    setDrinkQuantity(1);
  };

  const handleRemoveItem = (lineId) => {
    setOrderItems((prev) => prev.filter((it) => it.lineId !== lineId));
  };

  // -----------------------------
  // Totais e métricas
  // -----------------------------
  const subtotal = useMemo(
    () => orderItems.reduce((acc, it) => acc + (it.total || 0), 0),
    [orderItems]
  );

  const totalItems = useMemo(
    () => orderItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0),
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

  const cashGivenNumber = useMemo(
    () => Number(String(cashGiven).replace(",", ".")) || 0,
    [cashGiven]
  );

  const changeAmount = useMemo(
    () => Math.max(cashGivenNumber - total, 0),
    [cashGivenNumber, total]
  );

  // -----------------------------
  // Build draft + submit (save / save_and_print)
  // -----------------------------
  const buildDraft = () => {
    if (!orderItems.length) {
      return { error: "Adicione pelo menos uma pizza ou bebida ao pedido." };
    }

    let customerName = "";
    let customerId = null;
    let customerPhone = "";
    let customerCpf = "";
    let customerAddress = null;

    if (customerMode === "registered") {
      if (!selectedCustomer) {
        return {
          error: "Selecione um cliente ou troque para Balcão / rápido.",
        };
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
          neighborhood: addr.neighborhood || addr.bairro || "",
          city: addr.city || "",
          state: addr.state || "",
        };
      }
    } else {
      const label = (counterLabel || "").trim();
      if (!label) {
        return {
          error: "Informe uma identificação para Balcão / rápido.",
        };
      }
      customerName = label;
    }

    const summaryLines = orderItems.map((item) => {
      if (item.kind === "pizza") {
        const flavors = [
          item.flavor1Name,
          item.flavor2Name,
          item.flavor3Name,
        ].filter(Boolean);

        const flavorsText =
          flavors.length > 1 ? flavors.join(" / ") : flavors[0] || "Pizza";

        const baseText = `${item.quantity}x ${item.sizeLabel} ${flavorsText}`;

        if (item.extras && item.extras.length > 0) {
          const extrasNames = item.extras.map((ex) => ex.name).join(", ");
          return `${baseText} (Adicionais: ${extrasNames})`;
        }

        return baseText;
      }

      if (item.kind === "drink") {
        return `${item.quantity}x Bebida ${item.productName}`;
      }

      return `${item.quantity}x Item`;
    });

    const summary = summaryLines.join(" | ");

    const draft = {
      status,
      orderType,
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
      deliveryNeighborhood:
        orderType === "delivery" ? deliveryNeighborhood || null : null,
      discount: {
        type: discountType,
        value: discountRaw,
        amount: discountAmount,
      },
      total,
      cash: {
        enabled: paymentMethod === "money",
        cashGiven: paymentMethod === "money" ? cashGivenNumber : 0,
        changeAmount: paymentMethod === "money" ? changeAmount : 0,
      },
      orderNotes,
      kitchenNotes,
      summary,
      meta: {
        totalItems,
      },
    };

    return { draft };
  };

  const handleSubmit = (e, options = { action: "save" }) => {
    if (e && e.preventDefault) e.preventDefault();

    const { draft, error } = buildDraft();
    if (error) {
      alert(error);
      return;
    }

    // Permite a tela de Pedidos decidir se imprime ou não
    // options.action: "save" | "save_and_print"
    if (typeof onConfirm === "function") {
      onConfirm(draft, options);
    }
  };

  if (!isOpen) return null;

  const hasCustomers = customers.length > 0;
  const hasPizzas = pizzaCatalog.length > 0;
  const hasDrinks = drinkCatalog.length > 0;
  const hasExtras = extraCatalog.length > 0;

  const neighborhoodOptions = Object.keys(DELIVERY_FEES_BY_NEIGHBORHOOD);

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
              Defina o cliente, adicione produtos do catálogo e finalize o
              pedido.
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

        <form
          className="modal-body"
          onSubmit={(e) => handleSubmit(e, { action: "save" })}
        >
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

                {/* Lista de clientes + busca */}
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

                {/* Taxa por bairro */}
                <div className="modal-grid-2">
                  <div>
                    <div className="field-label">Bairro (Entrega)</div>
                    <select
                      className="field-input"
                      value={deliveryNeighborhood}
                      onChange={(e) => {
                        const bairro = e.target.value;
                        setDeliveryNeighborhood(bairro);
                        if (orderType === "delivery" && bairro) {
                          const fee = getNeighborhoodFee(bairro);
                          setDeliveryFee(String(fee).replace(".", ","));
                        }
                      }}
                      disabled={orderType !== "delivery"}
                    >
                      <option value="">Selecione o bairro</option>
                      {neighborhoodOptions.map((bairro) => (
                        <option key={bairro} value={bairro}>
                          {bairro} —{" "}
                          {formatCurrency(
                            DELIVERY_FEES_BY_NEIGHBORHOOD[bairro] || 0
                          )}
                        </option>
                      ))}
                    </select>
                    <div className="field-helper">
                      O bairro pode vir preenchido pelo cadastro do cliente.
                    </div>
                  </div>

                  <div>
                    <div className="field-label">Taxa de entrega</div>
                    <input
                      className="field-input"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      placeholder="0,00"
                      disabled={orderType !== "delivery"}
                    />
                    <div className="field-helper">
                      Use 0 para pedidos de balcão ou retirada.
                    </div>
                  </div>
                </div>

                {/* Desconto */}
                <div className="modal-grid-2">
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

                  {/* Troco */}
                  <div>
                    {paymentMethod === "money" && (
                      <>
                        <div className="field-label">Troco para</div>
                        <input
                          className="field-input"
                          value={cashGiven}
                          onChange={(e) => setCashGiven(e.target.value)}
                          placeholder="Ex: 100,00"
                        />
                        <div className="field-helper">
                          Troco estimado:{" "}
                          {formatCurrency(changeAmount || 0)}
                        </div>
                      </>
                    )}
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

                  <div>
                    <div className="field-label">Resumo rápido</div>
                    <div className="field-helper">
                      Itens no pedido: <strong>{totalItems}</strong>
                      <br />
                      Total atual: <strong>{formatCurrency(total)}</strong>
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
                      placeholder="Buscar por nome, categoria ou ingrediente..."
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
                        {`${p.name} — ${formatCurrency(p.prices[size] || 0)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pizza-flavor-mode">
                  <div className="field-label">Quantidade de sabores</div>
                  <div className="field-pill-group">
                    <button
                      type="button"
                      className={
                        "field-pill" +
                        (!twoFlavorsEnabled && !threeFlavorsEnabled
                          ? " field-pill-active"
                          : "")
                      }
                      onClick={() => {
                        setTwoFlavorsEnabled(false);
                        setThreeFlavorsEnabled(false);
                        setFlavor2("");
                        setFlavor3("");
                      }}
                      disabled={!hasPizzas}
                    >
                      1 sabor
                    </button>
                    <button
                      type="button"
                      className={
                        "field-pill" +
                        (twoFlavorsEnabled && !threeFlavorsEnabled
                          ? " field-pill-active"
                          : "")
                      }
                      onClick={() => {
                        setTwoFlavorsEnabled(true);
                        setThreeFlavorsEnabled(false);
                        setFlavor3("");
                      }}
                      disabled={!hasPizzas}
                    >
                      2 sabores
                    </button>
                    <button
                      type="button"
                      className={
                        "field-pill" +
                        (threeFlavorsEnabled ? " field-pill-active" : "")
                      }
                      onClick={() => {
                        setTwoFlavorsEnabled(false);
                        setThreeFlavorsEnabled(true);
                      }}
                      disabled={!hasPizzas}
                    >
                      3 sabores
                    </button>
                  </div>
                  <div className="field-helper">
                    A pizza com 2 ou 3 sabores considera sempre o maior valor
                    entre os sabores.
                  </div>
                </div>

                {(twoFlavorsEnabled || threeFlavorsEnabled) && (
                  <div className="pizza-flavor-block">
                    <div className="field-label">Sabor 2</div>
                    <select
                      className="field-input"
                      value={flavor2}
                      onChange={(e) => setFlavor2(e.target.value)}
                      disabled={!hasPizzas || filteredPizzas.length === 0}
                    >
                      <option value="">Selecione</option>
                      {filteredPizzas.map((p) => {
                        if (String(p.id) === String(flavor1)) return null;
                        return (
                          <option key={p.id} value={p.id}>
                            {`${p.name} — ${formatCurrency(
                              p.prices[size] || 0
                            )}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {threeFlavorsEnabled && (
                  <div className="pizza-flavor-block">
                    <div className="field-label">Sabor 3</div>
                    <select
                      className="field-input"
                      value={flavor3}
                      onChange={(e) => setFlavor3(e.target.value)}
                      disabled={!hasPizzas || filteredPizzas.length === 0}
                    >
                      <option value="">Selecione</option>
                      {filteredPizzas.map((p) => {
                        const idStr = String(p.id);
                        if (idStr === String(flavor1)) return null;
                        if (idStr === String(flavor2)) return null;
                        return (
                          <option key={p.id} value={p.id}>
                            {`${p.name} — ${formatCurrency(
                              p.prices[size] || 0
                            )}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* ADICIONAIS DA PIZZA */}
                <div className="pizza-extras-block">
                  <div className="field-label">Adicionais</div>
                  {!hasExtras && (
                    <div className="field-helper">
                      Cadastre adicionais na tela de Produtos para aparecerem
                      aqui.
                    </div>
                  )}
                  {hasExtras && (
                    <div className="extras-list">
                      {extraCatalog.map((extra) => {
                        const checked = selectedExtras.includes(extra.id);
                        const price =
                          size === "broto"
                            ? extra.prices.broto || extra.prices.grande || 0
                            : extra.prices.grande ||
                              extra.prices.broto ||
                              0;
                        return (
                          <label
                            key={extra.id}
                            className={
                              "extras-item" +
                              (checked ? " extras-item-active" : "")
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleExtra(extra.id)}
                            />
                            <span className="extras-item-name">
                              {extra.name}
                            </span>
                            <span className="extras-item-price">
                              + {formatCurrency(price)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {selectedExtras.length > 0 && (
                    <div className="field-helper">
                      Adicionais por pizza: {formatCurrency(extrasUnitTotal)}
                    </div>
                  )}
                </div>

                <div className="pizza-summary-chip-row">
                  <span className="chip chip-soft">
                    {quantity || 1}x {size === "broto" ? "Broto" : "Grande"}
                  </span>
                  {flavor1 && <span className="chip">Sabor principal</span>}
                  {twoFlavorsEnabled && flavor2 && (
                    <span className="chip chip-alt">Meio a meio</span>
                  )}
                  {selectedExtras.length > 0 && (
                    <span className="chip chip-soft">
                      Adicionais ({selectedExtras.length})
                    </span>
                  )}
                  <span className="chip chip-outline">
                    Unitário: {formatCurrency(unitPizzaPrice)}
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

              {/* EDITOR DE BEBIDA */}
              <div className="modal-section">
                <div className="modal-section-title">Adicionar bebida</div>

                {!hasDrinks && (
                  <div className="field-helper">
                    Cadastre bebidas na tela de Produtos para aparecerem aqui.
                  </div>
                )}

                {hasDrinks && (
                  <>
                    <div className="field-label">Buscar bebida</div>
                    <div className="field-input-with-icon">
                      <span className="field-input-icon">🔍</span>
                      <input
                        className="field-input"
                        value={drinkSearch}
                        onChange={(e) => setDrinkSearch(e.target.value)}
                        placeholder="Ex: Coca, Guaraná..."
                      />
                    </div>

                    <div className="modal-grid-2 pizza-grid-top">
                      <div>
                        <div className="field-label">Bebida</div>
                        <select
                          className="field-input"
                          value={selectedDrinkId}
                          onChange={(e) => setSelectedDrinkId(e.target.value)}
                        >
                          {filteredDrinks.map((d) => {
                            const unit =
                              d.prices.grande || d.prices.broto || 0;
                            return (
                              <option key={d.id} value={d.id}>
                                {d.name} — {formatCurrency(unit)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div>
                        <div className="field-label">Quantidade</div>
                        <input
                          className="field-input"
                          type="number"
                          min="1"
                          value={drinkQuantity}
                          onChange={(e) => setDrinkQuantity(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="neworder-addline-footer">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={handleAddDrink}
                        disabled={isLoading || !hasDrinks}
                      >
                        + Adicionar bebida ao pedido
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* LISTA DE ITENS DO PEDIDO */}
              <div className="modal-section">
                <div className="modal-section-title">Itens do pedido</div>

                {orderItems.length === 0 && (
                  <div className="empty">
                    Nenhum item adicionado ainda. Monte uma pizza ou selecione
                    bebidas e clique em{" "}
                    <strong>“Adicionar ... ao pedido”</strong>.
                  </div>
                )}

                {orderItems.length > 0 && (
                  <div className="order-items-list">
                    {orderItems.map((item) => (
                      <div key={item.lineId} className="order-item-row">
                        <div className="order-item-main">
                          <div className="order-item-title">
                            {item.kind === "pizza" && (
                              <>
                                {item.quantity}x {item.sizeLabel}{" "}
                                {item.flavor1Name}
                                {item.twoFlavors && item.flavor2Name
                                  ? ` / ${item.flavor2Name}`
                                  : ""}
                                {item.threeFlavors && item.flavor3Name
                                  ? ` / ${item.flavor3Name}`
                                  : ""}
                              </>
                            )}
                            {item.kind === "drink" && (
                              <>
                                {item.quantity}x {item.productName}
                              </>
                            )}
                          </div>
                          {item.kind === "pizza" &&
                            item.extras &&
                            item.extras.length > 0 && (
                              <div className="order-item-extras">
                                Adicionais:{" "}
                                {item.extras.map((ex) => ex.name).join(", ")}
                              </div>
                            )}
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
                          onClick={() => handleRemoveItem(item.lineId)}
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
                  {paymentMethod === "money" && cashGivenNumber > 0 && (
                    <div className="order-totals-row">
                      <span>Troco</span>
                      <span>{formatCurrency(changeAmount)}</span>
                    </div>
                  )}
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
                      <div className="field-label">
                        Observações para cozinha
                      </div>
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
              type="button"
              className="btn btn-secondary"
              disabled={isLoading || (!hasPizzas && !hasDrinks)}
              onClick={(e) => handleSubmit(e, { action: "save" })}
            >
              Salvar pedido
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={isLoading || (!hasPizzas && !hasDrinks)}
              onClick={(e) =>
                handleSubmit(e, { action: "save_and_print" })
              }
            >
              Finalizar e imprimir pedido
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
