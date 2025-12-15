// src/renderer/components/orders/NewOrderModal.jsx
import React, { useEffect, useMemo, useState } from "react";

function digitsOnly(s) {
  return (s || "").replace(/\D/g, "");
}

/**
 * Endereço base fixo da pizzaria
 * Usado para calcular a distância até o cliente.
 */
const BASE_DELIVERY_ADDRESS =
  "Rua Dona Elfrida, 719 - Santa Teresinha, São Paulo - SP";

/**
 * Tabela padrão de entrega por km (fallback caso não exista em settings)
 */
const DEFAULT_DELIVERY_CONFIG = {
  baseLocationLabel: "Rua Dona Elfrida, 719 - Santa Teresinha",
  ranges: [
    {
      id: "r0_0_8",
      label: "até 0,8 km",
      minKm: 0,
      maxKm: 0.8,
      price: 3.5,
    },
    {
      id: "r0_81_1_5",
      label: "0,81 a 1,5 km",
      minKm: 0.81,
      maxKm: 1.5,
      price: 5.9,
    },
    {
      id: "r1_6_2",
      label: "de 1,6 a 2,0 km",
      minKm: 1.6,
      maxKm: 2.0,
      price: 7.5,
    },
    {
      id: "r2_1_4",
      label: "de 2,1 a 4,0 km",
      minKm: 2.1,
      maxKm: 4.0,
      price: 8.9,
    },
    {
      id: "r4_1_5_5",
      label: "de 4,1 a 5,5 km",
      minKm: 4.1,
      maxKm: 5.5,
      price: 10.9,
    },
    {
      id: "r5_6_9",
      label: "de 5,6 a 9,0 km",
      minKm: 5.6,
      maxKm: 9.0,
      price: 12.9,
    },
    {
      id: "r9_1_11_5",
      label: "de 9,1 a 11,5 km",
      minKm: 9.1,
      maxKm: 11.5,
      price: 18.0,
    },
    {
      id: "r11_6_15",
      label: "de 11,6 a 15,0 km",
      minKm: 11.6,
      maxKm: 15.0,
      price: 22.0,
    },
    {
      id: "pickup",
      label: "Retirar / até 0,1 km",
      minKm: 0,
      maxKm: 0.1,
      price: 0.0,
    },
  ],
};

/**
 * Normaliza deliveryConfig vindo de settings (caso exista)
 */
function normalizeDeliveryConfigFromSettings(rawSettings) {
  if (!rawSettings) return DEFAULT_DELIVERY_CONFIG;

  let settingsObj = null;
  if (Array.isArray(rawSettings?.items) && rawSettings.items.length > 0) {
    settingsObj = rawSettings.items[0];
  } else if (Array.isArray(rawSettings) && rawSettings.length > 0) {
    settingsObj = rawSettings[0];
  } else if (typeof rawSettings === "object") {
    settingsObj = rawSettings;
  }

  const delivery = settingsObj?.delivery;
  if (!delivery || !Array.isArray(delivery.ranges)) {
    return DEFAULT_DELIVERY_CONFIG;
  }

  return {
    baseLocationLabel:
      delivery.baseLocationLabel ||
      DEFAULT_DELIVERY_CONFIG.baseLocationLabel,
    ranges: delivery.ranges.map((r, idx) => ({
      id: r.id || `r_${idx}`,
      label:
        r.label ||
        DEFAULT_DELIVERY_CONFIG.ranges[idx]?.label ||
        `Faixa ${idx + 1}`,
      minKm:
        typeof r.minKm === "number"
          ? r.minKm
          : Number(r.minKm ?? DEFAULT_DELIVERY_CONFIG.ranges[idx]?.minKm ?? 0),
      maxKm:
        typeof r.maxKm === "number"
          ? r.maxKm
          : Number(r.maxKm ?? DEFAULT_DELIVERY_CONFIG.ranges[idx]?.maxKm ?? 0),
      price:
        typeof r.price === "number"
          ? r.price
          : Number(r.price ?? DEFAULT_DELIVERY_CONFIG.ranges[idx]?.price ?? 0),
    })),
  };
}

