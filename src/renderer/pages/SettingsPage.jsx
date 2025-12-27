// src/renderer/pages/SettingsPage.jsx
import React, { useEffect, useState } from "react";
import Page from "../components/layout/Page";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";

const ZONA_NORTE_BAIRROS = [
  "Santana",
  "Tucuruvi",
  "Mandaqui",
  "Jardim São Paulo",
  "Santa Teresinha",
  "Vila Guilherme",
  "Vila Maria",
  "Vila Medeiros",
  "Jaçanã",
  "Tremembé",
  "Parque Edu Chaves",
  "Vila Gustavo",
  "Vila Mazzei",
  "Jardim França",
  "Carandiru",
  "Casa Verde",
  "Imirim",
  "Cachoeirinha",
  "Brasilândia",
  "Freguesia do Ó",
  "Limão",
  "Pirituba",
  "Jaraguá",
  "Perus",
  "Vila Nova Cachoeirinha",
  "Parque Peruche",
  "Chora Menino",
];

const normalizeNeighborhoodKey = (value) => {
  if (!value) return "";
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terca" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sabado" },
];

const buildWeeklySchedule = ({
  openTime = "11:00",
  closeTime = "23:00",
  closedWeekdays = [],
} = {}) =>
  WEEKDAYS.map((day) => ({
    day: day.value,
    enabled: !closedWeekdays.includes(day.value),
    openTime,
    closeTime,
  }));

const buildDefaultDeliveryConfig = () => ({
  mode: "km_table", // cálculo padrão por distância em km
  baseLocationLabel: "Chora Menino (bairro base)",
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
    // TABELA PADRÃO – MESMA DA IMAGEM
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
});

const buildDefaultSettings = () => ({
  id: "default",
  pizzaria: "AXION PDV",
  versao: "0.1.0",
  tema: "light",
  businessHours: {
    enabled: false,
    openTime: "11:00",
    closeTime: "23:00",
    closedWeekdays: [],
    weeklySchedule: buildWeeklySchedule(),
  },
  api: {
    base_url: "",
    api_key: "",
  },
  printing: {
    kitchenPrinterName: "",
    counterPrinterName: "",
    silentMode: true,
    autoPrintWebsiteOrders: false,
  },
  delivery: buildDefaultDeliveryConfig(),
});

const API_ENDPOINT_GROUPS = [
  {
    title: "Basico",
    description: "Saude e status do servidor.",
    endpoints: [
      { method: "GET", path: "/health", auth: "public", desc: "Status da API." },
    ],
  },
  {
    title: "Cardapio",
    description: "Produtos oficiais do PDV.",
    endpoints: [
      {
        method: "GET",
        path: "/api/menu",
        auth: "api-key",
        desc: "Lista oficial do cardapio.",
      },
    ],
  },
  {
    title: "Clientes",
    description: "Cadastro e busca por telefone.",
    endpoints: [
      {
        method: "GET",
        path: "/api/customers/by-phone?phone=11999999999",
        auth: "api-key",
        desc: "Busca cliente por telefone.",
      },
      {
        method: "POST",
        path: "/api/customers",
        auth: "api-key",
        desc: "Cadastrar novo cliente.",
        sampleBody:
          "{\"name\":\"Cliente Teste\",\"phone\":\"11999999999\",\"address\":{\"cep\":\"00000000\",\"street\":\"Rua Teste\",\"number\":\"100\",\"neighborhood\":\"Centro\",\"city\":\"Sao Paulo\",\"state\":\"SP\"}}",
      },
    ],
  },
  {
    title: "Pedidos",
    description: "Criacao, listagem e atualizacao de pedidos.",
    endpoints: [
      {
        method: "GET",
        path: "/api/orders",
        auth: "api-key",
        desc: "Lista pedidos.",
      },
      {
        method: "POST",
        path: "/api/orders",
        auth: "api-key",
        desc: "Cria um novo pedido.",
        sampleBody:
          "{\"orderType\":\"delivery\",\"items\":[{\"quantity\":1,\"unitPrice\":50,\"total\":50}],\"customerAddress\":{\"neighborhood\":\"Santana\"}}",
      },
      {
        method: "PUT",
        path: "/api/orders/:id",
        auth: "api-key",
        desc: "Atualiza um pedido.",
        sampleBody: "{\"status\":\"preparing\"}",
      },
      {
        method: "DELETE",
        path: "/api/orders/:id",
        auth: "api-key",
        desc: "Remove um pedido.",
      },
      {
        method: "POST",
        path: "/api/orders/reset",
        auth: "api-key",
        desc: "Reseta a colecao de pedidos.",
      },
    ],
  },
  {
    title: "Motoboy",
    description: "Status e tracking de entregas.",
    endpoints: [
      {
        method: "GET",
        path: "/motoboy/pedido/:orderId",
        auth: "public",
        desc: "Tracking publico do pedido.",
      },
      {
        method: "POST",
        path: "/motoboy/pedido/:orderId/link",
        auth: "api-key",
        desc: "Vincula motoboy via QR.",
        sampleBody: "{\"qrToken\":\"SEU_TOKEN_QR\"}",
      },
      {
        method: "GET",
        path: "/api/motoboys/:id/status",
        auth: "api-key",
        desc: "Consulta status do motoboy.",
      },
      {
        method: "PUT",
        path: "/api/motoboys/:id/status",
        auth: "api-key",
        desc: "Atualiza status do motoboy.",
        sampleBody: "{\"status\":\"available\"}",
      },
    ],
  },
  {
    title: "Sync PDV",
    description: "Sincronizacao entre PDV e API.",
    endpoints: [
      {
        method: "GET",
        path: "/sync/collections",
        auth: "sync-token",
        desc: "Baixa todas as colecoes.",
      },
      {
        method: "GET",
        path: "/sync/collection/:collection",
        auth: "sync-token",
        desc: "Baixa uma colecao (full/delta).",
      },
      {
        method: "POST",
        path: "/sync/collection/:collection",
        auth: "sync-token",
        desc: "Envia colecao (full/delta).",
        sampleBody: "{\"mode\":\"full\",\"data\":{\"items\":[]}}",
      },
    ],
  },
  {
    title: "Generico",
    description: "Rotas genericas para qualquer colecao.",
    endpoints: [
      {
        method: "GET",
        path: "/api/:collection",
        auth: "api-key",
        desc: "Lista itens da colecao.",
      },
      {
        method: "POST",
        path: "/api/:collection",
        auth: "api-key",
        desc: "Cria item na colecao.",
      },
      {
        method: "PUT",
        path: "/api/:collection/:id",
        auth: "api-key",
        desc: "Atualiza item por id.",
      },
      {
        method: "DELETE",
        path: "/api/:collection/:id",
        auth: "api-key",
        desc: "Remove item por id.",
      },
      {
        method: "POST",
        path: "/api/:collection/reset",
        auth: "api-key",
        desc: "Reseta uma colecao.",
      },
    ],
  },
];

const API_METHODS = ["GET", "POST", "PUT", "DELETE"];

const normalizeSettingsData = (data) => {
  if (!data) return null;

  if (Array.isArray(data.items) && data.items.length > 0) {
    return data.items[0];
  }

  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  if (typeof data === "object") {
    return data;
  }

  return null;
};

/**
 * Monta um texto de teste "bonitinho" para impressora térmica,
 * com largura aproximada de 32 colunas (padrão de muitas Bematech / Epson).
 */
