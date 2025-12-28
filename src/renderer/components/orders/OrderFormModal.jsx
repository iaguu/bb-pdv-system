// src/renderer/components/orders/NewOrderModal.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "../common/Modal";
import CustomerFormModal from "../people/CustomerFormModal";
import { lookupCep } from "../clients/utils";

function digitsOnly(s) {
  return (s || "").replace(/\D/g, "");
}

async function lookupCepByAddress({ street, city, state }) {
  if (!street || !city || !state) {
    throw new Error("Endereço incompleto para buscar CEP.");
  }
  const url = `https://viacep.com.br/ws/${encodeURIComponent(
    state
  )}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Erro ao consultar CEP.");
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0 || data.erro) {
    throw new Error("CEP não encontrado.");
  }
  const first = data[0] || {};
  return {
    cep: digitsOnly(first.cep || ""),
    street: first.logradouro || "",
    neighborhood: first.bairro || "",
    city: first.localidade || city,
    state: first.uf || state,
  };
}

function normalizeNeighborhoodKey(value) {
  if (!value) return "";
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function findBlockedNeighborhood(neighborhood, blockedList) {
  if (!neighborhood || !Array.isArray(blockedList)) return null;
  const key = normalizeNeighborhoodKey(neighborhood);
  if (!key) return null;
  return (
    blockedList.find(
      (item) => normalizeNeighborhoodKey(item) === key
    ) || null
  );
}

const ORDER_DRAFT_STORAGE_KEY = "orderDraftV1";

function getMissingAddressFields(address, neighborhoodOverride) {
  const missing = [];
  const addr = address || {};
  if (!addr.street) missing.push("Rua");
  if (!addr.number) missing.push("Número");
  const neighborhood =
    neighborhoodOverride || addr.neighborhood || addr.bairro || "";
  if (!neighborhood) missing.push("Bairro");
  if (!addr.city) missing.push("Cidade");
  if (!addr.state) missing.push("Estado");
  return missing;
}

function createEmptyAltAddress() {
  return {
    id: "",
    label: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
  };
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
  blockedNeighborhoods: [],
  minOrderValue: 0,
  maxDistanceKm: 0,
  etaMinutesDefault: 45,
  peakFee: {
    enabled: false,
    days: [],
    startTime: "18:00",
    endTime: "22:00",
    amount: 0,
  },
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

function buildWeeklySchedule(
  openTime = "11:00",
  closeTime = "23:00",
  closedWeekdays = []
) {
  const closed = Array.isArray(closedWeekdays) ? closedWeekdays : [];
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    enabled: !closed.includes(day),
    openTime,
    closeTime,
  }));
}

const DEFAULT_BUSINESS_HOURS = {
  enabled: false,
  openTime: "11:00",
  closeTime: "23:00",
  closedWeekdays: [],
  weeklySchedule: buildWeeklySchedule(),
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
    minOrderValue:
      typeof delivery.minOrderValue === "number"
        ? delivery.minOrderValue
        : Number(delivery.minOrderValue || 0),
    maxDistanceKm:
      typeof delivery.maxDistanceKm === "number"
        ? delivery.maxDistanceKm
        : Number(delivery.maxDistanceKm || 0),
    etaMinutesDefault:
      typeof delivery.etaMinutesDefault === "number"
        ? delivery.etaMinutesDefault
        : Number(delivery.etaMinutesDefault || 45),
    blockedNeighborhoods: Array.isArray(delivery.blockedNeighborhoods)
      ? delivery.blockedNeighborhoods
          .map((b) => (b || "").toString().trim())
          .filter(Boolean)
      : [],
    peakFee: {
      enabled: !!delivery.peakFee?.enabled,
      days: Array.isArray(delivery.peakFee?.days)
        ? delivery.peakFee.days
        : [],
      startTime: delivery.peakFee?.startTime || "18:00",
      endTime: delivery.peakFee?.endTime || "22:00",
      amount:
        typeof delivery.peakFee?.amount === "number"
          ? delivery.peakFee.amount
          : Number(delivery.peakFee?.amount || 0),
    },
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

function normalizeBusinessHoursFromSettings(rawSettings) {
  if (!rawSettings) return DEFAULT_BUSINESS_HOURS;

  let settingsObj = null;
  if (Array.isArray(rawSettings?.items) && rawSettings.items.length > 0) {
    settingsObj = rawSettings.items[0];
  } else if (Array.isArray(rawSettings) && rawSettings.length > 0) {
    settingsObj = rawSettings[0];
  } else if (typeof rawSettings === "object") {
    settingsObj = rawSettings;
  }

  const hours = settingsObj?.businessHours || {};
  const openTime = hours.openTime || DEFAULT_BUSINESS_HOURS.openTime;
  const closeTime = hours.closeTime || DEFAULT_BUSINESS_HOURS.closeTime;
  const closedWeekdays = Array.isArray(hours.closedWeekdays)
    ? hours.closedWeekdays
    : [];
  const baseSchedule = buildWeeklySchedule(
    openTime,
    closeTime,
    closedWeekdays
  );
  const rawSchedule = Array.isArray(hours.weeklySchedule)
    ? hours.weeklySchedule
    : null;
  const weeklySchedule = rawSchedule
    ? baseSchedule.map((entry) => {
        const match = rawSchedule.find(
          (item) => Number(item.day) === entry.day
        );
        if (!match) return entry;
        return {
          ...entry,
          enabled: match.enabled !== false,
          openTime: match.openTime || entry.openTime,
          closeTime: match.closeTime || entry.closeTime,
        };
      })
    : baseSchedule;
  const normalizedClosed = weeklySchedule
    .filter((entry) => entry.enabled === false)
    .map((entry) => entry.day);

  return {
    enabled: !!hours.enabled,
    openTime,
    closeTime,
    closedWeekdays: normalizedClosed,
    weeklySchedule,
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

function parseTimeToMinutes(value) {
  if (!value || typeof value !== "string") return null;
  const [h, m] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function isWithinTimeRange(nowMinutes, startMinutes, endMinutes) {
  if (startMinutes === null || endMinutes === null) return true;
  if (startMinutes === endMinutes) return true;
  if (endMinutes > startMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

function getBusinessHoursStatus(businessHours, date = new Date()) {
  if (!businessHours?.enabled) return { isOpen: true, reason: "" };

  const weekday = date.getDay();
  const closed = Array.isArray(businessHours.closedWeekdays)
    ? businessHours.closedWeekdays
    : [];
  const schedule = Array.isArray(businessHours.weeklySchedule)
    ? businessHours.weeklySchedule
    : [];
  const scheduleEntry = schedule.find(
    (entry) => Number(entry.day) === weekday
  );

  if (scheduleEntry && scheduleEntry.enabled === false) {
    return { isOpen: false, reason: "Dia fechado." };
  }
  if (!scheduleEntry && closed.includes(weekday)) {
    return { isOpen: false, reason: "Dia fechado." };
  }

  const openTime =
    scheduleEntry?.openTime ||
    businessHours.openTime ||
    DEFAULT_BUSINESS_HOURS.openTime;
  const closeTime =
    scheduleEntry?.closeTime ||
    businessHours.closeTime ||
    DEFAULT_BUSINESS_HOURS.closeTime;

  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);
  const isOpen = isWithinTimeRange(nowMinutes, openMinutes, closeMinutes);
  return {
    isOpen,
    reason: isOpen ? "" : "Fora do horário de funcionamento.",
  };
}

function isWithinPeakWindow(peakFee, date = new Date()) {
  if (!peakFee?.enabled) return false;
  const days = Array.isArray(peakFee.days) ? peakFee.days : [];
  const weekday = date.getDay();
  if (days.length > 0 && !days.includes(weekday)) return false;
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = parseTimeToMinutes(peakFee.startTime);
  const endMinutes = parseTimeToMinutes(peakFee.endTime);
  return isWithinTimeRange(nowMinutes, startMinutes, endMinutes);
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

function formatDecimalInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).trim().replace(",", ".");
  const num = Number(normalized);
  if (Number.isNaN(num)) return "";
  return String(num).replace(".", ",");
}

function toDecimalString(value, fallback = "0") {
  const formatted = formatDecimalInput(value);
  return formatted !== "" ? formatted : fallback;
}

function readOrderDraftFromStorage() {
  try {
    if (!window?.localStorage) return null;
    const raw = window.localStorage.getItem(ORDER_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    console.warn("[NewOrderModal] draft read failed:", err);
    return null;
  }
}

function writeOrderDraftToStorage(payload) {
  try {
    if (!window?.localStorage) return;
    window.localStorage.setItem(
      ORDER_DRAFT_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch (err) {
    console.warn("[NewOrderModal] draft write failed:", err);
  }
}

function clearOrderDraftStorage() {
  try {
    if (!window?.localStorage) return;
    window.localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY);
  } catch (err) {
    console.warn("[NewOrderModal] draft clear failed:", err);
  }
}

function resolveOrderTypePayload(order) {
  const typeRaw =
    (order?.orderType ||
      order?.type ||
      order?.delivery?.mode ||
      (order?.source === "pickup" ? "pickup" : "") ||
      "")
      .toString()
      .toLowerCase()
      .trim();

  if (["pickup", "retirada"].includes(typeRaw)) {
    return "pickup";
  }
  if (["counter", "balcao", "balcão", "local"].includes(typeRaw)) {
    return "counter";
  }
  return "delivery";
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
  initialOrder,
}) {
  // -----------------------------
  // Estado vindo do DB
  // -----------------------------
  const [customers, setCustomers] = useState([]);
  const [pizzaCatalog, setPizzaCatalog] = useState([]);
  const [drinkCatalog, setDrinkCatalog] = useState([]);
  const [extraCatalog, setExtraCatalog] = useState([]);
  const [deliveryConfig, setDeliveryConfig] = useState(DEFAULT_DELIVERY_CONFIG);
  const [businessHours, setBusinessHours] = useState(
    DEFAULT_BUSINESS_HOURS
  );
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
  const [selectedCustomerAddressId, setSelectedCustomerAddressId] =
    useState("primary");
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);
  const [showAltAddressModal, setShowAltAddressModal] = useState(false);
  const [altAddressDraft, setAltAddressDraft] = useState(() =>
    createEmptyAltAddress()
  );
  const [altAddressError, setAltAddressError] = useState("");
  const [isSyncingCustomerAddress, setIsSyncingCustomerAddress] =
    useState(false);
  const lastAddressSyncRef = useRef("");
  const lastDistanceCalcRef = useRef("");

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
  const [deliveryAddressNeighborhood, setDeliveryAddressNeighborhood] =
    useState("");
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
  const initialOrderRef = useRef(null);
  const hydratePendingRef = useRef(false);
  const draftRestoredRef = useRef(false);

  const hydrateInitialOrder = useCallback(
    (order) => {
      if (!order) return;

      const baseTimestamp = Date.now();
      const normalizedItems = (Array.isArray(order.items) ? order.items : []).map(
        (item, idx) => ({
          ...item,
          lineId:
            item.lineId ||
            item.id ||
            `line-${baseTimestamp}-${idx}-${Math.floor(Math.random() * 1000)}`,
        })
      );

      setOrderItems(normalizedItems);

      const snapshot = order.customerSnapshot || {};
      const snapshotName =
        snapshot.name ||
        order.customerName ||
        order.customer?.name ||
        order.customer?.customerName ||
        "Cliente";
      const preferCounter =
        (order.customerMode || "")
          .toString()
          .toLowerCase()
          .trim() === "counter";

      const customerIdCandidate =
        order.customerId ||
        snapshot.id ||
        order.customer?.id ||
        order.customer?.customerId ||
        null;
      let matchingCustomer =
        customerIdCandidate != null
          ? customers.find(
              (c) => String(c.id) === String(customerIdCandidate)
            )
          : null;

      if (!matchingCustomer) {
        const candidatePhone = digitsOnly(
          snapshot.phone ||
            order.customerPhone ||
            order.customer?.phone ||
            ""
        );
        if (candidatePhone) {
          matchingCustomer =
            customers.find(
              (c) =>
                digitsOnly(c.phone || c.telefone || "") === candidatePhone
            ) || matchingCustomer;
        }
      }

      if (!matchingCustomer) {
        const candidateCpf = digitsOnly(
          snapshot.cpf ||
            order.customerCpf ||
            order.customer?.cpf ||
            order.customer?.document ||
            ""
        );
        if (candidateCpf) {
          matchingCustomer =
            customers.find(
              (c) =>
                digitsOnly(c.cpf || c.document || c.cpf_cnpj || "") ===
                candidateCpf
            ) || matchingCustomer;
        }
      }

      if (!preferCounter && matchingCustomer) {
        setCustomerMode("registered");
        setSelectedCustomerId(matchingCustomer.id);
        const addressIdCandidate =
          order.customerAddressId ||
          order.customerAddress?.id ||
          order.customer?.addressId ||
          null;
        if (addressIdCandidate && Array.isArray(matchingCustomer.addresses)) {
          const exists = matchingCustomer.addresses.some(
            (addr) => String(addr.id) === String(addressIdCandidate)
          );
          setSelectedCustomerAddressId(
            exists ? addressIdCandidate : "primary"
          );
        } else {
          setSelectedCustomerAddressId("primary");
        }
        setShowCustomerSearch(!!customers.length);
        setCounterLabel("Balcão");
      } else {
        setCustomerMode("counter");
        setSelectedCustomerId(null);
        setSelectedCustomerAddressId("primary");
        setShowCustomerSearch(false);
        const counterLabelValue =
          (order.counterLabel || snapshotName || "").trim() || "Cliente";
        setCounterLabel(counterLabelValue);
      }

      setCustomerSearch("");

      setOrderType(resolveOrderTypePayload(order));

      const paymentMethodRaw = (
        order.payment?.method || order.paymentMethod || ""
      ).toString();
      setPaymentMethod(paymentMethodRaw.toLowerCase());

      setOrderNotes(
        order.orderNotes ||
          order.notes ||
          order.observacao ||
          order.obs ||
          ""
      );
      setKitchenNotes(
        order.kitchenNotes || order.kitchen || order.observacoes || ""
      );

      const deliveryFeeValue =
        order.delivery?.fee ??
        order.totals?.deliveryFee ??
        order.deliveryFee ??
        0;
      setDeliveryFee(toDecimalString(deliveryFeeValue));

      setDeliveryNeighborhood(
        order.delivery?.neighborhood ||
          order.deliveryNeighborhood ||
          order.delivery?.bairro ||
          ""
      );

      const addressNeighborhood =
        order.customerAddress?.neighborhood ||
        order.customerAddress?.bairro ||
        order.customer?.address?.neighborhood ||
        order.customer?.address?.bairro ||
        order.delivery?.neighborhood ||
        order.delivery?.bairro ||
        "";
      setDeliveryAddressNeighborhood(addressNeighborhood);

      const distanceValue =
        order.deliveryDistanceKm ??
        order.delivery?.distanceKm ??
        order.delivery?.distance ??
        "";
      setDeliveryDistanceKm(toDecimalString(distanceValue, ""));

      const discountSource = order.discount;
      const totalsDiscount =
        typeof order.totals?.discount === "number"
          ? order.totals.discount
          : null;
      const discountValueRaw =
        typeof discountSource === "object"
          ? discountSource.value ?? discountSource.amount ?? null
          : typeof discountSource === "number"
          ? discountSource
          : order.discountValue ??
            order.discountAmount ??
            totalsDiscount ??
            null;
      const numericDiscount =
        discountValueRaw !== null && discountValueRaw !== undefined
          ? Number(String(discountValueRaw).replace(",", "."))
          : 0;

      const formattedDiscountValue = toDecimalString(discountValueRaw);
      if (numericDiscount > 0) {
        const discountTypeValue =
          (typeof discountSource === "object" &&
            discountSource.type === "percent") ||
          order.discountType === "percent"
            ? "percent"
            : "value";
        setDiscountType(discountTypeValue);
        setDiscountValue(formattedDiscountValue);
      } else {
        setDiscountType("none");
        setDiscountValue("0");
      }

      const cashGivenValue =
        order.payment?.cashGiven ??
        order.cash?.cashGiven ??
        order.cashGiven ??
        0;
      setCashGiven(toDecimalString(cashGivenValue));
    },
    [customers]
  );

  useEffect(() => {
    if (!isOpen || !initialOrder) {
      initialOrderRef.current = null;
      hydratePendingRef.current = false;
      return;
    }

    if (initialOrderRef.current !== initialOrder) {
      initialOrderRef.current = initialOrder;
      hydratePendingRef.current = true;
    }
  }, [initialOrder, isOpen]);

  useEffect(() => {
    if (
      !isOpen ||
      !initialOrder ||
      isLoading ||
      !hydratePendingRef.current
    ) {
      return;
    }

    hydrateInitialOrder(initialOrder);
    hydratePendingRef.current = false;
  }, [initialOrder, isLoading, isOpen, hydrateInitialOrder]);
  // -----------------------------
  // Load do banco
  // -----------------------------
  useEffect(() => {
    if (!isOpen) return;

    let cancel = false;
    const isEditing = Boolean(initialOrder);

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
          const bHours = normalizeBusinessHoursFromSettings(settingsDb);

          setCustomers(customersArr);
          setPizzaCatalog(pizzas);
          setDrinkCatalog(drinks);
          setExtraCatalog(extras);
          setDeliveryConfig(dCfg);
          setBusinessHours(bHours);

          if (!isEditing) {
            setCustomerMode(customersArr.length ? "registered" : "counter");
            setCustomerSearch("");
            setSelectedCustomerId(null);
            setSelectedCustomerAddressId("primary");
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
            setDeliveryAddressNeighborhood("");
            setDeliveryFee("0");
            setDiscountType("none");
            setDiscountValue("0");
            setOrderNotes("");
            setKitchenNotes("");
            setCashGiven("");

            setDistanceError("");
            setIsCalculatingDistance(false);
          }

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
        setBusinessHours(DEFAULT_BUSINESS_HOURS);

        if (!isEditing) {
          setCustomerMode("counter");
          setCustomerSearch("");
          setSelectedCustomerId(null);
          setSelectedCustomerAddressId("primary");
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
          setDeliveryAddressNeighborhood("");
          setDeliveryFee("0");
          setDiscountType("none");
          setDiscountValue("0");
          setOrderNotes("");
          setKitchenNotes("");
          setCashGiven("");

          setDistanceError("");
          setIsCalculatingDistance(false);
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
  }, [isOpen, initialCatalog, initialOrder]);

  // -----------------------------
  // Cliente selecionado (memo)
  // -----------------------------
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;

    const digits = digitsOnly(term);
    const hasDigits = digits.length > 0;

    return customers.filter((c) => {
      const name = (c.name || c.nome || "").toLowerCase();
      const phone = (c.phone || c.phoneRaw || c.telefone || "")
        .toString()
        .toLowerCase();
      const cpf = (c.cpf || c.document || c.cpf_cnpj || "")
        .toString()
        .toLowerCase();
      const phoneDigits = digitsOnly(
        c.phone || c.phoneRaw || c.telefone || ""
      );
      const cpfDigits = digitsOnly(c.cpf || c.document || c.cpf_cnpj || "");

      const matchesText =
        name.includes(term) || phone.includes(term) || cpf.includes(term);
      const matchesDigits =
        hasDigits &&
        (phoneDigits.includes(digits) || cpfDigits.includes(digits));

      return matchesText || matchesDigits;
    });
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customers]);

  useEffect(() => {
    if (!selectedCustomerId) {
      if (selectedCustomerAddressId !== "primary") {
        setSelectedCustomerAddressId("primary");
      }
      return;
    }

    if (!selectedCustomerAddressId) {
      setSelectedCustomerAddressId("primary");
      return;
    }

    if (selectedCustomerAddressId === "primary") return;

    const customer = customers.find(
      (c) => String(c.id) === String(selectedCustomerId)
    );
    const addresses = Array.isArray(customer?.addresses)
      ? customer.addresses
      : [];
    const exists = addresses.some(
      (addr) => String(addr.id) === String(selectedCustomerAddressId)
    );

    if (!exists) {
      setSelectedCustomerAddressId("primary");
    }
  }, [selectedCustomerId, selectedCustomerAddressId, customers]);

  const customerAltAddresses = useMemo(() => {
    if (!selectedCustomer?.addresses) return [];
    return Array.isArray(selectedCustomer.addresses)
      ? selectedCustomer.addresses
      : [];
  }, [selectedCustomer]);

  const activeCustomerAddress = useMemo(() => {
    if (!selectedCustomer) return null;
    if (selectedCustomerAddressId === "primary") {
      return selectedCustomer.address || null;
    }
    return (
      customerAltAddresses.find(
        (addr) => String(addr.id) === String(selectedCustomerAddressId)
      ) ||
      selectedCustomer.address ||
      null
    );
  }, [selectedCustomer, customerAltAddresses, selectedCustomerAddressId]);

  const activeCustomerAddressLabel = useMemo(() => {
    if (!selectedCustomer) return "";
    if (selectedCustomerAddressId === "primary") return "Endereço principal";
    const match = customerAltAddresses.find(
      (addr) => String(addr.id) === String(selectedCustomerAddressId)
    );
    const label = match?.label || match?.apelido || "";
    return label ? `Alternativo: ${label}` : "Endereço alternativo";
  }, [selectedCustomer, customerAltAddresses, selectedCustomerAddressId]);

  useEffect(() => {
    if (customerMode !== "registered") return;
    const addr = activeCustomerAddress || {};
    const neighborhood = addr.neighborhood || addr.bairro || "";
    setDeliveryAddressNeighborhood(neighborhood);
  }, [
    selectedCustomerId,
    selectedCustomerAddressId,
    customerMode,
    activeCustomerAddress,
  ]);

  const recentCustomers = useMemo(() => {
    if (!customers.length) return [];
    const mapped = customers
      .map((c) => {
        const lastOrderAt =
          c.meta?.lastOrderAt || c.lastOrderAt || c.updatedAt || c.createdAt;
        const ts = Date.parse(lastOrderAt || "");
        return { customer: c, ts: Number.isNaN(ts) ? 0 : ts };
      })
      .filter((entry) => entry.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5);
    return mapped.map((entry) => entry.customer);
  }, [customers]);

  const refreshCustomers = useCallback(async () => {
    if (!window?.dataEngine?.get) return [];
    try {
      const customersDb = await window.dataEngine.get("customers");
      const customersArr = Array.isArray(customersDb?.items)
        ? customersDb.items
        : Array.isArray(customersDb)
        ? customersDb
        : [];
      setCustomers(customersArr);
      return customersArr;
    } catch (err) {
      console.error("[OrderFormModal] Erro ao recarregar clientes:", err);
      return [];
    }
  }, []);

  const updateCustomerRecord = useCallback(async (id, changes) => {
    if (!window?.dataEngine?.updateItem) return null;
    try {
      const updated = await window.dataEngine.updateItem(
        "customers",
        id,
        changes
      );
      setCustomers((prev) =>
        prev.map((c) => (String(c.id) === String(id) ? updated : c))
      );
      return updated;
    } catch (err) {
      console.error("[OrderFormModal] Erro ao atualizar cliente:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!showAltAddressModal) return;
    setAltAddressDraft(createEmptyAltAddress());
    setAltAddressError("");
  }, [showAltAddressModal]);

  const handleAltAddressFieldChange = (field, value) => {
    if (altAddressError) {
      setAltAddressError("");
    }
    setAltAddressDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAltAddressCepLookup = async () => {
    const cepDigits = digitsOnly(altAddressDraft.cep);
    if (cepDigits.length !== 8) {
      setAltAddressError("CEP deve ter 8 dígitos.");
      return;
    }
    try {
      setAltAddressError("");
      const data = await lookupCep(cepDigits);
      setAltAddressDraft((prev) => ({
        ...prev,
        cep: data.cep,
        street: prev.street || data.street,
        neighborhood: prev.neighborhood || data.neighborhood,
        city: data.city,
        state: data.state,
      }));
    } catch (err) {
      setAltAddressError(err.message || "Não foi possível buscar o CEP.");
    }
  };

  const handleUseAddress = (addressId) => {
    setSelectedCustomerAddressId(addressId);
    setShowAltAddressModal(false);

    const addr =
      addressId === "primary"
        ? selectedCustomer?.address
        : customerAltAddresses.find(
            (item) => String(item.id) === String(addressId)
          );

    if (addr?.neighborhood || addr?.bairro) {
      setDeliveryAddressNeighborhood(
        addr.neighborhood || addr.bairro || ""
      );
    }
  };

  const handleSaveAltAddress = async () => {
    if (!selectedCustomer) return;
    setAltAddressError("");

    const cepDigits = digitsOnly(altAddressDraft.cep);
    let draft = {
      ...altAddressDraft,
      cep: cepDigits,
      street: altAddressDraft.street.trim(),
      neighborhood: altAddressDraft.neighborhood.trim(),
      city: altAddressDraft.city.trim(),
      state: altAddressDraft.state.trim(),
      number: altAddressDraft.number.trim(),
      complement: altAddressDraft.complement.trim(),
      reference: altAddressDraft.reference.trim(),
      label: altAddressDraft.label.trim(),
    };

    if (cepDigits.length === 8 && (!draft.city || !draft.state)) {
      try {
        const data = await lookupCep(cepDigits);
        draft = {
          ...draft,
          street: draft.street || data.street,
          neighborhood: draft.neighborhood || data.neighborhood,
          city: draft.city || data.city,
          state: draft.state || data.state,
        };
      } catch (err) {
        setAltAddressError(err.message || "Não foi possível buscar o CEP.");
        return;
      }
    }

    if (
      !cepDigits &&
      draft.street &&
      draft.city &&
      draft.state
    ) {
      try {
        const data = await lookupCepByAddress({
          street: draft.street,
          city: draft.city,
          state: draft.state,
        });
        draft = {
          ...draft,
          cep: data.cep || draft.cep,
          neighborhood: draft.neighborhood || data.neighborhood,
        };
      } catch (err) {
        setAltAddressError(
          err.message || "Não foi possível identificar o CEP."
        );
        return;
      }
    }

    const missing = getMissingAddressFields(
      draft,
      draft.neighborhood || ""
    );
    if (missing.length > 0) {
      setAltAddressError(
        `Endereço incompleto. Faltam: ${missing.join(", ")}.`
      );
      return;
    }

    const newId =
      draft.id ||
      `addr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nextAddress = {
      ...draft,
      id: newId,
      label:
        draft.label ||
        `Endereço ${customerAltAddresses.length + 1}`,
    };

    const updatedAddresses = [
      ...customerAltAddresses.filter(
        (item) => String(item.id) !== String(newId)
      ),
      nextAddress,
    ];

    const updatedCustomer = await updateCustomerRecord(
      selectedCustomer.id,
      {
        addresses: updatedAddresses,
      }
    );

    if (updatedCustomer) {
      setSelectedCustomerAddressId(newId);
      setShowAltAddressModal(false);
      setDeliveryAddressNeighborhood(
        nextAddress.neighborhood || ""
      );
    }
  };

  const deliveryNeighborhoodValue = useMemo(() => {
    if (deliveryAddressNeighborhood) return deliveryAddressNeighborhood.trim();
    const addr = activeCustomerAddress || {};
    return addr.neighborhood || addr.bairro || "";
  }, [deliveryAddressNeighborhood, activeCustomerAddress]);

  const customerAddressLines = useMemo(() => {
    if (!activeCustomerAddress) {
      return { line1: "", line2: "" };
    }
    const addr = activeCustomerAddress || {};
    let line1 = "";
    if (addr.street) {
      line1 = addr.street;
      if (addr.number) line1 += `, ${addr.number}`;
    }

    const neighborhood =
      deliveryNeighborhoodValue || addr.neighborhood || addr.bairro || "";
    let line2 = "";
    if (neighborhood) line2 = neighborhood;
    if (addr.city) line2 += (line2 ? " - " : "") + addr.city;
    if (addr.state) line2 += (line2 ? " / " : "") + addr.state;

    return { line1, line2 };
  }, [activeCustomerAddress, deliveryNeighborhoodValue]);

  const missingAddressFields = useMemo(() => {
    if (!selectedCustomer || customerMode !== "registered") return [];
    return getMissingAddressFields(
      activeCustomerAddress,
      deliveryNeighborhoodValue
    );
  }, [selectedCustomer, customerMode, deliveryNeighborhoodValue, activeCustomerAddress]);

  const isDeliveryAddressComplete = missingAddressFields.length === 0;

  const blockedNeighborhoodMatch = useMemo(() => {
    if (!deliveryNeighborhoodValue) return null;
    return findBlockedNeighborhood(
      deliveryNeighborhoodValue,
      deliveryConfig?.blockedNeighborhoods
    );
  }, [deliveryNeighborhoodValue, deliveryConfig?.blockedNeighborhoods]);

  const deliveryTypeBlockedReason = useMemo(() => {
    if (customerMode !== "registered") {
      return "Disponível apenas para clientes cadastrados.";
    }
    if (!selectedCustomer) {
      return "Selecione um cliente cadastrado.";
    }
    if (!isDeliveryAddressComplete) {
      return `Endereço incompleto: ${missingAddressFields.join(", ")}.`;
    }
    if (blockedNeighborhoodMatch) {
      return `Bairro bloqueado: ${blockedNeighborhoodMatch}.`;
    }
    return "";
  }, [
    customerMode,
    selectedCustomer,
    isDeliveryAddressComplete,
    missingAddressFields,
    blockedNeighborhoodMatch,
  ]);

  const businessHoursStatus = useMemo(
    () => getBusinessHoursStatus(businessHours),
    [businessHours]
  );

  const isEditing = Boolean(initialOrder);

  const buildDraftSnapshot = useCallback(
    () => ({
      customerMode,
      selectedCustomerId,
      selectedCustomerAddressId,
      counterLabel,
      orderItems,
      orderType,
      paymentMethod,
      deliveryDistanceKm,
      deliveryNeighborhood,
      deliveryAddressNeighborhood,
      deliveryFee,
      selectedDeliveryRangeId,
      discountType,
      discountValue,
      orderNotes,
      kitchenNotes,
      cashGiven,
    }),
    [
      customerMode,
      selectedCustomerId,
      selectedCustomerAddressId,
      counterLabel,
      orderItems,
      orderType,
      paymentMethod,
      deliveryDistanceKm,
      deliveryNeighborhood,
      deliveryAddressNeighborhood,
      deliveryFee,
      selectedDeliveryRangeId,
      discountType,
      discountValue,
      orderNotes,
      kitchenNotes,
      cashGiven,
    ]
  );

  const applyDraftSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot || typeof snapshot !== "object") return;

      const nextCustomerMode =
        snapshot.customerMode === "counter" ? "counter" : "registered";
      setCustomerMode(nextCustomerMode);
      setCounterLabel(snapshot.counterLabel || "Balcão");

      const customerExists = customers.some(
        (c) => String(c.id) === String(snapshot.selectedCustomerId)
      );
      const nextCustomerId = customerExists ? snapshot.selectedCustomerId : null;
      setSelectedCustomerId(nextCustomerId);
      setShowCustomerSearch(!customerExists);
      setCustomerSearch("");

      const addressIdCandidate =
        snapshot.selectedCustomerAddressId ||
        snapshot.customerAddressId ||
        "primary";
      if (!customerExists || !nextCustomerId) {
        setSelectedCustomerAddressId("primary");
      } else if (addressIdCandidate === "primary") {
        setSelectedCustomerAddressId("primary");
      } else {
        const matchedCustomer = customers.find(
          (c) => String(c.id) === String(nextCustomerId)
        );
        const addresses = Array.isArray(matchedCustomer?.addresses)
          ? matchedCustomer.addresses
          : [];
        const exists = addresses.some(
          (addr) => String(addr.id) === String(addressIdCandidate)
        );
        setSelectedCustomerAddressId(exists ? addressIdCandidate : "primary");
      }

      setOrderItems(
        Array.isArray(snapshot.orderItems) ? snapshot.orderItems : []
      );
      setOrderType(snapshot.orderType || "delivery");
      setPaymentMethod(snapshot.paymentMethod || "");
      setDeliveryDistanceKm(snapshot.deliveryDistanceKm || "");
      setDeliveryNeighborhood(snapshot.deliveryNeighborhood || "");
      setDeliveryAddressNeighborhood(
        snapshot.deliveryAddressNeighborhood || ""
      );
      setDeliveryFee(snapshot.deliveryFee || "0");
      setSelectedDeliveryRangeId(snapshot.selectedDeliveryRangeId || "");
      setDiscountType(snapshot.discountType || "none");
      setDiscountValue(snapshot.discountValue || "0");
      setOrderNotes(snapshot.orderNotes || "");
      setKitchenNotes(snapshot.kitchenNotes || "");
      setCashGiven(snapshot.cashGiven || "");
    },
    [customers]
  );

  const handleClose = useCallback(() => {
    if (!isEditing) {
      const snapshot = buildDraftSnapshot();
      const hasData =
        (snapshot.orderItems && snapshot.orderItems.length > 0) ||
        snapshot.orderNotes ||
        snapshot.kitchenNotes ||
        snapshot.deliveryDistanceKm ||
        snapshot.discountValue !== "0" ||
        snapshot.cashGiven ||
        snapshot.selectedCustomerId;

      if (hasData) {
        writeOrderDraftToStorage({
          savedAt: new Date().toISOString(),
          draft: snapshot,
        });
      }
    }

    if (typeof onClose === "function") {
      onClose();
    }
  }, [isEditing, buildDraftSnapshot, onClose]);

  useEffect(() => {
    if (!isOpen) {
      draftRestoredRef.current = false;
      return;
    }
    if (isEditing || draftRestoredRef.current) return;
    if (customerMode === "registered" && customers.length === 0) return;

    const stored = readOrderDraftFromStorage();
    if (!stored?.draft) return;

    applyDraftSnapshot(stored.draft);
    draftRestoredRef.current = true;
  }, [
    isOpen,
    isEditing,
    customerMode,
    customers.length,
    applyDraftSnapshot,
  ]);

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
  const handleAutoDistanceFromCustomer = useCallback(async (customerParam, neighborhoodOverride) => {
    const customer = customerParam || selectedCustomer;
    const neighborhoodValue =
      neighborhoodOverride ?? deliveryAddressNeighborhood;

    if (orderType !== "delivery" || !customer || !customer.address) {
      setDistanceError("Selecione um cliente para entrega.");
      return;
    }

    const addr = customer.address || {};
    const missing = getMissingAddressFields(addr, neighborhoodValue);
    if (missing.length > 0) {
      setDistanceError(
        `Endereço incompleto. Faltam: ${missing.join(", ")}.`
      );
      return;
    }
    const parts = [];

    if (addr.street) {
      let line1 = addr.street;
      if (addr.number) line1 += `, ${addr.number}`;
      parts.push(line1);
    }

    const neighborhood =
      neighborhoodValue || addr.neighborhood || addr.bairro;
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
  }, [orderType, selectedCustomer, deliveryAddressNeighborhood]);

  useEffect(() => {
    if (customerMode !== "registered") return;
    if (!selectedCustomer || !activeCustomerAddress) return;
    const addr = activeCustomerAddress || {};
    const cepDigits = digitsOnly(addr.cep || "");
    const hasCep = cepDigits.length === 8;
    const missingCityState = !addr.city || !addr.state;
    const canLookupByCep = hasCep && missingCityState;
    const canLookupByAddress =
      !hasCep && addr.street && addr.city && addr.state;

    if (!canLookupByCep && !canLookupByAddress) return;

    const key = [
      selectedCustomer.id,
      selectedCustomerAddressId,
      cepDigits,
      addr.street || "",
      addr.neighborhood || "",
      addr.city || "",
      addr.state || "",
    ].join("|");

    if (lastAddressSyncRef.current === key) return;
    lastAddressSyncRef.current = key;

    let cancelled = false;

    const syncAddress = async () => {
      setIsSyncingCustomerAddress(true);
      try {
        const lookupData = canLookupByCep
          ? await lookupCep(cepDigits)
          : await lookupCepByAddress({
              street: addr.street,
              city: addr.city,
              state: addr.state,
            });

        const patch = {
          cep: addr.cep || lookupData.cep,
          street: addr.street || lookupData.street,
          neighborhood: addr.neighborhood || lookupData.neighborhood,
          city: addr.city || lookupData.city,
          state: addr.state || lookupData.state,
        };

        const updatedAddress = {
          ...addr,
          ...patch,
        };

        let updatedCustomer = null;
        if (selectedCustomerAddressId === "primary") {
          updatedCustomer = await updateCustomerRecord(selectedCustomer.id, {
            address: updatedAddress,
          });
        } else {
          const updatedAddresses = customerAltAddresses.map((item) =>
            String(item.id) === String(selectedCustomerAddressId)
              ? { ...item, ...updatedAddress }
              : item
          );
          updatedCustomer = await updateCustomerRecord(selectedCustomer.id, {
            addresses: updatedAddresses,
          });
        }

        if (cancelled || !updatedCustomer) return;

        const nextNeighborhood =
          updatedAddress.neighborhood || updatedAddress.bairro || "";
        if (nextNeighborhood) {
          setDeliveryAddressNeighborhood(nextNeighborhood);
        }

        if (orderType === "delivery") {
          lastDistanceCalcRef.current = [
            selectedCustomer.id,
            selectedCustomerAddressId,
            nextNeighborhood || deliveryNeighborhoodValue,
            updatedAddress.cep || "",
            updatedAddress.street || "",
            updatedAddress.number || "",
            updatedAddress.city || "",
            updatedAddress.state || "",
          ].join("|");
          await handleAutoDistanceFromCustomer(
            { ...updatedCustomer, address: updatedAddress },
            nextNeighborhood || deliveryNeighborhoodValue
          );
        }
      } catch (err) {
        console.error("[OrderFormModal] Erro ao buscar CEP:", err);
      } finally {
        if (!cancelled) setIsSyncingCustomerAddress(false);
      }
    };

    void syncAddress();

    return () => {
      cancelled = true;
    };
  }, [
    customerMode,
    selectedCustomer,
    selectedCustomerAddressId,
    activeCustomerAddress,
    customerAltAddresses,
    orderType,
    deliveryNeighborhoodValue,
    updateCustomerRecord,
    handleAutoDistanceFromCustomer,
  ]);

  useEffect(() => {
    if (customerMode !== "registered") return;
    if (orderType !== "delivery") return;
    if (!selectedCustomer || !activeCustomerAddress) return;
    if (missingAddressFields.length > 0) return;
    if (isCalculatingDistance) return;

    const key = [
      selectedCustomer.id,
      selectedCustomerAddressId,
      deliveryNeighborhoodValue,
      activeCustomerAddress.cep || "",
      activeCustomerAddress.street || "",
      activeCustomerAddress.number || "",
      activeCustomerAddress.city || "",
      activeCustomerAddress.state || "",
    ].join("|");

    if (lastDistanceCalcRef.current === key) return;
    lastDistanceCalcRef.current = key;

    void handleAutoDistanceFromCustomer(
      { ...selectedCustomer, address: activeCustomerAddress },
      deliveryNeighborhoodValue
    );
  }, [
    customerMode,
    orderType,
    selectedCustomer,
    activeCustomerAddress,
    selectedCustomerAddressId,
    deliveryNeighborhoodValue,
    missingAddressFields.length,
    isCalculatingDistance,
    handleAutoDistanceFromCustomer,
  ]);

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

  const handleOrderTypeChange = (value) => {
    if (value === "delivery" && deliveryTypeBlockedReason) {
      setDistanceError(deliveryTypeBlockedReason);
      return;
    }
    if (value !== "delivery") {
      setDistanceError("");
    }
    setOrderType(value);
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

  const baseDeliveryFeeNumber = useMemo(
    () => Number(String(deliveryFee).replace(",", ".")) || 0,
    [deliveryFee]
  );

  const peakFeeNumber = useMemo(() => {
    if (orderType !== "delivery") return 0;
    const peak = deliveryConfig?.peakFee;
    if (!isWithinPeakWindow(peak)) return 0;
    const amount =
      typeof peak?.amount === "number" ? peak.amount : Number(peak?.amount || 0);
    return Number.isNaN(amount) ? 0 : amount;
  }, [orderType, deliveryConfig?.peakFee]);

  const deliveryFeeNumber = useMemo(
    () => baseDeliveryFeeNumber + peakFeeNumber,
    [baseDeliveryFeeNumber, peakFeeNumber]
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

  const minOrderValueNumber =
    typeof deliveryConfig?.minOrderValue === "number"
      ? deliveryConfig.minOrderValue
      : Number(deliveryConfig?.minOrderValue || 0);

  const maxDistanceKmNumber =
    typeof deliveryConfig?.maxDistanceKm === "number"
      ? deliveryConfig.maxDistanceKm
      : Number(deliveryConfig?.maxDistanceKm || 0);

  const etaMinutesFromCustomer =
    selectedCustomer &&
    typeof selectedCustomer.deliveryMinMinutes === "number"
      ? selectedCustomer.deliveryMinMinutes
      : null;

  const etaMinutesRaw =
    typeof etaMinutesFromCustomer === "number" && etaMinutesFromCustomer > 0
      ? etaMinutesFromCustomer
      : typeof deliveryConfig?.etaMinutesDefault === "number"
      ? deliveryConfig.etaMinutesDefault
      : Number(deliveryConfig?.etaMinutesDefault || 0);

  const etaMinutesValue = Number.isFinite(etaMinutesRaw)
    ? etaMinutesRaw
    : 0;

  const deliveryDistanceNumber = parseKmValue(deliveryDistanceKm);

  const maxDistanceExceeded =
    orderType === "delivery" &&
    maxDistanceKmNumber > 0 &&
    deliveryDistanceNumber > 0 &&
    deliveryDistanceNumber > maxDistanceKmNumber;

  const minOrderNotMet =
    orderType === "delivery" &&
    minOrderValueNumber > 0 &&
    subtotal > 0 &&
    subtotal < minOrderValueNumber;

  const businessHoursMessage =
    businessHoursStatus.reason || "Fora do horário de funcionamento.";

  // -----------------------------
  // Build draft + submit
  // -----------------------------
  const buildDraft = () => {
    if (!orderItems.length) {
      return { error: "Adicione pelo menos uma pizza ou bebida ao pedido." };
    }

    if (!isEditing && !businessHoursStatus.isOpen) {
      return {
        error: `Horário fechado. ${businessHoursMessage}`,
      };
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
      if (activeCustomerAddress) {
        const addr = activeCustomerAddress;
        const neighborhoodValue =
          (
            deliveryAddressNeighborhood ||
            addr.neighborhood ||
            addr.bairro ||
            ""
          ).trim();
        customerAddress = {
          cep: addr.cep || "",
          street: addr.street || "",
          number: addr.number || "",
          complement: addr.complement || "",
          neighborhood: neighborhoodValue,
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

    if (orderType === "delivery") {
      if (customerMode !== "registered" || !customerAddress) {
        return {
          error: "Selecione um cliente cadastrado para entrega.",
        };
      }

      const missing = getMissingAddressFields(
        customerAddress,
        customerAddress.neighborhood
      );
      if (missing.length > 0) {
        return {
          error: `Endereço incompleto no cadastro do cliente: ${missing.join(
            ", "
          )}.`,
        };
      }

      const blockedMatch = findBlockedNeighborhood(
        customerAddress.neighborhood,
        deliveryConfig?.blockedNeighborhoods
      );
      if (blockedMatch) {
        return {
          error: `Não entregamos no bairro "${blockedMatch}".`,
        };
      }
    }

    if (minOrderNotMet) {
      return {
        error: `Pedido mínimo para entrega: ${formatCurrency(
          minOrderValueNumber
        )}.`,
      };
    }

    if (maxDistanceExceeded) {
      return {
          error: `Distância acima do máximo permitido (${maxDistanceKmNumber} km).`,
      };
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
      customerAddressId:
        customerMode === "registered" ? selectedCustomerAddressId : null,
      customerAddressLabel:
        customerMode === "registered" ? activeCustomerAddressLabel : null,
      counterLabel: customerMode === "counter" ? counterLabel.trim() : null,
      items: orderItems,
      subtotal,
      deliveryFee: deliveryFeeNumber,
      deliveryFeeBase: baseDeliveryFeeNumber,
      deliveryPeakFee: peakFeeNumber,
      deliveryNeighborhood:
        orderType === "delivery" ? deliveryNeighborhood || null : null,
      deliveryDistanceKm:
        orderType === "delivery" ? parseKmValue(deliveryDistanceKm) : 0,
      deliveryMinMinutes:
        orderType === "delivery" && etaMinutesValue > 0
          ? etaMinutesValue
          : null,
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
      if (!isEditing) {
        clearOrderDraftStorage();
      }
      onConfirm(draft, options);
    }
  };

  if (!isOpen) return null;

  const editingOrderReference = isEditing
    ? initialOrder.shortId ||
      initialOrder.id ||
      initialOrder._id ||
      null
    : null;
  const modalTitleText = isEditing ? "Editar pedido" : "Novo pedido";
  const modalSubtitleText = isEditing
    ? editingOrderReference
      ? `Atualize o pedido ${editingOrderReference}.`
      : "Atualize o pedido existente."
    : "Selecione o cliente, monte os itens e já veja totais e entrega em tempo real.";

  const hasCustomers = customers.length > 0;
  const hasPizzas = pizzaCatalog.length > 0;
  const hasDrinks = drinkCatalog.length > 0;
  const hasExtras = extraCatalog.length > 0;

  const extrasDisabled = !hasPizzas || !flavor1;

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <>
      <div className="modal-backdrop">
      <div className="modal-window orderform-modal">
        {/* HEADER */}
          <div className="modal-header">
            <div>
              <div className="modal-eyebrow">
                {isEditing ? "Pedido em edição" : "Pedido em andamento"}
              </div>
              <div className="modal-title">{modalTitleText}</div>
              <div className="modal-subtitle">{modalSubtitleText}</div>
              {isLoading && (
                <div className="modal-helper-text">
                  Carregando clientes e produtos...
                </div>
              )}
              {!businessHoursStatus.isOpen && (
                <div className="field-error-text orderform-banner">
                  Loja fechada: {businessHoursMessage}
                </div>
              )}
              {orderType === "delivery" && minOrderNotMet && (
                <div className="field-error-text orderform-banner">
                  Pedido mínimo para entrega:{" "}
                  {formatCurrency(minOrderValueNumber)}.
                </div>
              )}
              {orderType === "delivery" && blockedNeighborhoodMatch && (
                <div className="field-error-text orderform-banner">
                  Bairro bloqueado para entrega: {blockedNeighborhoodMatch}.
                </div>
              )}
            {loadError && <div className="modal-error-text">{loadError}</div>}
          </div>
          <button className="modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="orderform-summary-row">
          <div className="summary-card">
            <div className="summary-label">Total do pedido</div>
            <div className="summary-value highlight">
              {formatCurrency(total)}
            </div>
            <div className="summary-meta">
              Subtotal {formatCurrency(subtotal)} · Desconto{" "}
              {formatCurrency(discountAmount)}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Itens</div>
            <div className="summary-value">{totalItems}</div>
            <div className="summary-meta">
              {orderItems.length} linha(s) · {selectedExtras.length} adicionais
            </div>
          </div>
          <div className="summary-card compact">
            <div className="summary-label">Entrega</div>
            <div className="summary-value">
              {orderType === "delivery"
                ? formatCurrency(deliveryFeeNumber)
                : "Sem taxa"}
            </div>
            <div className="summary-meta">
              {orderType === "delivery"
                ? deliveryNeighborhood || "Faixa não definida"
                : "Balcão / retirada"}
            </div>
          </div>
          <div className="summary-card compact">
            <div className="summary-label">Pagamento</div>
            <div className="summary-value">
              {paymentMethod ? paymentMethod.replace("_", " ") : "A definir"}
            </div>
            <div className="summary-meta">Status: Em aberto</div>
          </div>
        </div>

        <form
          className="modal-body"
          onSubmit={(e) => handleSubmit(e, { action: "save" })}
        >
          <div className="orderform-grid">
            {/* ===================== COLUNA ESQUERDA ===================== */}
            <div className="orderform-column">
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
                            <span>Tel: {selectedCustomer.phone}</span>
                          )}
                          {selectedCustomer.cpf && (
                            <span>CPF: {selectedCustomer.cpf}</span>
                          )}
                        </div>
                      </div>
                      <div className="customer-summary-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setShowCustomerSearch(true);
                          }}
                        >
                          Trocar cliente
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setShowCustomerEditModal(true)}
                        >
                          Editar cliente
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setShowAltAddressModal(true);
                            setAltAddressError("");
                          }}
                        >
                          Endereços
                        </button>
                      </div>
                    </div>

                    {activeCustomerAddress && (
                      <div className="customer-summary-body">
                        {customerAddressLines.line1 ||
                        customerAddressLines.line2 ? (
                          <>
                            {customerAddressLines.line1 && (
                              <div className="customer-summary-line">
                                <span className="customer-summary-label">
                                  Endereço
                                </span>
                                <span className="customer-summary-value">
                                  {customerAddressLines.line1}
                                </span>
                              </div>
                            )}
                            {customerAddressLines.line2 && (
                              <div className="customer-summary-line">
                                <span className="customer-summary-label">
                                  Bairro/Cidade
                                </span>
                                <span className="customer-summary-value">
                                  {customerAddressLines.line2}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="customer-summary-empty">
                            Endereço não informado.
                          </div>
                        )}
                        {(activeCustomerAddress.cep ||
                          activeCustomerAddressLabel ||
                          isSyncingCustomerAddress) && (
                          <div className="customer-summary-tags">
                            {activeCustomerAddress.cep && (
                              <span className="customer-summary-tag">
                                CEP {activeCustomerAddress.cep}
                              </span>
                            )}
                            {activeCustomerAddressLabel && (
                              <span className="customer-summary-tag customer-summary-tag--accent">
                                {activeCustomerAddressLabel}
                              </span>
                            )}
                            {isSyncingCustomerAddress && (
                              <span className="customer-summary-tag">
                                Atualizando CEP...
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {orderType === "delivery" &&
                      missingAddressFields.length > 0 && (
                        <div className="field-error-text">
                          Endereço incompleto:{" "}
                          {missingAddressFields.join(", ")}.
                        </div>
                      )}
                    {orderType === "delivery" && blockedNeighborhoodMatch && (
                      <div className="field-error-text">
                        Bairro bloqueado para entrega:{" "}
                        {blockedNeighborhoodMatch}.
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

                      {recentCustomers.length > 0 && (
                        <div className="customer-recent-block">
                          <div className="field-label">Últimos clientes</div>
                          <div className="customer-recent-list">
                            {recentCustomers.map((c) => (
                              <button
                                key={`recent-${c.id}`}
                                type="button"
                                className="customer-recent-item"
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setShowCustomerSearch(false);
                                }}
                              >
                                <span className="customer-recent-name">
                                  {c.name || "(Sem nome)"}
                                </span>
                                {c.phone && (
                                  <span className="customer-recent-meta">
                                    {c.phone}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="orderform-customer-list">
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
                                {c.phone && <span>Tel: {c.phone}</span>}
                                {c.cpf && <span>CPF: {c.cpf}</span>}
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
                      onChange={(e) => handleOrderTypeChange(e.target.value)}
                    >
                      <option
                        value="delivery"
                        disabled={
                          !!deliveryTypeBlockedReason &&
                          orderType !== "delivery"
                        }
                      >
                        Entrega
                      </option>
                      <option value="counter">Balcão / retirada</option>
                    </select>
                    {deliveryTypeBlockedReason && (
                      <div className="field-helper">
                        Entrega indisponivel: {deliveryTypeBlockedReason}
                      </div>
                    )}
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

                    <div className="distance-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() =>
                            handleAutoDistanceFromCustomer(
                              selectedCustomer && activeCustomerAddress
                                ? {
                                    ...selectedCustomer,
                                    address: activeCustomerAddress,
                                  }
                                : selectedCustomer,
                              deliveryNeighborhoodValue
                            )
                          }
                          disabled={
                            orderType !== "delivery" ||
                            !selectedCustomer ||
                            !activeCustomerAddress ||
                            missingAddressFields.length > 0 ||
                            isCalculatingDistance
                          }
                        >
                        Recalcular distância
                      </button>
                    </div>

                  {distanceError && (
                    <div className="field-error-text">{distanceError}</div>
                  )}
                  {maxDistanceExceeded && (
                    <div className="field-error-text">
                      Distância acima do máximo configurado (
                      {maxDistanceKmNumber} km).
                    </div>
                  )}
                </div>

                <div className="config-card">
                  <div className="field-label">Bairro da entrega</div>
                  <input
                    className={
                      "field-input" +
                      (orderType === "delivery" &&
                      (missingAddressFields.includes("Bairro") ||
                        blockedNeighborhoodMatch)
                        ? " input-error"
                        : "")
                    }
                    value={deliveryAddressNeighborhood}
                    onChange={(e) =>
                      setDeliveryAddressNeighborhood(e.target.value)
                    }
                    placeholder="Ex: Santana"
                    disabled={orderType !== "delivery"}
                  />
                  <div className="field-helper">
                    Preenchido a partir do cliente e pode ser ajustado
                    apenas para este pedido.
                  </div>
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
                        {peakFeeNumber > 0 && (
                          <div className="config-delivery-summary-line">
                            Taxa pico:{" "}
                            <strong>{formatCurrency(peakFeeNumber)}</strong>
                          </div>
                        )}
                        {etaMinutesValue > 0 && (
                          <div className="config-delivery-summary-line">
                            Tempo estimado:{" "}
                            <strong>{etaMinutesValue} min</strong>
                          </div>
                        )}
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
            <div className="orderform-column">
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

                <div className="orderform-addline-footer">
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

                    <div className="orderform-addline-footer">
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
                <div className="modal-section-header-row">
                  <div className="modal-section-title">Itens do pedido</div>
                  {orderItems.length > 0 && (
                    <div className="order-items-head">
                      <span className="chip">
                        {orderItems.length} linha(s)
                      </span>
                      <span className="chip chip-outline">
                        Subtotal: {formatCurrency(subtotal)}
                      </span>
                    </div>
                  )}
                </div>

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
                          <div className="order-item-header">
                            <div className="order-item-title">
                              {item.kind === "pizza" ? (
                                <>
                                  {item.quantity}x {item.flavor1Name}
                                  {item.twoFlavors && item.flavor2Name
                                    ? ` / ${item.flavor2Name}`
                                    : ""}
                                  {item.threeFlavors && item.flavor3Name
                                    ? ` / ${item.flavor3Name}`
                                    : ""}
                                </>
                              ) : (
                                <>
                                  {item.quantity}x {item.productName}
                                </>
                              )}
                            </div>
                            <div className="order-item-tags">
                              <span className="chip">
                                {item.kind === "pizza"
                                  ? item.sizeLabel
                                  : "Bebida"}
                              </span>
                              <span className="chip chip-outline">
                                Unitário {formatCurrency(item.unitPrice)}
                              </span>
                            </div>
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
                            <span className="order-item-meta-line">
                              Total da linha:{" "}
                              <strong>{formatCurrency(item.total)}</strong>
                            </span>
                            {item.kind === "pizza" &&
                              (item.twoFlavors || item.threeFlavors) && (
                                <span className="order-item-meta-line">
                                  Sabores múltiplos
                                </span>
                              )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="order-item-remove"
                          onClick={() => handleRemoveItem(item.lineId)}
                          aria-label="Remover item"
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
                      className="field-input orderform-textarea"
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
                      className="field-input orderform-textarea"
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
              onClick={handleClose}
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

      {showCustomerEditModal && selectedCustomer && (
        <CustomerFormModal
          customer={selectedCustomer}
          onClose={() => setShowCustomerEditModal(false)}
          onSaved={async () => {
            await refreshCustomers();
            setShowCustomerEditModal(false);
          }}
        />
      )}

      <Modal
        isOpen={showAltAddressModal}
        onClose={() => setShowAltAddressModal(false)}
        title="Endereços alternativos"
        className="orderform-altaddress-modal"
        bodyClassName="orderform-altaddress-body"
        footer={
          <div className="modal-footer-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowAltAddressModal(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveAltAddress}
              disabled={!selectedCustomer}
            >
              Salvar endereço
            </button>
          </div>
        }
      >
        <div className="alt-address-section">
          <div className="alt-address-header">
            <h4>Escolha um endereço</h4>
            <p>Use o principal ou selecione um alternativo.</p>
          </div>
          <div className="alt-address-list">
            <button
              type="button"
              className={
                "alt-address-item" +
                (selectedCustomerAddressId === "primary"
                  ? " alt-address-item--active"
                  : "")
              }
              onClick={() => handleUseAddress("primary")}
            >
              <div className="alt-address-item-title">Principal</div>
              <div className="alt-address-item-meta">
                {(selectedCustomer?.address?.street || "").trim()}
                {selectedCustomer?.address?.number
                  ? `, ${selectedCustomer.address.number}`
                  : ""}
              </div>
              <div className="alt-address-item-meta">
                {[
                  selectedCustomer?.address?.neighborhood,
                  selectedCustomer?.address?.city,
                  selectedCustomer?.address?.state,
                ]
                  .filter(Boolean)
                  .join(" - ")}
              </div>
            </button>

            {customerAltAddresses.length === 0 ? (
              <div className="empty small">
                Nenhum endereço alternativo cadastrado.
              </div>
            ) : (
              customerAltAddresses.map((addr) => {
                const line1 = `${addr.street || ""}${
                  addr.number ? `, ${addr.number}` : ""
                }`.trim();
                const line2 = [
                  addr.neighborhood,
                  addr.city,
                  addr.state,
                ]
                  .filter(Boolean)
                  .join(" - ");
                return (
                  <button
                    key={addr.id}
                    type="button"
                    className={
                      "alt-address-item" +
                      (String(selectedCustomerAddressId) ===
                      String(addr.id)
                        ? " alt-address-item--active"
                        : "")
                    }
                    onClick={() => handleUseAddress(addr.id)}
                  >
                    <div className="alt-address-item-title">
                      {addr.label || "Alternativo"}
                    </div>
                    {line1 && (
                      <div className="alt-address-item-meta">{line1}</div>
                    )}
                    {line2 && (
                      <div className="alt-address-item-meta">{line2}</div>
                    )}
                    {addr.cep && (
                      <div className="alt-address-item-meta">
                        CEP {addr.cep}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="alt-address-section">
          <div className="alt-address-header">
            <h4>Novo endereço alternativo</h4>
            <p>Cadastre um endereço para reutilizar nos próximos pedidos.</p>
          </div>

          <div className="alt-address-grid">
            <label className="field">
              <span className="field-label">Apelido</span>
              <input
                className="field-input"
                value={altAddressDraft.label}
                onChange={(e) =>
                  handleAltAddressFieldChange("label", e.target.value)
                }
                placeholder="Ex: Casa, Trabalho, Mãe"
              />
            </label>
          </div>

          <div className="alt-address-grid alt-address-grid-cep">
            <label className="field">
              <span className="field-label">CEP</span>
              <input
                className="field-input"
                value={altAddressDraft.cep}
                onChange={(e) =>
                  handleAltAddressFieldChange("cep", e.target.value)
                }
                placeholder="Somente números"
              />
            </label>
            <div className="alt-address-cep-action">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={handleAltAddressCepLookup}
              >
                Buscar CEP
              </button>
            </div>
          </div>

          {altAddressError && (
            <div className="field-error-text">{altAddressError}</div>
          )}

          <div className="alt-address-grid alt-address-grid-2">
            <label className="field">
              <span className="field-label">Rua</span>
              <input
                className="field-input"
                value={altAddressDraft.street}
                onChange={(e) =>
                  handleAltAddressFieldChange("street", e.target.value)
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Número</span>
              <input
                className="field-input"
                value={altAddressDraft.number}
                onChange={(e) =>
                  handleAltAddressFieldChange("number", e.target.value)
                }
              />
            </label>
          </div>

          <div className="alt-address-grid alt-address-grid-3">
            <label className="field">
              <span className="field-label">Bairro</span>
              <input
                className="field-input"
                value={altAddressDraft.neighborhood}
                onChange={(e) =>
                  handleAltAddressFieldChange("neighborhood", e.target.value)
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Cidade</span>
              <input
                className="field-input"
                value={altAddressDraft.city}
                onChange={(e) =>
                  handleAltAddressFieldChange("city", e.target.value)
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Estado</span>
              <input
                className="field-input"
                value={altAddressDraft.state}
                onChange={(e) =>
                  handleAltAddressFieldChange("state", e.target.value)
                }
              />
            </label>
          </div>

          <div className="alt-address-grid alt-address-grid-2">
            <label className="field">
              <span className="field-label">Complemento</span>
              <input
                className="field-input"
                value={altAddressDraft.complement}
                onChange={(e) =>
                  handleAltAddressFieldChange("complement", e.target.value)
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Referência</span>
              <input
                className="field-input"
                value={altAddressDraft.reference}
                onChange={(e) =>
                  handleAltAddressFieldChange("reference", e.target.value)
                }
                placeholder="Ex: portão azul, ap 32"
              />
            </label>
          </div>
        </div>
      </Modal>
    </>
  );
}