/**
 * Converte string "1,5" ou "1.5" para número
 */
function parseKmValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).replace(",", ".");
  const n = Number(normalized);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Encontra faixa de entrega pela distância em km
 */
function findDeliveryRangeForKm(distanceKm, deliveryConfig) {
  if (!deliveryConfig || !Array.isArray(deliveryConfig.ranges)) return null;
  const km = parseKmValue(distanceKm);
  if (km <= 0) return null;

  for (const r of deliveryConfig.ranges) {
    const min = parseKmValue(r.minKm);
    const max = parseKmValue(r.maxKm);
    if (km >= min && km <= max) {
      return r;
    }
  }

  // se não encontrou, usa última faixa como padrão
  return deliveryConfig.ranges[deliveryConfig.ranges.length - 1] || null;
}

/**
 * Tenta usar um bridge JS -> main para calcular a distância (em km)
 * A ideia é você implementar um desses caminhos no main:
 *  - window.deliveryApi.calculateDistanceKm(origin, destination)
 *  - ipcRenderer.invoke("delivery:calculateDistanceKm", { origin, destination })
 */
async function calculateDistanceKmUsingBridge(origin, destination) {
  try {
    // 1) API exposta direto no preload
    if (window?.deliveryApi?.calculateDistanceKm) {
      const result = await window.deliveryApi.calculateDistanceKm(
        origin,
        destination
      );
      if (typeof result === "number") return result;
      if (result && typeof result.distanceKm === "number")
        return result.distanceKm;
      if (result && typeof result.km === "number") return result.km;
    }

    // 2) IPC padrão
    if (window?.electron?.ipcRenderer?.invoke) {
      const result = await window.electron.ipcRenderer.invoke(
        "delivery:calculateDistanceKm",
        { origin, destination }
      );
      if (typeof result === "number") return result;
      if (result && typeof result.distanceKm === "number")
        return result.distanceKm;
      if (result && typeof result.km === "number") return result.km;
    }
  } catch (err) {
    console.error("[NewOrderModal] calculateDistanceKmUsingBridge error:", err);
  }
  return null;
}