function buildThermalTestTicket({
  profile, // "kitchen" | "counter"
  pizzaria,
  configuredPrinterName,
}) {
  const now = new Date().toLocaleString("pt-BR");

  const profileLabel = profile === "kitchen" ? "COZINHA" : "BALCÃO / CONTA";

  const header = "ANNE & TOM PIZZARIA";
  const separator = "--------------------------------";
  const footer = "Obrigado por usar o sistema AXION PDV";

  const lines = [
    header,
    "TESTE DE IMPRESSAO",
    "CUPOM NAO FISCAL",
    "",
    `Perfil: ${profileLabel}`,
    `Impressora: ${configuredPrinterName || "Padrão do sistema"}`,
    `Data: ${now}`,
    "",
    separator,

    "ABCDEFGHIJ KLMNOPQRST",
    "abcdefghijklmnopqrst",
    "çÇ áéíóú àèìòù ñÑ",
    separator,
    "",
    "Se este ticket saiu na",
    "impressora correta, o",
    "mapeamento está OK.",
    "",
    footer,
    "",
    "",
  ];

  return lines.join("\n");
}

const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [printMessage, setPrintMessage] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState(null);
  const [publicApiConfig, setPublicApiConfig] = useState({
    apiBaseUrl: "",
    publicApiToken: "",
  });
  const [showIntegrationManual, setShowIntegrationManual] = useState(false);
  const [showApiConsole, setShowApiConsole] = useState(false);
  const [apiTokenVisible, setApiTokenVisible] = useState(false);
  const [appInfo, setAppInfo] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [apiTestState, setApiTestState] = useState({
    method: "GET",
    path: "/health",
    body: "",
    headerName: "",
    headerValue: "",
    useToken: true,
  });
  const [apiTestResult, setApiTestResult] = useState(null);
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [apiTestError, setApiTestError] = useState("");

  // Lista de impressoras do sistema
  const [printers, setPrinters] = useState([]);
  const [printersLoading, setPrintersLoading] = useState(false);
  const [printersError, setPrintersError] = useState("");
  const [blockedNeighborhoodInput, setBlockedNeighborhoodInput] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await window.dataEngine.get("settings");
        console.log("[Settings] raw data from dataEngine:", data);

        let item = normalizeSettingsData(data);
        if (!item) {
          item = buildDefaultSettings();
        }

        if (!item.api) {
          item.api = { base_url: "", api_key: "" };
        }
        let apiBaseUrlValue = item.api.base_url || "";
        let apiTokenValue = item.api.api_key || "";
        if (window.electronAPI?.getPublicApiConfig) {
          try {
            const envConfig = await window.electronAPI.getPublicApiConfig();
            apiBaseUrlValue =
              typeof envConfig?.apiBaseUrl === "string"
                ? envConfig.apiBaseUrl
                : "";
            apiTokenValue =
              typeof envConfig?.publicApiToken === "string"
                ? envConfig.publicApiToken
                : "";
          } catch (envErr) {
            console.error("[Settings] Erro ao ler .env:", envErr);
          }
        }
        item.api = {
          base_url: apiBaseUrlValue,
          api_key: apiTokenValue,
        };
        setPublicApiConfig({
          apiBaseUrl: apiBaseUrlValue,
          publicApiToken: apiTokenValue,
        });
        if (!item.tema) {
          item.tema = "light";
        }
        if (!item.versao) {
          item.versao = "0.1.0";
        }
        if (!item.pizzaria) {
          item.pizzaria = "AXION PDV";
        }
        if (!item.id) {
          item.id = "default";
        }
        if (!item.printing) {
          item.printing = {
            kitchenPrinterName: "",
            counterPrinterName: "",
            silentMode: true,
            autoPrintWebsiteOrders: false,
          };
        } else {
          item.printing = {
            kitchenPrinterName: item.printing.kitchenPrinterName || "",
            counterPrinterName: item.printing.counterPrinterName || "",
            silentMode:
              item.printing.silentMode !== undefined
                ? !!item.printing.silentMode
                : true,
            autoPrintWebsiteOrders: !!item.printing.autoPrintWebsiteOrders,
          };
        }

        if (!item.businessHours) {
          item.businessHours = buildDefaultSettings().businessHours;
        } else {
          const openTime = item.businessHours.openTime || "11:00";
          const closeTime = item.businessHours.closeTime || "23:00";
          const closedWeekdays = Array.isArray(
            item.businessHours.closedWeekdays
          )
            ? item.businessHours.closedWeekdays
            : [];
          const baseSchedule = buildWeeklySchedule({
            openTime,
            closeTime,
            closedWeekdays,
          });
          const rawSchedule = Array.isArray(
            item.businessHours.weeklySchedule
          )
            ? item.businessHours.weeklySchedule
            : null;
          const weeklySchedule = rawSchedule
            ? baseSchedule.map((entry) => {
                const match = rawSchedule.find(
                  (day) => Number(day.day) === entry.day
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
          const normalizedClosedWeekdays = weeklySchedule
            .filter((entry) => entry.enabled === false)
            .map((entry) => entry.day);

          item.businessHours = {
            enabled: !!item.businessHours.enabled,
            openTime,
            closeTime,
            closedWeekdays: normalizedClosedWeekdays,
            weeklySchedule,
          };
        }

        // Normaliza configuração de entrega
        if (!item.delivery || !Array.isArray(item.delivery.ranges)) {
          item.delivery = buildDefaultDeliveryConfig();
        } else {
          const blocked = Array.isArray(item.delivery.blockedNeighborhoods)
            ? item.delivery.blockedNeighborhoods
                .map((b) => (b || "").toString().trim())
                .filter(Boolean)
            : [];
          const peakFee = item.delivery.peakFee || {};
          item.delivery = {
            mode: item.delivery.mode || "km_table",
            baseLocationLabel:
              item.delivery.baseLocationLabel ||
              "Chora Menino (bairro base)",
            blockedNeighborhoods: blocked,
            minOrderValue:
              typeof item.delivery.minOrderValue === "number"
                ? item.delivery.minOrderValue
                : Number(item.delivery.minOrderValue || 0),
            maxDistanceKm:
              typeof item.delivery.maxDistanceKm === "number"
                ? item.delivery.maxDistanceKm
                : Number(item.delivery.maxDistanceKm || 0),
            etaMinutesDefault:
              typeof item.delivery.etaMinutesDefault === "number"
                ? item.delivery.etaMinutesDefault
                : Number(item.delivery.etaMinutesDefault || 45),
            peakFee: {
              enabled: !!peakFee.enabled,
              days: Array.isArray(peakFee.days) ? peakFee.days : [],
              startTime: peakFee.startTime || "18:00",
              endTime: peakFee.endTime || "22:00",
              amount:
                typeof peakFee.amount === "number"
                  ? peakFee.amount
                  : Number(peakFee.amount || 0),
            },
            ranges: item.delivery.ranges.map((r, idx) => ({
              id: r.id || `r_${idx}`,
              label: r.label || "",
              minKm:
                typeof r.minKm === "number"
                  ? r.minKm
                  : Number(r.minKm || 0),
              maxKm:
                typeof r.maxKm === "number"
                  ? r.maxKm
                  : Number(r.maxKm || 0),
              price:
                typeof r.price === "number"
                  ? r.price
                  : Number(r.price || 0),
            })),
          };
        }

        setSettings(item);
      } catch (err) {
        console.error("[Settings] Erro ao carregar:", err);
        setError("Não foi possível carregar as configurações.");
        setSettings(buildDefaultSettings());
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Carregar lista de impressoras do sistema
  const loadPrinters = async () => {
    if (!window.printerConfig || !window.printerConfig.listPrinters) {
      setPrintersError(
        "Listagem de impressoras não está disponível neste computador."
      );
      setPrinters([]);
      return;
    }

    try {
      setPrintersLoading(true);
      setPrintersError("");
      const list = await window.printerConfig.listPrinters();
      console.log("[Settings] Impressoras encontradas:", list);
      setPrinters(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("[Settings] Erro ao listar impressoras:", err);
      setPrintersError("Erro ao listar impressoras do sistema.");
      setPrinters([]);
    } finally {
      setPrintersLoading(false);
    }
  };

  // carrega impressoras na entrada da tela
  useEffect(() => {
    loadPrinters();
  }, []);

  useEffect(() => {
    let timer;

    const loadSyncStatus = async () => {
      if (!window.electronAPI || !window.electronAPI.getSyncStatus) return;
      try {
        const status = await window.electronAPI.getSyncStatus();
        setSyncStatus(status || null);
      } catch (err) {
        console.error("[Settings] Erro ao buscar sync status:", err);
      }
    };

    loadSyncStatus();
    timer = setInterval(loadSyncStatus, 5000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancel = false;

    const loadAppInfo = async () => {
      if (!window.appInfo || !window.appInfo.getInfo) return;
      try {
        const info = await window.appInfo.getInfo();
        if (!cancel) {
          setAppInfo(info || null);
        }
      } catch (err) {
        console.error("[Settings] Erro ao carregar info do app:", err);
      }
    };

    loadAppInfo();
    return () => {
      cancel = true;
    };
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApiChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      api: {
        ...(prev.api || {}),
        [field]: value,
      },
    }));
  };

  const handlePrintingChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      printing: {
        ...(prev.printing || {}),
        [field]: value,
      },
    }));
  };

  // ------- ENTREGA / DISTÂNCIA -------

  const handleDeliveryFieldChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      delivery: {
        ...(prev.delivery || buildDefaultDeliveryConfig()),
        [field]: value,
      },
    }));
  };

  const handleDeliveryPeakFeeChange = (field, value) => {
    setSettings((prev) => {
      const current = prev.delivery || buildDefaultDeliveryConfig();
      const peakFee = current.peakFee || {};
      return {
        ...prev,
        delivery: {
          ...current,
          peakFee: {
            ...peakFee,
            [field]: value,
          },
        },
      };
    });
  };

  const handleDeliveryPeakFeeDayToggle = (dayValue) => {
    setSettings((prev) => {
      const current = prev.delivery || buildDefaultDeliveryConfig();
      const peakFee = current.peakFee || {};
      const days = Array.isArray(peakFee.days) ? peakFee.days : [];
      const exists = days.includes(dayValue);
      return {
        ...prev,
        delivery: {
          ...current,
          peakFee: {
            ...peakFee,
            days: exists
              ? days.filter((d) => d !== dayValue)
              : [...days, dayValue],
          },
        },
      };
    });
  };

  const handleBusinessHoursChange = (field, value) => {
    setSettings((prev) => {
      const current =
        prev.businessHours || buildDefaultSettings().businessHours;
      const next = {
        ...current,
        [field]: value,
      };
      if (!Array.isArray(next.weeklySchedule)) {
        next.weeklySchedule = buildWeeklySchedule({
          openTime: next.openTime || "11:00",
          closeTime: next.closeTime || "23:00",
          closedWeekdays: next.closedWeekdays || [],
        });
      }
      return {
        ...prev,
        businessHours: next,
      };
    });
  };

  const handleClosedWeekdayToggle = (dayValue) => {
    setSettings((prev) => {
      const current =
        prev.businessHours || buildDefaultSettings().businessHours;
      const days = Array.isArray(current.closedWeekdays)
        ? current.closedWeekdays
        : [];
      const exists = days.includes(dayValue);
      return {
        ...prev,
        businessHours: {
          ...current,
          closedWeekdays: exists
            ? days.filter((d) => d !== dayValue)
            : [...days, dayValue],
        },
      };
    });
  };

  const handleWeeklyScheduleChange = (dayValue, field, value) => {
    setSettings((prev) => {
      const current =
        prev.businessHours || buildDefaultSettings().businessHours;
      const schedule = Array.isArray(current.weeklySchedule)
        ? [...current.weeklySchedule]
        : buildWeeklySchedule({
            openTime: current.openTime || "11:00",
            closeTime: current.closeTime || "23:00",
            closedWeekdays: current.closedWeekdays || [],
          });

      const index = schedule.findIndex(
        (entry) => Number(entry.day) === dayValue
      );
      const baseEntry =
        index >= 0
          ? schedule[index]
          : {
              day: dayValue,
              enabled: true,
              openTime: current.openTime || "11:00",
              closeTime: current.closeTime || "23:00",
            };

      const updated = { ...baseEntry, [field]: value };
      if (index >= 0) {
        schedule[index] = updated;
      } else {
        schedule.push(updated);
      }

      const closedWeekdays = schedule
        .filter((entry) => entry.enabled === false)
        .map((entry) => entry.day);

      return {
        ...prev,
        businessHours: {
          ...current,
          weeklySchedule: schedule,
          closedWeekdays,
        },
      };
    });
  };

  const handleApplyBusinessHoursToAll = () => {
    setSettings((prev) => {
      const current =
        prev.businessHours || buildDefaultSettings().businessHours;
      const openTime = current.openTime || "11:00";
      const closeTime = current.closeTime || "23:00";
      const schedule = Array.isArray(current.weeklySchedule)
        ? current.weeklySchedule.map((entry) => ({
            ...entry,
            openTime,
            closeTime,
          }))
        : buildWeeklySchedule({
            openTime,
            closeTime,
            closedWeekdays: current.closedWeekdays || [],
          });
      const closedWeekdays = schedule
        .filter((entry) => entry.enabled === false)
        .map((entry) => entry.day);

      return {
        ...prev,
        businessHours: {
          ...current,
          weeklySchedule: schedule,
          closedWeekdays,
        },
      };
    });
  };

  const handleDeliveryRangeChange = (index, field, value) => {
    setSettings((prev) => {
      const current = prev.delivery || buildDefaultDeliveryConfig();
      const ranges = [...(current.ranges || [])];

      const parseNumber = (val) => {
        if (val === "" || val === null || val === undefined) return "";
        const normalized = val.toString().replace(",", ".");
        const n = Number(normalized);
        return Number.isNaN(n) ? "" : n;
      };

      const updated = { ...(ranges[index] || {}) };

      if (field === "minKm" || field === "maxKm" || field === "price") {
        updated[field] = parseNumber(value);
      } else {
        updated[field] = value;
      }

      ranges[index] = updated;

      return {
        ...prev,
        delivery: {
          ...current,
          ranges,
        },
      };
    });
  };

  const handleAddDeliveryRange = () => {
    setSettings((prev) => {
      const current = prev.delivery || buildDefaultDeliveryConfig();
      const ranges = [...(current.ranges || [])];
      const newIndex = ranges.length + 1;

      ranges.push({
        id: `custom_${newIndex}`,
        label: `Nova faixa ${newIndex}`,
        minKm: 0,
        maxKm: 0,
        price: 0,
      });

      return {
        ...prev,
        delivery: {
          ...current,
          ranges,
        },
      };
    });
  };

  const handleRemoveDeliveryRange = (index) => {
    setSettings((prev) => {
      const current = prev.delivery || buildDefaultDeliveryConfig();
      const ranges = [...(current.ranges || [])];
      ranges.splice(index, 1);

      return {
        ...prev,
        delivery: {
          ...current,
          ranges,
        },
      };
    });
  };

  const handleAddBlockedNeighborhood = () => {
    const raw = blockedNeighborhoodInput || "";
    const cleaned = raw.trim();
    if (!cleaned) return;

    setSettings((prev) => {
      const current = prev.delivery || buildDefaultDeliveryConfig();
      const existing = Array.isArray(current.blockedNeighborhoods)
        ? current.blockedNeighborhoods
        : [];

      const key = normalizeNeighborhoodKey(cleaned);
      const alreadyExists = existing.some(
        (item) => normalizeNeighborhoodKey(item) === key
      );

      if (alreadyExists) {
        return prev;
      }

      return {
        ...prev,
        delivery: {
          ...current,
          blockedNeighborhoods: [...existing, cleaned],
        },
      };
    });

    setBlockedNeighborhoodInput("");
  };

  const handleRemoveBlockedNeighborhood = (index) => {
    setSettings((prev) => {
      const current = prev.delivery || buildDefaultDeliveryConfig();
      const existing = Array.isArray(current.blockedNeighborhoods)
        ? current.blockedNeighborhoods
        : [];
      const next = [...existing];
      next.splice(index, 1);
      return {
        ...prev,
        delivery: {
          ...current,
          blockedNeighborhoods: next,
        },
      };
    });
  };

  const handleCheckUpdates = async () => {
    if (!window.appInfo || !window.appInfo.checkForUpdates) return;
    try {
      setUpdateLoading(true);
      setUpdateStatus(null);
      const result = await window.appInfo.checkForUpdates();
      if (result?.success) {
        const latest = result.latestVersion || "";
        const current = appInfo?.version || settings?.versao || "";
        const hasUpdate = latest && latest !== current;
        setUpdateStatus({
          status: hasUpdate ? "available" : "ok",
          message: hasUpdate
            ? `Atualizacao disponivel: ${latest}`
            : "Sistema atualizado.",
          details: result.releaseNotes || "",
          downloadUrl: result.downloadUrl || "",
        });
      } else {
        setUpdateStatus({
          status: "error",
          message: result?.error || "Nao foi possivel verificar atualizacoes.",
        });
      }
    } catch (err) {
      console.error("[Settings] Erro ao verificar atualizacoes:", err);
      setUpdateStatus({
        status: "error",
        message: "Erro ao verificar atualizacoes.",
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const sanitizeApiPath = (value) => {
    if (!value) return "/";
    return value.startsWith("/") ? value : `/${value}`;
  };

  const handleRunApiTest = async (override = {}) => {
    const config = { ...apiTestState, ...override };
    const baseUrl = (apiBaseUrlValue || "").replace(/\/+$/, "");
    if (!baseUrl) {
      setApiTestError("Base URL nao configurada no .env.");
      return;
    }

    const pathValue = sanitizeApiPath(config.path || "/");
    const url = `${baseUrl}${pathValue}`;

    const headers = {};
    if (config.useToken && apiTokenValue) {
      headers["x-api-key"] = apiTokenValue;
    }
    if (config.headerName && config.headerValue) {
      headers[config.headerName] = config.headerValue;
    }

    let body = undefined;
    if (config.method !== "GET" && config.method !== "DELETE") {
      if (config.body && config.body.trim()) {
        try {
          body = JSON.stringify(JSON.parse(config.body));
        } catch (err) {
          setApiTestError("JSON invalido no corpo da requisicao.");
          return;
        }
      } else {
        body = JSON.stringify({});
      }
      headers["Content-Type"] = "application/json";
    }

    setApiTestLoading(true);
    setApiTestError("");
    setApiTestResult(null);

    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: config.method,
        headers,
        body,
      });
      const durationMs = Date.now() - startedAt;
      const contentType = response.headers.get("content-type") || "";
      const rawText = await response.text();
      let parsed = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch (err) {
          parsed = null;
        }
      }

      setApiTestResult({
        ok: response.ok,
        status: response.status,
        durationMs,
        contentType,
        rawText,
        json: parsed,
      });
    } catch (err) {
      console.error("[Settings] Erro no teste de API:", err);
      setApiTestError(err?.message || "Erro ao chamar API.");
    } finally {
      setApiTestLoading(false);
    }
  };

  const handleQuickApiTest = (
    method,
    path,
    body = "",
    auth = "api-key"
  ) => {
    setApiTestState((prev) => {
      const next = {
        ...prev,
        method,
        path,
        body,
      };

      if (auth === "public") {
        next.useToken = false;
        next.headerName = "";
        next.headerValue = "";
      } else if (auth === "sync-token") {
        next.useToken = false;
        next.headerName = "x-sync-token";
        next.headerValue = "";
      } else {
        next.useToken = true;
        if (next.headerName === "x-sync-token") {
          next.headerName = "";
          next.headerValue = "";
        }
      }

      return next;
    });
    setShowApiConsole(true);
  };

  const getSamplePath = (path) =>
    path
      .replace(":collection", "orders")
      .replace(":orderId", "orders-123")
      .replace(":id", "orders-123");

  const getAuthLabel = (auth) => {
    if (auth === "sync-token") return "sync token";
    if (auth === "api-key") return "api key";
    return "publico";
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...settings,
        api: {
          base_url: publicApiConfig.apiBaseUrl || "",
          api_key: publicApiConfig.publicApiToken || "",
        },
      };

      await window.dataEngine.set("settings", {
        items: [payload],
      });

      console.log("[Settings] Salvo com sucesso:", payload);
      setSettings(payload);
      setPrintMessage("Configurações salvas com sucesso.");
      setTimeout(() => setPrintMessage(""), 3000);
    } catch (err) {
      console.error("[Settings] Erro ao salvar:", err);
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Teste de impressora de cozinha / balcão.
   * Usa SEMPRE o nome configurado em settings.printing.*
   * (que está no DB). O main.js lê isso e faz o mapeamento.
   */
  const handleTestPrinter = async (target) => {
    if (!window.electronAPI || !window.electronAPI.printTickets) {
      alert("Função de impressão não está disponível no app.");
      return;
    }

    const kitchenName = settings.printing?.kitchenPrinterName || "";
    const counterName = settings.printing?.counterPrinterName || "";
    const silent = settings.printing?.silentMode ?? true;

    const isKitchen = target === "kitchen";

    const kitchenText = isKitchen
      ? buildThermalTestTicket({
          profile: "kitchen",
          pizzaria: settings.pizzaria || "AXION PDV",
          configuredPrinterName: kitchenName,
        })
      : "";

    const counterText = !isKitchen
      ? buildThermalTestTicket({
          profile: "counter",
          pizzaria: settings.pizzaria || "AXION PDV",
          configuredPrinterName: counterName,
        })
      : "";

    const payload = {
      mode: "test",
      target: isKitchen ? "kitchen" : "counter",
      silent,
      kitchenText,
      counterText,
      // não enviamos nome de impressora aqui; o main.js
      // sempre usa o que está salvo no DB (settings.printing.*)
    };

    console.log("[Settings] Teste de impressão (payload):", payload);

    try {
      setPrintMessage("");
      const ok = await window.electronAPI.printTickets(payload);

      if (ok) {
        setPrintMessage(
          isKitchen
            ? "Ticket de teste enviado para a impressora da cozinha."
            : "Ticket de teste enviado para a impressora do balcão."
        );
      } else {
        setPrintMessage(
          "Não foi possível imprimir o ticket de teste. Verifique a impressora."
        );
      }
    } catch (err) {
      console.error("Erro ao testar impressora:", err);
      setPrintMessage(
        "Erro ao enviar ticket de teste. Veja o console do app."
      );
    } finally {
      setTimeout(() => setPrintMessage(""), 5000);
    }
  };

  const handleManualSync = async () => {
    if (!window.electronAPI || !window.electronAPI.syncNow) {
      setSyncMessage("Sincronizacao nao disponivel neste app.");
      return;
    }

    try {
      setSyncLoading(true);
      setSyncMessage("");
      const result = await window.electronAPI.syncNow();
      if (result?.success) {
        setSyncMessage("Sincronizacao concluida com sucesso.");
      } else {
        setSyncMessage(
          result?.error
            ? `Falha ao sincronizar: ${result.error}`
            : "Falha ao sincronizar."
        );
      }
    } catch (err) {
      console.error("[Settings] Erro ao sincronizar:", err);
      setSyncMessage("Erro ao sincronizar. Veja o console do app.");
    } finally {
      setSyncLoading(false);
      setTimeout(() => setSyncMessage(""), 5000);
    }
  };
  const formatSyncTime = (value) => {
    if (!value) return "n/a";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "n/a";
    return date.toLocaleString("pt-BR");
  };
  // Enquanto está carregando pela primeira vez
  if (loading && !settings) {
    return (
      <Page
        title="Configurações"
        subtitle="Carregando configurações..."
      >
        <p>Carregando configurações...</p>
      </Page>
    );
  }

  // Se deu algum erro MUITO grave
  if (!settings) {
    return (
      <Page title="Configurações" subtitle="Erro ao carregar">
        <p>Algo deu errado ao carregar as configurações.</p>
      </Page>
    );
  }

  const kitchenPrinterName = settings.printing?.kitchenPrinterName || "";
  const counterPrinterName = settings.printing?.counterPrinterName || "";
  const delivery = settings.delivery || buildDefaultDeliveryConfig();
  const blockedNeighborhoods =
    Array.isArray(delivery.blockedNeighborhoods)
      ? delivery.blockedNeighborhoods
      : [];
  const apiBaseUrlValue =
    publicApiConfig.apiBaseUrl || settings.api?.base_url || "";
  const apiTokenValue =
    publicApiConfig.publicApiToken || settings.api?.api_key || "";
  const apiTokenDisplay = apiTokenVisible
    ? apiTokenValue
    : apiTokenValue
    ? `${apiTokenValue.slice(0, 4)}...${apiTokenValue.slice(-4)}`
    : "";
  const businessSchedule = Array.isArray(
    settings.businessHours?.weeklySchedule
  )
    ? settings.businessHours.weeklySchedule
    : buildWeeklySchedule({
        openTime: settings.businessHours?.openTime || "11:00",
        closeTime: settings.businessHours?.closeTime || "23:00",
        closedWeekdays: settings.businessHours?.closedWeekdays || [],
      });

  return (
    <Page
      title="Configurações"
      subtitle="Ajustes gerais da pizzaria, integrações, entrega e impressão."
      actions={
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      }
    >
      {error && (
        <p
          style={{
            color: "#c13f35",
            fontSize: 13,
            marginTop: 0,
            marginBottom: 8,
          }}
        >
          {error}
        </p>
      )}

      {printMessage && (
        <p
          style={{
            color: "#065f46",
            fontSize: 12,
            marginTop: 0,
            marginBottom: 10,
          }}
        >
          {printMessage}
        </p>
      )}

      <div className="settings-layout">
        {/* COLUNA ESQUERDA – Geral / Aparência / Integração / Entrega */}
        <div className="settings-column">
          {/* Pizzaria */}
          <div className="settings-section">
            <div className="settings-section-title">Dados gerais</div>

            <div className="form-grid settings-grid">
              <label className="field">
                <span className="field-label">Nome da pizzaria</span>
                <input
                  className="input"
                  value={settings.pizzaria || ""}
                  onChange={(e) =>
                    handleChange("pizzaria", e.target.value)
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">Versão do sistema</span>
                <input
                  className="input"
                  value={appInfo?.version || settings.versao || ""}
                  disabled
                />
              </label>

              <label className="field">
                <span className="field-label">Tema</span>
                <select
                  className="input"
                  value={settings.tema || "light"}
                  onChange={(e) =>
                    handleChange("tema", e.target.value)
                  }
                >
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                </select>
              </label>
            </div>

            <div className="system-version-card">
              <div className="system-version-header">
                <div>
                  <div className="system-version-title">Versao do sistema</div>
                  <div className="system-version-value">
                    {appInfo?.version || settings.versao || "0.0.0"}
                  </div>
                </div>
                <span className="system-version-env">
                  {appInfo?.env || "producao"}
                </span>
              </div>

              <div className="system-version-meta">
                <div className="system-version-meta-row">
                  <span className="system-version-meta-label">Aplicativo</span>
                  <span className="system-version-meta-value">
                    {appInfo?.name || "AXION PDV"}
                  </span>
                </div>
                <div className="system-version-meta-row">
                  <span className="system-version-meta-label">
                    Diretorio de dados
                  </span>
                  <span className="system-version-meta-value system-version-path">
                    {appInfo?.dataDir || "nao informado"}
                  </span>
                </div>
              </div>

              <div className="system-version-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCheckUpdates}
                  disabled={updateLoading}
                >
                  {updateLoading ? "Verificando..." : "Verificar atualizacoes"}
                </Button>
                {updateStatus && (
                  <div
                    className={
                      "system-version-status system-version-status-" +
                      updateStatus.status
                    }
                  >
                    <div>{updateStatus.message}</div>
                    {updateStatus.details && (
                      <div className="system-version-notes">
                        {updateStatus.details}
                      </div>
                    )}
                    {updateStatus.downloadUrl && (
                      <div className="system-version-link">
                        {updateStatus.downloadUrl}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Integrações / API */}
          <div className="settings-section">
            <div className="settings-section-title">
              Integrações / API
            </div>

            <div className="form-grid settings-grid">
              <label className="field">
                <span className="field-label">API Base URL</span>
                <input
                  className="input"
                  value={apiBaseUrlValue}
                  placeholder="https://sua-api.com"
                  readOnly
                  disabled
                />
                <span className="field-helper">
                  Valor carregado do .env (SYNC_BASE_URL).
                </span>
              </label>

              <label className="field">
                <span className="field-label">API Key</span>
                <input
                  className="input"
                  value={apiTokenDisplay}
                  placeholder="token publico"
                  readOnly
                  disabled
                />
                <span className="field-helper">
                  Valor carregado do .env (PUBLIC_API_TOKEN). Use o console para ver completo.
                </span>
              </label>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleManualSync}
                disabled={syncLoading}
              >
                {syncLoading ? "Sincronizando..." : "Sincronizar agora"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowIntegrationManual(true)}
              >
                Manual de integracao
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowApiConsole(true)}
              >
                Console da API
              </Button>
              {syncMessage && (
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {syncMessage}
                </span>
              )}
            </div>
            {syncStatus && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: syncStatus.online ? "#065f46" : "#b91c1c",
                }}
              >
                Status: {syncStatus.online ? "Online" : "Offline"} | Ultimo pull: {formatSyncTime(syncStatus.lastPullAt)} | Ultimo push: {formatSyncTime(syncStatus.lastPushAt)} | Fila: {syncStatus.queueRemaining ?? 0}
                {syncStatus.lastPullError
                  ? ` | Erro pull: ${syncStatus.lastPullError}`
                  : ""}
                {syncStatus.lastPushError
                  ? ` | Erro push: ${syncStatus.lastPushError}`
                  : ""}
              </div>
            )}
          </div>

          {/* ENTREGA / TABELA POR KM */}
          <div className="settings-section">
            <div className="settings-section-title">
              Taxas de entrega (distância em km)
            </div>

            <div className="form-grid settings-grid">
              <label className="field">
                <span className="field-label">
                  Bairro / ponto de referência
                </span>
                <input
                  className="input"
                  value={delivery.baseLocationLabel || ""}
                  onChange={(e) =>
                    handleDeliveryFieldChange(
                      "baseLocationLabel",
                      e.target.value
                    )
                  }
                  placeholder="Ex.: Chora Menino"
                />
                <span className="field-helper">
                  Ponto a partir do qual será considerada a distância em
                  km da entrega.
                </span>
              </label>

              <label className="field">
                <span className="field-label">Modo de cálculo</span>
                <select
                  className="input"
                  value={delivery.mode || "km_table"}
                  onChange={(e) =>
                    handleDeliveryFieldChange("mode", e.target.value)
                  }
                >
                  <option value="km_table">
                    Tabela por faixa de km (padrão)
                  </option>
                  <option value="manual_bairro">
                    Valor manual por bairro / zona
                  </option>
                </select>
                <span className="field-helper">
                  Outros módulos podem usar este modo para decidir qual
                  lógica aplicar ao calcular a taxa.
                </span>
              </label>
            </div>

            <div className="delivery-table">
              <div className="delivery-table-header">
                <div>Km mín.</div>
                <div>Km máx.</div>
                <div>Descrição</div>
                <div>Valor (R$)</div>
                <div />
              </div>

              {delivery.ranges.map((range, idx) => (
                <div
                  key={range.id || idx}
                  className="delivery-table-row"
                >
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={
                      range.minKm === "" || range.minKm === null
                        ? ""
                        : range.minKm
                    }
                    onChange={(e) =>
                      handleDeliveryRangeChange(
                        idx,
                        "minKm",
                        e.target.value
                      )
                    }
                  />
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={
                      range.maxKm === "" || range.maxKm === null
                        ? ""
                        : range.maxKm
                    }
                    onChange={(e) =>
                      handleDeliveryRangeChange(
                        idx,
                        "maxKm",
                        e.target.value
                      )
                    }
                  />
                  <input
                    className="input"
                    value={range.label || ""}
                    onChange={(e) =>
                      handleDeliveryRangeChange(
                        idx,
                        "label",
                        e.target.value
                      )
                    }
                  />
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={
                      range.price === "" || range.price === null
                        ? ""
                        : range.price
                    }
                    onChange={(e) =>
                      handleDeliveryRangeChange(
                        idx,
                        "price",
                        e.target.value
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveDeliveryRange(idx)}
                  >
                    Remover
                  </Button>
                </div>
              ))}

              <div style={{ marginTop: 8 }}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddDeliveryRange}
                >
                  Adicionar faixa
                </Button>
              </div>

              <p className="field-helper" style={{ marginTop: 8 }}>
                Esta tabela é o padrão para cálculo da taxa de entrega
                com base na distância em km. Os módulos de pedidos podem
                ler essas faixas para calcular o valor automaticamente.
              </p>
            </div>


            <div className="delivery-blocked-area">
              <div className="delivery-blocked-title-row">
                <div className="settings-section-title">
                  Bairros sem entrega
                </div>
                <span className="field-helper">
                  Bloqueie bairros onde nao ha atendimento.
                </span>
              </div>

              <div className="delivery-blocked-input">
                <label className="field">
                  <span className="field-label">
                    Adicionar bairro bloqueado
                  </span>
                  <input
                    className="input"
                    list="zona-norte-bairros"
                    value={blockedNeighborhoodInput}
                    onChange={(e) =>
                      setBlockedNeighborhoodInput(e.target.value)
                    }
                    placeholder="Digite ou escolha um bairro"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBlockedNeighborhood();
                      }
                    }}
                  />
                  <datalist id="zona-norte-bairros">
                    {ZONA_NORTE_BAIRROS.map((bairro) => (
                      <option key={bairro} value={bairro} />
                    ))}
                  </datalist>
                  <span className="field-helper">
                    Use a lista da Zona Norte ou digite outro bairro.
                  </span>
                </label>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddBlockedNeighborhood}
                >
                  Adicionar bairro
                </Button>
              </div>

              {blockedNeighborhoods.length > 0 ? (
                <div className="delivery-blocked-list">
                  {blockedNeighborhoods.map((bairro, idx) => (
                    <div
                      key={`${bairro}-${idx}`}
                      className="delivery-blocked-chip"
                    >
                      <span>{bairro}</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveBlockedNeighborhood(idx)
                        }
                        aria-label={`Remover bairro ${bairro}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="delivery-blocked-empty">
                  Nenhum bairro bloqueado configurado.
                </p>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="settings-section-title">
                Regras de entrega
              </div>

              <div className="form-grid settings-grid">
                <label className="field">
                  <span className="field-label">Pedido minimo (R$)</span>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={delivery.minOrderValue ?? 0}
                    onChange={(e) =>
                      handleDeliveryFieldChange(
                        "minOrderValue",
                        e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                      )
                    }
                  />
                  <span className="field-helper">
                    Bloqueia pedidos de entrega abaixo deste valor.
                  </span>
                </label>

                <label className="field">
                  <span className="field-label">Distancia maxima (km)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={delivery.maxDistanceKm ?? 0}
                    onChange={(e) =>
                      handleDeliveryFieldChange(
                        "maxDistanceKm",
                        e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                      )
                    }
                  />
                  <span className="field-helper">
                    Use 0 para sem limite.
                  </span>
                </label>

                <label className="field">
                  <span className="field-label">
                    Tempo estimado padrao (min)
                  </span>
                  <input
                    type="number"
                    step="1"
                    className="input"
                    value={delivery.etaMinutesDefault ?? 0}
                    onChange={(e) =>
                      handleDeliveryFieldChange(
                        "etaMinutesDefault",
                        e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                      )
                    }
                  />
                  <span className="field-helper">
                    Usado como previsao inicial no pedido.
                  </span>
                </label>
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={delivery.peakFee?.enabled || false}
                    onChange={(e) =>
                      handleDeliveryPeakFeeChange(
                        "enabled",
                        e.target.checked
                      )
                    }
                  />
                  <span>Taxa extra por horario de pico</span>
                </label>
              </div>

              {delivery.peakFee?.enabled && (
                <div className="form-grid settings-grid">
                  <label className="field">
                    <span className="field-label">Valor extra (R$)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={delivery.peakFee?.amount ?? 0}
                      onChange={(e) =>
                        handleDeliveryPeakFeeChange(
                          "amount",
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                        )
                      }
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Inicio</span>
                    <input
                      type="time"
                      className="input"
                      value={delivery.peakFee?.startTime || "18:00"}
                      onChange={(e) =>
                        handleDeliveryPeakFeeChange(
                          "startTime",
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Fim</span>
                    <input
                      type="time"
                      className="input"
                      value={delivery.peakFee?.endTime || "22:00"}
                      onChange={(e) =>
                        handleDeliveryPeakFeeChange(
                          "endTime",
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>
              )}

              {delivery.peakFee?.enabled && (
                <div style={{ marginTop: 8 }}>
                  <div className="field-label">Dias de pico</div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 6,
                    }}
                  >
                    {WEEKDAYS.map((day) => (
                      <label
                        key={`peak-${day.value}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            delivery.peakFee?.days?.includes(day.value) ||
                            false
                          }
                          onChange={() =>
                            handleDeliveryPeakFeeDayToggle(day.value)
                          }
                        />
                        <span>{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="business-hours-card">
              <div className="settings-section-title">
                Horario de funcionamento
              </div>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.businessHours?.enabled || false}
                  onChange={(e) =>
                    handleBusinessHoursChange(
                      "enabled",
                      e.target.checked
                    )
                  }
                />
                <span>Ativar restricao de horario</span>
              </label>

              {settings.businessHours?.enabled && (
                <>
                  <div className="business-hours-toolbar">
                    <div className="form-grid settings-grid">
                      <label className="field">
                        <span className="field-label">Abre as</span>
                        <input
                          type="time"
                          className="input"
                          value={
                            settings.businessHours?.openTime || "11:00"
                          }
                          onChange={(e) =>
                            handleBusinessHoursChange(
                              "openTime",
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label className="field">
                        <span className="field-label">Fecha as</span>
                        <input
                          type="time"
                          className="input"
                          value={
                            settings.businessHours?.closeTime || "23:00"
                          }
                          onChange={(e) =>
                            handleBusinessHoursChange(
                              "closeTime",
                              e.target.value
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="business-hours-toolbar-actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleApplyBusinessHoursToAll}
                      >
                        Aplicar para todos os dias
                      </Button>
                      <span className="field-helper">
                        Use um horario base e ajuste cada dia abaixo.
                      </span>
                    </div>
                  </div>

                  <div className="business-hours-grid">
                    <div className="business-hours-header">
                      <span>Dia</span>
                      <span>Status</span>
                      <span>Abre</span>
                      <span>Fecha</span>
                    </div>
                    {WEEKDAYS.map((day) => {
                      const entry =
                        businessSchedule.find(
                          (item) => Number(item.day) === day.value
                        ) || {
                          day: day.value,
                          enabled: true,
                          openTime:
                            settings.businessHours?.openTime || "11:00",
                          closeTime:
                            settings.businessHours?.closeTime || "23:00",
                        };
                      const isEnabled = entry.enabled !== false;
                      return (
                        <div
                          key={`schedule-${day.value}`}
                          className={
                            "business-hours-row" +
                            (isEnabled ? "" : " is-disabled")
                          }
                        >
                          <div className="business-hours-day">
                            {day.label}
                          </div>
                          <label className="business-hours-toggle">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) =>
                                handleWeeklyScheduleChange(
                                  day.value,
                                  "enabled",
                                  e.target.checked
                                )
                              }
                            />
                            <span>{isEnabled ? "Aberto" : "Fechado"}</span>
                          </label>
                          <div className="business-hours-time">
                            <input
                              type="time"
                              className="input"
                              value={entry.openTime || "11:00"}
                              disabled={!isEnabled}
                              onChange={(e) =>
                                handleWeeklyScheduleChange(
                                  day.value,
                                  "openTime",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="business-hours-time">
                            <input
                              type="time"
                              className="input"
                              value={entry.closeTime || "23:00"}
                              disabled={!isEnabled}
                              onChange={(e) =>
                                handleWeeklyScheduleChange(
                                  day.value,
                                  "closeTime",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA – Impressão */}
        <div className="settings-column">
          <div className="settings-section">
            <div className="settings-section-title">
              Impressão de pedidos
            </div>

            {/* Status da listagem de impressoras */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 8,
                gap: 8,
              }}
            >
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={loadPrinters}
                disabled={printersLoading}
              >
                {printersLoading
                  ? "Atualizando impressoras..."
                  : "Atualizar lista de impressoras"}
              </Button>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {printersLoading
                  ? "Buscando impressoras instaladas no sistema..."
                  : printers.length > 0
                  ? `${printers.length} impressora(s) encontrada(s).`
                  : "Nenhuma impressora encontrada ou listagem indisponível."}
              </span>
            </div>

            {printersError && (
              <p
                style={{
                  color: "#b91c1c",
                  fontSize: 12,
                  marginTop: 0,
                  marginBottom: 8,
                }}
              >
                {printersError}
              </p>
            )}

            <div className="settings-printing-grid">
              {/* Impressora cozinha */}
              <div className="settings-printing-block">
                <div className="field-label">Impressora da cozinha</div>

                <select
                  className="input"
                  value={kitchenPrinterName}
                  onChange={(e) =>
                    handlePrintingChange(
                      "kitchenPrinterName",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Usar impressora padrão do sistema
                  </option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.isDefault ? "⭐ " : ""}
                      {p.name}
                      {p.isDefault ? " (padrão)" : ""}
                    </option>
                  ))}
                </select>

                <div className="field-helper">
                  Selecione uma impressora térmica para tickets de
                  cozinha. O nome salvo será usado em todos os pedidos.
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#6b7280",
                  }}
                >
                  Nome salvo no sistema:
                  <div>
                    <code style={{ fontSize: 11 }}>
                      {kitchenPrinterName || "(padrão do sistema)"}
                    </code>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => handleTestPrinter("kitchen")}
                  style={{ marginTop: 8 }}
                >
                  Testar impressora da cozinha
                </Button>
              </div>

              {/* Impressora balcão */}
              <div className="settings-printing-block">
                <div className="field-label">
                  Impressora do balcão / conta
                </div>

                <select
                  className="input"
                  value={counterPrinterName}
                  onChange={(e) =>
                    handlePrintingChange(
                      "counterPrinterName",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Usar impressora padrão do sistema
                  </option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.isDefault ? "⭐ " : ""}
                      {p.name}
                      {p.isDefault ? " (padrão)" : ""}
                    </option>
                  ))}
                </select>

                <div className="field-helper">
                  Usada para impressão de conta / comprovante de
                  balcão. O nome salvo será usado em todos os pedidos.
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#6b7280",
                  }}
                >
                  Nome salvo no sistema:
                  <div>
                    <code style={{ fontSize: 11 }}>
                      {counterPrinterName || "(padrão do sistema)"}
                    </code>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => handleTestPrinter("counter")}
                  style={{ marginTop: 8 }}
                >
                  Testar impressora do balcão
                </Button>
              </div>
            </div>

            <div className="settings-printing-options">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settings.printing?.silentMode ?? true}
                  onChange={(e) =>
                    handlePrintingChange(
                      "silentMode",
                      e.target.checked
                    )
                  }
                />
                <span>
                  Impressão silenciosa (sem dialog de impressão)
                </span>
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={
                    settings.printing?.autoPrintWebsiteOrders || false
                  }
                  onChange={(e) =>
                    handlePrintingChange(
                      "autoPrintWebsiteOrders",
                      e.target.checked
                    )
                  }
                />
                <span>
                  Imprimir automaticamente pedidos vindos do site
                </span>
              </label>

              <p className="settings-printing-helper">
                As impressoras configuradas aqui serão usadas pelo
                módulo de Pedidos para imprimir automaticamente tickets
                de cozinha e de balcão, bem como pelos testes de
                impressão desta tela.
              </p>
            </div>
          </div>
        </div>

      
      {showApiConsole && (
        <Modal
          title="Console da API"
          subtitle="Mapa de endpoints e testes diretos"
          size="lg"
          onClose={() => setShowApiConsole(false)}
        >
          <div className="api-console">
            <div className="api-console-summary">
              <div className="api-console-card">
                <div className="api-console-label">Base URL</div>
                <div className="api-console-value">
                  {apiBaseUrlValue || "nao configurado"}
                </div>
              </div>

              <div className="api-console-card">
                <div className="api-console-label">Token publico</div>
                <div className="api-console-value">
                  <code>{apiTokenDisplay || "nao configurado"}</code>
                  {apiTokenValue && (
                    <button
                      type="button"
                      className="api-console-toggle"
                      onClick={() => setApiTokenVisible((prev) => !prev)}
                    >
                      {apiTokenVisible ? "Ocultar" : "Mostrar"}
                    </button>
                  )}
                </div>
              </div>

              <div className="api-console-quick">
                <button
                  type="button"
                  className="api-quick-chip"
                  onClick={() =>
                    handleQuickApiTest("GET", "/health", "", "public")
                  }
                >
                  Testar /health
                </button>
                <button
                  type="button"
                  className="api-quick-chip"
                  onClick={() =>
                    handleQuickApiTest("GET", "/api/menu", "", "api-key")
                  }
                >
                  Testar /api/menu
                </button>
                <button
                  type="button"
                  className="api-quick-chip"
                  onClick={() =>
                    handleQuickApiTest("GET", "/api/orders", "", "api-key")
                  }
                >
                  Listar /api/orders
                </button>
              </div>
            </div>

            <div className="api-console-grid">
              <div className="api-console-map">
                {API_ENDPOINT_GROUPS.map((group) => (
                  <div key={group.title} className="api-map-group">
                    <div className="api-map-header">
                      <div className="api-map-title">{group.title}</div>
                      <div className="api-map-desc">{group.description}</div>
                    </div>
                    <div className="api-map-list">
                      {group.endpoints.map((endpoint, idx) => {
                        const samplePath = getSamplePath(endpoint.path);
                        return (
                          <div
                            key={`${group.title}-${endpoint.path}-${idx}`}
                            className="api-endpoint-row"
                          >
                            <span
                              className={
                                "api-endpoint-method api-endpoint-method-" +
                                endpoint.method.toLowerCase()
                              }
                            >
                              {endpoint.method}
                            </span>
                            <span className="api-endpoint-path">
                              {endpoint.path}
                            </span>
                            <span
                              className={
                                "api-endpoint-auth api-endpoint-auth-" +
                                endpoint.auth
                              }
                            >
                              {getAuthLabel(endpoint.auth)}
                            </span>
                            <span className="api-endpoint-desc">
                              {endpoint.desc}
                            </span>
                            <button
                              type="button"
                              className="api-endpoint-test"
                              onClick={() =>
                                handleQuickApiTest(
                                  endpoint.method,
                                  samplePath,
                                  endpoint.sampleBody || "",
                                  endpoint.auth
                                )
                              }
                            >
                              Testar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="api-console-test">
                <div className="api-test-card">
                  <div className="api-test-title">Teste direto</div>

                  <div className="api-test-row">
                    <select
                      className="input"
                      value={apiTestState.method}
                      onChange={(e) =>
                        setApiTestState((prev) => ({
                          ...prev,
                          method: e.target.value,
                        }))
                      }
                    >
                      {API_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      value={apiTestState.path}
                      onChange={(e) =>
                        setApiTestState((prev) => ({
                          ...prev,
                          path: e.target.value,
                        }))
                      }
                      placeholder="/api/orders"
                    />
                  </div>

                  <label className="settings-toggle api-test-toggle">
                    <input
                      type="checkbox"
                      checked={apiTestState.useToken}
                      onChange={(e) =>
                        setApiTestState((prev) => ({
                          ...prev,
                          useToken: e.target.checked,
                        }))
                      }
                    />
                    <span>Enviar token publico (x-api-key)</span>
                  </label>

                  <div className="api-test-row">
                    <input
                      className="input"
                      value={apiTestState.headerName}
                      onChange={(e) =>
                        setApiTestState((prev) => ({
                          ...prev,
                          headerName: e.target.value,
                        }))
                      }
                      placeholder="Header extra (opcional)"
                    />
                    <input
                      className="input"
                      value={apiTestState.headerValue}
                      onChange={(e) =>
                        setApiTestState((prev) => ({
                          ...prev,
                          headerValue: e.target.value,
                        }))
                      }
                      placeholder="Valor do header"
                    />
                  </div>

                  <label className="field">
                    <span className="field-label">Body (JSON)</span>
                    <textarea
                      className="input api-test-body"
                      rows={6}
                      value={apiTestState.body}
                      onChange={(e) =>
                        setApiTestState((prev) => ({
                          ...prev,
                          body: e.target.value,
                        }))
                      }
                      placeholder='{"status":"preparing"}'
                    />
                  </label>

                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleRunApiTest()}
                    disabled={apiTestLoading}
                  >
                    {apiTestLoading ? "Executando..." : "Executar teste"}
                  </Button>

                  {apiTestError && (
                    <div className="api-test-error">{apiTestError}</div>
                  )}

                  {apiTestResult && (
                    <div className="api-test-result">
                      <div
                        className={
                          "api-test-status " +
                          (apiTestResult.ok
                            ? "api-test-status-ok"
                            : "api-test-status-error")
                        }
                      >
                        <span>Status {apiTestResult.status}</span>
                        <span>{apiTestResult.durationMs} ms</span>
                        <span>
                          {apiTestResult.contentType || "texto"}
                        </span>
                      </div>
                      <pre className="api-test-response">
                        {apiTestResult.json
                          ? JSON.stringify(apiTestResult.json, null, 2)
                          : apiTestResult.rawText || "(vazio)"}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showIntegrationManual && (
        <Modal
          title="Manual de integracao"
          subtitle="iFood, marketplaces e integracoes diretas"
          size="lg"
          onClose={() => setShowIntegrationManual(false)}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <div className="field-label">Dados da API</div>
              <div className="field-helper">
                Use a base e o token publico configurados no .env.
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                <div>
                  Base URL: <code>{apiBaseUrlValue || "nao configurado"}</code>
                </div>
                <div>
                  Token publico: <code>{apiTokenValue || "nao configurado"}</code>
                </div>
              </div>
            </div>

            <div>
              <div className="field-label">iFood e marketplaces</div>
              <div className="field-helper">
                Use um integrador ou webhook para enviar pedidos para o PDV.
              </div>
              <div style={{ marginTop: 8 }}>
                <div>1) Envio de pedidos:</div>
                <pre>
{`POST ${apiBaseUrlValue || "https://seu-host"}/api/orders
Headers: x-api-key: ${apiTokenValue || "SEU_TOKEN_PUBLICO"}
Body: {"orderType":"delivery","items":[...]}
`}
                </pre>
                <div>2) Cardapio:</div>
                <pre>
{`GET ${apiBaseUrlValue || "https://seu-host"}/api/menu
Headers: x-api-key: ${apiTokenValue || "SEU_TOKEN_PUBLICO"}
`}
                </pre>
              </div>
            </div>

            <div>
              <div className="field-label">Outros canais (site/app/WhatsApp)</div>
              <div className="field-helper">
                Padrao recomendado: enviar pedidos via /api/orders e atualizar
                status via /api/orders/:id.
              </div>
              <div style={{ marginTop: 8 }}>
                <pre>
{`PUT ${apiBaseUrlValue || "https://seu-host"}/api/orders/:id
Headers: x-api-key: ${apiTokenValue || "SEU_TOKEN_PUBLICO"}
Body: {"status":"preparing"}
`}
                </pre>
              </div>
            </div>

            <div>
              <div className="field-label">Checklist rapido</div>
              <div className="field-helper">
                - Token publico ativo no .env
                - Base URL acessivel externamente
                - Liberar rota /api/orders no firewall
              </div>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </Page>
  );
};

export default SettingsPage;