/**
 * Normaliza coleção de produtos vinda do DataEngine / catálogo
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

export default function NewOrderModal({
  isOpen,
  onClose,
  onConfirm,
  formatCurrency,
  initialCatalog,
}) {
  // -----------------------------
  // Estado vindo do DB
  // -----------------------------
  const [customers, setCustomers] = useState([]);
  const [pizzaCatalog, setPizzaCatalog] = useState([]);
  const [drinkCatalog, setDrinkCatalog] = useState([]);
  const [extraCatalog, setExtraCatalog] = useState([]);
  const [deliveryConfig, setDeliveryConfig] = useState(DEFAULT_DELIVERY_CONFIG);
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
  const [extrasOpen, setExtrasOpen] = useState(false); // toggle para exibir/ocultar adicionais

  // slot ativo para seleção por cards
  const [activeFlavorSlot, setActiveFlavorSlot] = useState("flavor1");

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
  const [status] = useState("open");
  const [orderType, setOrderType] = useState("delivery");
  const [paymentMethod, setPaymentMethod] = useState("");

  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState(""); // distância em km (auto)
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState(""); // rótulo da faixa (label exibida)
  const [deliveryFee, setDeliveryFee] = useState("0"); // valor em R$, calculado pela faixa
  const [selectedDeliveryRangeId, setSelectedDeliveryRangeId] = useState(""); // faixa de entrega escolhida

  const [discountType, setDiscountType] = useState("none"); // none | value | percent
  const [discountValue, setDiscountValue] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");
  const [kitchenNotes, setKitchenNotes] = useState("");

  const [cashGiven, setCashGiven] = useState("");

  // estados auxiliares do cálculo automático
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState("");

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

          const [customersDb, products, settingsDb] = await Promise.all([
            window.dataEngine.get("customers"),
            window.dataEngine.get("products"),
            window.dataEngine.get("settings"),
          ]);

          if (cancel) return;

          const customersArr = Array.isArray(customersDb?.items)
            ? customersDb.items
            : Array.isArray(customersDb)
            ? customersDb
            : [];

          const { pizzas, drinks, extras } =
            normalizeProductsCollections(products);

          const dCfg = normalizeDeliveryConfigFromSettings(settingsDb);

          setCustomers(customersArr);
          setPizzaCatalog(pizzas);
          setDrinkCatalog(drinks);
          setExtraCatalog(extras);
          setDeliveryConfig(dCfg);

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
          setFlavor1(pizzas[0]?.id || "");
          setFlavor2("");
          setFlavor3("");
          setSelectedExtras([]);
          setExtrasOpen(false);
          setActiveFlavorSlot("flavor1");

          setOrderItems([]);

          setDrinkSearch("");
          setSelectedDrinkId(drinks[0]?.id || "");
          setDrinkQuantity(1);

          setOrderType("delivery");
          setPaymentMethod("");
          setDeliveryDistanceKm("");
          setDeliveryNeighborhood("");
          setDeliveryFee("0");
          setDiscountType("none");
          setDiscountValue("0");
          setOrderNotes("");
          setKitchenNotes("");
          setCashGiven("");

          setDistanceError("");
          setIsCalculatingDistance(false);

          return;
        }

        // caminho com initialCatalog (sem DataEngine completo)
        const { pizzas, drinks, extras } =
          normalizeProductsCollections(productsDb);

        setCustomers([]);
        setPizzaCatalog(pizzas);
        setDrinkCatalog(drinks);
        setExtraCatalog(extras);
        setDeliveryConfig(DEFAULT_DELIVERY_CONFIG);

        setCustomerMode("counter");
        setCustomerSearch("");
        setSelectedCustomerId(null);
        setShowCustomerSearch(false);
        setCounterLabel("Balcão");

        setFlavorSearch("");
        setTwoFlavorsEnabled(false);
        setThreeFlavorsEnabled(false);
        setSize("grande");
        setQuantity(1);
        setFlavor1(pizzas[0]?.id || "");
        setFlavor2("");
        setFlavor3("");
        setSelectedExtras([]);
        setExtrasOpen(false);
        setActiveFlavorSlot("flavor1");

        setOrderItems([]);

        setDrinkSearch("");
        setSelectedDrinkId(drinks[0]?.id || "");
        setDrinkQuantity(1);

        setOrderType("delivery");
        setPaymentMethod("");
        setDeliveryDistanceKm("");
        setDeliveryNeighborhood("");
        setDeliveryFee("0");
        setDiscountType("none");
        setDiscountValue("0");
        setOrderNotes("");
        setKitchenNotes("");
        setCashGiven("");

        setDistanceError("");
        setIsCalculatingDistance(false);
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

  // Quando troca para balcão, zera taxa; quando é delivery, recalc pela distância
  useEffect(() => {
    if (orderType === "counter") {
      setDeliveryFee("0");
      setDeliveryNeighborhood("");
      setSelectedDeliveryRangeId("");
      return;
    }

    if (orderType === "delivery" && deliveryConfig) {
      const range = findDeliveryRangeForKm(
        deliveryDistanceKm,
        deliveryConfig
      );
      const fee = range ? Number(range.price || 0) : 0;

      setSelectedDeliveryRangeId(range ? range.id || "" : "");
      setDeliveryFee(fee ? String(fee).replace(".", ",") : "0");
      setDeliveryNeighborhood(range ? range.label || "" : "");
    }
  }, [orderType, deliveryDistanceKm, deliveryConfig, deliveryConfig?.ranges]);

  // -----------------------------
  // Ação: calcular distância usando endereço do cliente
  // -----------------------------
  const handleAutoDistanceFromCustomer = async (customerParam) => {
    const customer = customerParam || selectedCustomer;

    if (orderType !== "delivery" || !customer || !customer.address) {
      setDistanceError(
        "Selecione um cliente."
      );
      return;
    }

    const addr = customer.address || {};
    const parts = [];

    if (addr.street) {
      let line1 = addr.street;
      if (addr.number) line1 += `, ${addr.number}`;
      parts.push(line1);
    }

    const neighborhood = addr.neighborhood || addr.bairro;
    if (neighborhood) parts.push(neighborhood);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.cep) parts.push(`CEP ${addr.cep}`);

    const destination = parts.filter(Boolean).join(" - ");

    if (!destination) {
      setDistanceError(
        "Endereço do cliente incompleto. Preencha rua/bairro/cidade para usar o cálculo automático."
      );
      return;
    }

    setIsCalculatingDistance(true);
    setDistanceError("");

    const km = await calculateDistanceKmUsingBridge(
      BASE_DELIVERY_ADDRESS,
      destination
    );

    setIsCalculatingDistance(false);

    if (km === null) {
      setDistanceError(
        "Não foi possível calcular a distância automaticamente. Verifique a integração ou preencha manualmente."
      );
      return;
    }

    const rounded = Math.round(km * 10) / 10; // 1 casa decimal
    const asString = String(rounded).replace(".", ",");

    setDeliveryDistanceKm(asString);
    // efeito de recalcular taxa entra pelo useEffect de orderType/deliveryDistanceKm
  };

  // Calcula automaticamente assim que um cliente com endereço é selecionado
  useEffect(() => {
    if (
      orderType !== "delivery" ||
      !selectedCustomer ||
      !selectedCustomer.address
    ) {
      return;
    }
    handleAutoDistanceFromCustomer(selectedCustomer);
  }, [orderType, selectedCustomer]);

  // -----------------------------
  // Filtro de pizzas e drinks
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

  // pizzas selecionadas (para mostrar nome nos chips)
  const flavor1Pizza = useMemo(
    () => (flavor1 ? findById(flavor1, pizzaCatalog) : null),
    [flavor1, pizzaCatalog]
  );
  const flavor2Pizza = useMemo(
    () => (flavor2 ? findById(flavor2, pizzaCatalog) : null),
    [flavor2, pizzaCatalog]
  );
  const flavor3Pizza = useMemo(
    () => (flavor3 ? findById(flavor3, pizzaCatalog) : null),
    [flavor3, pizzaCatalog]
  );

  // -----------------------------
  // Extras selecionados
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
  // Preço unitário da pizza
  // -----------------------------
  const unitPizzaPrice = useMemo(() => {
    const pizza1 = findById(flavor1, pizzaCatalog);
    if (!pizza1) return 0;

    const basePrice1 = pizza1.prices[size] || 0;

    if (
      (!twoFlavorsEnabled && !threeFlavorsEnabled) ||
      (!flavor2 && !flavor3)
    ) {
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
  // Seleção de sabores via cards
  // -----------------------------
  const handleSelectFlavorCard = (pizzaId) => {
    if (!pizzaId) return;

    if (
      activeFlavorSlot === "flavor2" &&
      !(twoFlavorsEnabled || threeFlavorsEnabled)
    ) {
      setActiveFlavorSlot("flavor1");
    }
    if (activeFlavorSlot === "flavor3" && !threeFlavorsEnabled) {
      setActiveFlavorSlot("flavor1");
    }

    if (activeFlavorSlot === "flavor1") {
      setFlavor1(pizzaId);
    } else if (
      activeFlavorSlot === "flavor2" &&
      (twoFlavorsEnabled || threeFlavorsEnabled)
    ) {
      setFlavor2(pizzaId);
    } else if (activeFlavorSlot === "flavor3" && threeFlavorsEnabled) {
      setFlavor3(pizzaId);
    } else {
      setFlavor1(pizzaId);
      setActiveFlavorSlot("flavor1");
    }
  };

  const handleToggleExtra = (extraId) => {
    setSelectedExtras((prev) =>
      prev.includes(extraId)
        ? prev.filter((id) => id !== extraId)
        : [...prev, extraId]
    );
  };

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

    const pizza1 = findById(flavor1, pizzaCatalog);
    if (!pizza1) {
      alert("Selecione ao menos o 1º sabor.");
      return;
    }

    let pizza2 = null;
    if (twoFlavorsEnabled || threeFlavorsEnabled) {
      if (!flavor2) {
        alert("Selecione o 2º sabor ou volte para 1 sabor.");
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
        alert("Selecione o 3º sabor ou volte para 1/2 sabores.");
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

    // reset para próxima pizza
    setQuantity(1);
    setTwoFlavorsEnabled(false);
    setThreeFlavorsEnabled(false);
    setFlavor2("");
    setFlavor3("");
    setSelectedExtras([]);
    setExtrasOpen(false);
    setActiveFlavorSlot("flavor1");
  };

  // -----------------------------
  // Adicionar bebida
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
  // Totais
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
  // Build draft + submit
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
      deliveryDistanceKm:
        orderType === "delivery" ? parseKmValue(deliveryDistanceKm) : 0,
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

    if (typeof onConfirm === "function") {
      onConfirm(draft, options);
    }
  };

  if (!isOpen) return null;

  const hasCustomers = customers.length > 0;
  const hasPizzas = pizzaCatalog.length > 0;
  const hasDrinks = drinkCatalog.length > 0;
  const hasExtras = extraCatalog.length > 0;

  const extrasDisabled = !hasPizzas || !flavor1;

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
          <div className="neworder-grid">
            {/* ===================== COLUNA ESQUERDA ===================== */}
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

              {/* CONFIGURAÇÕES GERAIS */}
              <div className="modal-section">
                <div className="modal-section-header-row">
                  <div className="modal-section-title">Configurações</div>
                  <div className="modal-section-subtitle">
                    Organize o tipo de pedido, pagamento, entrega e resumo
                    rápido do pedido.
                  </div>
                </div>

                {/* Linha 1 – Tipo, Pagamento, Status + resumo */}
                <div className="config-cards-row">
                  <div className="config-card">
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

                  <div className="config-card">
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

                    {paymentMethod === "money" && (
                      <div className="config-card-inline-block">
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
                      </div>
                    )}
                  </div>

                  <div className="config-card config-card-narrow">
                    <div className="field-label">Status do pedido</div>
                    <div className="status-chip status-chip-open">
                      Em aberto
                    </div>
                    <div className="config-mini-summary">
                      <div>
                        Itens: <strong>{totalItems}</strong>
                      </div>
                      <div>
                        Total: <strong>{formatCurrency(total)}</strong>
                      </div>
                    </div>
                    <div className="field-helper small">
                      Após salvar, o status pode ser alterado na tela de
                      Pedidos.
                    </div>
                  </div>
                </div>

                {/* Linha 2 – Distância + Faixa de entrega */}
                <div className="config-cards-row">
                  <div className="config-card">
                    <div className="field-label">Distância até o cliente</div>

                    <div className="distance-summary-row">
                      {orderType !== "delivery" ? (
                        <span className="chip chip-soft">
                          Disponível apenas para pedidos de entrega.
                        </span>
                      ) : isCalculatingDistance ? (
                        <span className="chip chip-soft">
                          Calculando distância...
                        </span>
                      ) : deliveryDistanceKm ? (
                        <div className="distance-km-pill">
                          <span className="distance-km-value">
                            {deliveryDistanceKm}
                          </span>
                          <span className="distance-km-suffix">km</span>
                        </div>
                      ) : (
                        <span className="chip chip-soft">
                          Selecione um cliente com endereço para calcular
                          automaticamente.
                        </span>
                      )}
                    </div>

                    <div className="field-helper">
                      Partindo de{" "}
                      <strong>
                        {deliveryConfig.baseLocationLabel ||
                          "Rua Dona Elfrida, 719 - Santa Teresinha"}
                      </strong>
                      . A distância é calculada automaticamente e não pode ser
                      editada manualmente.
                    </div>

                    {distanceError && (
                      <div className="field-error-text">{distanceError}</div>
                    )}
                  </div>

                  <div className="config-card">
                    <div className="field-label">Faixa de entrega</div>
                    <select
                      className="field-input"
                      value={
                        orderType === "delivery" ? selectedDeliveryRangeId : ""
                      }
                      onChange={(e) => {
                        const rangeId = e.target.value;
                        setSelectedDeliveryRangeId(rangeId);
                        const range =
                          deliveryConfig?.ranges?.find(
                            (r) => String(r.id) === String(rangeId)
                          ) || null;
                        if (range) {
                          const fee = Number(range.price || 0);
                          setDeliveryFee(
                            fee ? String(fee).replace(".", ",") : "0"
                          );
                          setDeliveryNeighborhood(range.label || "");
                        } else {
                          setDeliveryFee("0");
                          setDeliveryNeighborhood("");
                        }
                      }}
                      disabled={orderType !== "delivery"}
                    >
                      <option value="">
                        {orderType === "delivery"
                          ? "Selecione a faixa de entrega"
                          : "Apenas para pedidos de entrega"}
                      </option>
                      {deliveryConfig?.ranges?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} — {formatCurrency(Number(r.price || 0))}
                        </option>
                      ))}
                    </select>
                    <div className="field-helper">
                      A taxa é definida pela faixa de entrega escolhida. Valor
                      atual:{" "}
                      <strong>{formatCurrency(deliveryFeeNumber)}</strong>.
                    </div>
                  </div>
                </div>

                {/* Linha 3 – Desconto + resumo de entrega */}
                <div className="config-cards-row">
                  <div className="config-card">
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
                          onChange={(e) =>
                            setDiscountValue(e.target.value)
                          }
                          placeholder={
                            discountType === "value"
                              ? "Ex: 10,00"
                              : "Ex: 10"
                          }
                        />
                      )}
                    </div>
                    {discountType !== "none" && (
                      <div className="field-helper">
                        Desconto aplicado:{" "}
                        <strong>{formatCurrency(discountAmount)}</strong>.
                      </div>
                    )}
                  </div>

                  <div className="config-card config-card-soft">
                    <div className="field-label">Resumo da entrega</div>
                    {orderType === "delivery" ? (
                      <>
                        <div className="config-delivery-summary-line">
                          Distância:{" "}
                          <strong>
                            {deliveryDistanceKm
                              ? `${deliveryDistanceKm} km`
                              : "--"}
                          </strong>
                        </div>
                        <div className="config-delivery-summary-line">
                          Faixa:{" "}
                          <strong>
                            {deliveryNeighborhood || "Não definida"}
                          </strong>
                        </div>
                        <div className="config-delivery-summary-line">
                          Taxa:{" "}
                          <strong>
                            {formatCurrency(deliveryFeeNumber)}
                          </strong>
                        </div>
                      </>
                    ) : (
                      <div className="config-delivery-summary-line">
                        Pedido de balcão / retirada. Nenhuma taxa de entrega
                        será aplicada.
                      </div>
                    )}
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

                {/* Quantidade de sabores */}
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
                        setActiveFlavorSlot("flavor1");
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
                        setActiveFlavorSlot("flavor2");
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
                        setActiveFlavorSlot("flavor3");
                      }}
                      disabled={!hasPizzas}
                    >
                      3 sabores
                    </button>
                  </div>
                  <div className="field-helper">
                    Ao usar 2 ou 3 sabores, o sistema considera sempre o maior
                    valor entre os sabores.
                  </div>
                </div>

                {/* Slots de sabores + busca + cards */}
                <div className="pizza-search-and-select">
                  <div className="field-label">Sabores selecionados</div>
                  <div className="field-pill-group pizza-flavor-slots-row">
                    <button
                      type="button"
                      className={
                        "field-pill flavor-slot-pill" +
                        (activeFlavorSlot === "flavor1"
                          ? " field-pill-active"
                          : "")
                      }
                      onClick={() => setActiveFlavorSlot("flavor1")}
                      disabled={!hasPizzas}
                    >
                      1º sabor
                      {flavor1Pizza && (
                        <span className="flavor-slot-sub">
                          {flavor1Pizza.name}
                        </span>
                      )}
                    </button>

                    {(twoFlavorsEnabled || threeFlavorsEnabled) && (
                      <button
                        type="button"
                        className={
                          "field-pill flavor-slot-pill" +
                          (activeFlavorSlot === "flavor2"
                            ? " field-pill-active"
                            : "")
                        }
                        onClick={() => setActiveFlavorSlot("flavor2")}
                        disabled={!hasPizzas}
                      >
                        2º sabor
                        {flavor2Pizza && (
                          <span className="flavor-slot-sub">
                            {flavor2Pizza.name}
                          </span>
                        )}
                      </button>
                    )}

                    {threeFlavorsEnabled && (
                      <button
                        type="button"
                        className={
                          "field-pill flavor-slot-pill" +
                          (activeFlavorSlot === "flavor3"
                            ? " field-pill-active"
                            : "")
                        }
                        onClick={() => setActiveFlavorSlot("flavor3")}
                        disabled={!hasPizzas}
                      >
                        3º sabor
                        {flavor3Pizza && (
                          <span className="flavor-slot-sub">
                            {flavor3Pizza.name}
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="field-label">Buscar sabores</div>
                  <div className="field-input-with-icon">
                    <span className="field-input-icon">🔍</span>
                    <input
                      className="field-input"
                      value={flavorSearch}
                      onChange={(e) => setFlavorSearch(e.target.value)}
                      placeholder="Busque por nome, categoria ou ingrediente..."
                      disabled={!hasPizzas}
                    />
                  </div>

                  <div className="pizza-cards-grid">
                    {!hasPizzas && (
                      <div className="empty small">
                        Nenhuma pizza cadastrada.
                      </div>
                    )}

                    {hasPizzas && filteredPizzas.length === 0 && (
                      <div className="empty small">
                        Nenhum sabor encontrado para essa busca.
                      </div>
                    )}

                    {filteredPizzas.map((p) => {
                      const isFlavor1 = String(p.id) === String(flavor1);
                      const isFlavor2 = String(p.id) === String(flavor2);
                      const isFlavor3 = String(p.id) === String(flavor3);
                      const isSelected = isFlavor1 || isFlavor2 || isFlavor3;

                      const price =
                        p.prices[size] ||
                        p.prices.grande ||
                        p.prices.broto ||
                        0;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={
                            "pizza-card" +
                            (isSelected ? " pizza-card-selected" : "")
                          }
                          onClick={() => handleSelectFlavorCard(p.id)}
                          disabled={!hasPizzas}
                        >
                          <div className="pizza-card-header">
                            <div className="pizza-card-name">{p.name}</div>
                            <div className="pizza-card-price">
                              {formatCurrency(price)}
                            </div>
                          </div>
                          {p.categoria && (
                            <div className="pizza-card-badge">
                              {p.categoria}
                            </div>
                          )}
                          {p.description && (
                            <div className="pizza-card-desc">
                              {p.description}
                            </div>
                          )}

                          {isSelected && (
                            <div className="pizza-card-flavor-tags">
                              {isFlavor1 && (
                                <span className="chip chip-soft">1º sabor</span>
                              )}
                              {isFlavor2 && (
                                <span className="chip chip-soft">2º sabor</span>
                              )}
                              {isFlavor3 && (
                                <span className="chip chip-soft">3º sabor</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ADICIONAIS DA PIZZA */}
                <div className="pizza-extras-block">
                  <div className="pizza-extras-header">
                    <div>
                      <div className="field-label">Adicionais</div>
                      <div className="field-helper">
                        Liberados por pizza. O valor é somado ao preço
                        unitário.
                      </div>
                    </div>

                    {hasExtras && (
                      <button
                        type="button"
                        className={
                          "extras-toggle-chip" +
                          (extrasOpen ? " extras-toggle-chip-on" : "") +
                          (extrasDisabled
                            ? " extras-toggle-chip-disabled"
                            : "")
                        }
                        onClick={() =>
                          !extrasDisabled &&
                          setExtrasOpen((prev) => !prev)
                        }
                        disabled={extrasDisabled}
                      >
                        <span className="extras-toggle-thumb" />
                        <span className="extras-toggle-label">
                          {extrasOpen
                            ? "Esconder adicionais"
                            : "Mostrar adicionais"}
                        </span>
                      </button>
                    )}
                  </div>

                  {!hasExtras && (
                    <div className="field-helper">
                      Cadastre adicionais na tela de Produtos para aparecerem
                      aqui.
                    </div>
                  )}

                  {hasExtras && extrasOpen && (
                    <>
                      <div className="field-helper">
                        Selecione os adicionais desejados para esta pizza
                        antes de clicar em “Adicionar pizza ao pedido”.
                      </div>
                      <div className="extras-list">
                        {extraCatalog.map((extra) => {
                          const checked = selectedExtras.includes(extra.id);
                          const price =
                            size === "broto"
                              ? extra.prices.broto ||
                                extra.prices.grande ||
                                0
                              : extra.prices.grande ||
                                extra.prices.broto ||
                                0;
                          return (
                            <label
                              key={extra.id}
                              className={
                                "extras-item" +
                                (checked ? " extras-item-active" : "") +
                                (extrasDisabled
                                  ? " extras-item-disabled"
                                  : "")
                              }
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  handleToggleExtra(extra.id)
                                }
                                disabled={extrasDisabled}
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
                    </>
                  )}

                  {selectedExtras.length > 0 && !extrasDisabled && (
                    <div className="pizza-extras-footer">
                      <span className="chip chip-soft">
                        {selectedExtras.length} adicional(is) selecionado(s)
                      </span>
                      <span className="pizza-extras-footer-total">
                        + {formatCurrency(extrasUnitTotal)} por pizza
                      </span>
                    </div>
                  )}
                </div>

                <div className="pizza-summary-chip-row">
                  <span className="chip chip-soft">
                    {quantity || 1}x {size === "broto" ? "Broto" : "Grande"}
                  </span>
                  {flavor1 && (
                    <span className="chip">
                      1º sabor: {flavor1Pizza?.name || "Selecionado"}
                    </span>
                  )}
                  {twoFlavorsEnabled && flavor2 && (
                    <span className="chip chip-alt">
                      2º sabor: {flavor2Pizza?.name || "Selecionado"}
                    </span>
                  )}
                  {threeFlavorsEnabled && flavor3 && (
                    <span className="chip chip-alt">
                      3º sabor: {flavor3Pizza?.name || "Selecionado"}
                    </span>
                  )}
                  {selectedExtras.length > 0 && !extrasDisabled && (
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
                    className="btn btn-primary btn-lg neworder-addpizza-btn"
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
                          onChange={(e) =>
                            setSelectedDrinkId(e.target.value)
                          }
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
                          onChange={(e) =>
                            setDrinkQuantity(e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="neworder-addline-footer">
                      <button
                        type="button"
                        className="btn btn-outline neworder-adddrink-btn"
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
                                {item.extras
                                  .map((ex) => ex.name)
                                  .join(", ")}
                              </div>
                            )}
                          <div className="order-item-meta">
                            <span>
                              Unitário:{" "}
                              {formatCurrency(item.unitPrice)}
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
                      onChange={(e) =>
                        setKitchenNotes(e.target.value)
                      }
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
