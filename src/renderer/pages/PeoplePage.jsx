// src/renderer/pages/PeoplePage.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Page from "../components/layout/Page";
import Tabs from "../components/layout/Tabs";
import Button from "../components/common/Button";
import SearchInput from "../components/common/SearchInput";
import CustomerRow from "../components/people/CustomerRow";
import CustomerFormModal from "../components/people/CustomerFormModal";
import MotoboyRow from "../components/people/MotoboyRow";
import MotoboyFormModal from "../components/people/MotoboyFormModal";
import EmptyState from "../components/common/EmptyState";

// -----------------------------
// HELPERS DE NORMALIZAÇÃO
// -----------------------------

function normalizePhoneLocal(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

/**
 * Normaliza qualquer formato de customer (antigo ou novo) para o schema oficial:
 * {
 *   id, name, phone, phoneRaw,
 *   address: { cep, street, number, complement, neighborhood, city, state, reference },
 *   tags: string[],
 *   notes,
 *   meta: { createdAt, updatedAt, lastOrderAt, totalOrders, totalSpent },
 *   // aliases de conveniência:
 *   totalOrders,
 *   totalSpent
 * }
 */
function normalizeCustomer(raw) {
  if (!raw) return null;

  const id =
    raw.id ||
    `cust-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const phoneRaw = raw.phoneRaw || raw.phone || "";
  const phoneDigits = normalizePhoneLocal(phoneRaw);

  const addr = raw.address || {};
  const meta = raw.meta || {};

  const totalOrders =
    meta.totalOrders != null
      ? meta.totalOrders
      : raw.totalOrders != null
      ? raw.totalOrders
      : 0;

  const totalSpent =
    meta.totalSpent != null
      ? meta.totalSpent
      : raw.totalSpent != null
      ? raw.totalSpent
      : 0;

  const normalizedMeta = {
    createdAt: meta.createdAt || raw.createdAt || null,
    updatedAt: meta.updatedAt || raw.updatedAt || null,
    lastOrderAt: meta.lastOrderAt || raw.lastOrderAt || null,
    totalOrders,
    totalSpent,
  };

  const tags = Array.isArray(raw.tags)
    ? raw.tags
    : raw.isVip
    ? ["VIP"]
    : [];

  return {
    // mantém qualquer outra prop que já existia
    ...raw,
    id,
    name: raw.name || raw.nome || "",
    phone: phoneDigits,
    phoneRaw,

    address: {
      cep: addr.cep || raw.cep || "",
      street: addr.street || addr.rua || "",
      number: addr.number || addr.numero || "",
      complement: addr.complement || addr.complemento || "",
      neighborhood:
        addr.neighborhood || addr.bairro || "",
      city: addr.city || addr.cidade || "",
      state: addr.state || addr.uf || "",
      reference:
        addr.reference || addr.referencia || "",
    },

    tags,
    notes: raw.notes || raw.obs || raw.observacoes || "",

    meta: normalizedMeta,

    // aliases de conveniência para não quebrar código legado
    totalOrders,
    totalSpent,
  };
}

const PeoplePage = () => {
  const [tab, setTab] = useState("customers");

  const [customers, setCustomers] = useState([]);
  const [motoboys, setMotoboys] = useState([]);

  const [search, setSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingMotoboys, setLoadingMotoboys] = useState(false);

  const [activeModal, setActiveModal] = useState(null); // 'customer-form' | 'motoboy-form' | null
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedMotoboy, setSelectedMotoboy] = useState(null);

  // input hidden para importação de JSON de clientes
  const importInputRef = useRef(null);

  // -----------------------------
  // LOAD DB
  // -----------------------------
  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const data = await window.dataEngine.get("customers");
      const items = Array.isArray(data?.items) ? data.items : [];

      const normalized = items
        .map(normalizeCustomer)
        .filter(Boolean);

      setCustomers(normalized);
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadMotoboys = async () => {
    try {
      setLoadingMotoboys(true);
      const data = await window.dataEngine.get("motoboys");
      const items = Array.isArray(data?.items) ? data.items : [];
      setMotoboys(items);
    } catch (err) {
      console.error("Erro ao carregar motoboys:", err);
    } finally {
      setLoadingMotoboys(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadMotoboys();
  }, []);

  // -----------------------------
  // IMPORT / EXPORT CLIENTES (JSON)
  // -----------------------------
  const handleExportCustomersJson = () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        // já exportamos no schema normalizado
        items: customers,
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], {
        type: "application/json;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
      link.href = url;
      link.download = `clientes_anne_tom_${ts}.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao exportar clientes JSON:", err);
      alert(
        "Não foi possível exportar os clientes em JSON. Veja o console para detalhes."
      );
    }
  };

  // tenta suportar diferentes formatos de payload
  const normalizeImportedCustomers = (raw) => {
    if (!raw) return [];

    let base = [];

    // array direto
    if (Array.isArray(raw)) {
      base = raw;
    } else if (Array.isArray(raw.items)) {
      base = raw.items;
    } else if (Array.isArray(raw.customers)) {
      base = raw.customers;
    } else {
      base = [];
    }

    return base
      .map(normalizeCustomer)
      .filter(Boolean);
  };

  const handleImportCustomersClick = () => {
    if (importInputRef.current) {
      importInputRef.current.value = ""; // permite importar o mesmo arquivo novamente
      importInputRef.current.click();
    }
  };

  const handleImportCustomersChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const text = e.target?.result;
          const parsed = JSON.parse(text);
          const imported = normalizeImportedCustomers(parsed);

          if (!Array.isArray(imported) || imported.length === 0) {
            alert(
              "O arquivo JSON não possui um formato válido de lista de clientes."
            );
            return;
          }

          // salva já no schema oficial
          await window.dataEngine.set("customers", {
            items: imported,
          });

          setCustomers(imported);
          alert(
            `Importação concluída com sucesso. ${imported.length} cliente(s) carregado(s).`
          );
        } catch (err) {
          console.error("Erro ao processar arquivo JSON:", err);
          alert(
            "Não foi possível ler o arquivo JSON de clientes. Verifique o formato."
          );
        }
      };

      reader.readAsText(file, "utf-8");
    } catch (err) {
      console.error("Erro ao importar clientes JSON:", err);
      alert(
        "Não foi possível importar o arquivo de clientes. Veja o console para detalhes."
      );
    }
  };

  // -----------------------------
  // FILTROS
  // -----------------------------
  const searchQuery = search.trim().toLowerCase();
  const searchPhoneDigits = normalizePhoneLocal(search);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery && !searchPhoneDigits) return customers;

    return customers.filter((c) => {
      const addr = c.address || {};
      const name = (c.name || "").toLowerCase();
      const phoneStr = (c.phoneRaw || c.phone || "")
        .toString()
        .toLowerCase();
      const cpfStr = (c.cpf || "").toLowerCase();
      const neighborhood =
        (addr.neighborhood || "").toLowerCase();

      const matchesText =
        name.includes(searchQuery) ||
        phoneStr.includes(searchQuery) ||
        cpfStr.includes(searchQuery) ||
        neighborhood.includes(searchQuery);

      const matchesDigits =
        !!searchPhoneDigits &&
        normalizePhoneLocal(c.phone || c.phoneRaw).includes(
          searchPhoneDigits
        );

      return matchesText || matchesDigits;
    });
  }, [customers, searchQuery, searchPhoneDigits]);

  const filteredMotoboys = useMemo(() => {
    if (!searchQuery) return motoboys;

    return motoboys.filter((m) => {
      return (
        m.name?.toLowerCase().includes(searchQuery) ||
        m.phone?.toLowerCase().includes(searchQuery) ||
        m.vehicleType?.toLowerCase().includes(searchQuery) ||
        m.vehiclePlate?.toLowerCase().includes(searchQuery)
      );
    });
  }, [motoboys, searchQuery]);

  // -----------------------------
  // MÉTRICAS RÁPIDAS PARA RESUMO
  // -----------------------------
  const customerSummary = useMemo(() => {
    const total = customers.length;
    const vip = customers.filter(
      (c) => (c.totalOrders || 0) >= 20
    ).length;
    const frequent = customers.filter((c) => {
      const t = c.totalOrders || 0;
      return t >= 5 && t < 20;
    }).length;

    return { total, vip, frequent };
  }, [customers]);

  const motoboySummary = useMemo(() => {
    const total = motoboys.length;
    const active = motoboys.filter(
      (m) => m.isActive !== false
    ).length;
    return { total, active };
  }, [motoboys]);

  // -----------------------------
  // MODAIS
  // -----------------------------
  const openNewCustomer = () => {
    setSelectedCustomer(null);
    setActiveModal("customer-form");
  };

  const openEditCustomer = (customer) => {
    setSelectedCustomer(customer);
    setActiveModal("customer-form");
  };

  const openNewMotoboy = () => {
    setSelectedMotoboy(null);
    setActiveModal("motoboy-form");
  };

  const openEditMotoboy = (motoboy) => {
    setSelectedMotoboy(motoboy);
    setActiveModal("motoboy-form");
  };

  const closeModal = () => {
    setSelectedCustomer(null);
    setSelectedMotoboy(null);
    setActiveModal(null);
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  const isCustomersTab = tab === "customers";

  const isLoading = isCustomersTab
    ? loadingCustomers
    : loadingMotoboys;

  const hasItems = isCustomersTab
    ? filteredCustomers.length > 0
    : filteredMotoboys.length > 0;

  return (
    <Page
      title="Pessoas"
      subtitle="Clientes e entregadores da pizzaria."
      actions={
        isCustomersTab ? (
          <div className="people-actions">
            <Button
              variant="outline"
              onClick={handleExportCustomersJson}
            >
              Exportar JSON
            </Button>
            <Button
              variant="outline"
              onClick={handleImportCustomersClick}
            >
              Importar JSON
            </Button>
            <Button variant="primary" onClick={openNewCustomer}>
              Novo cliente
            </Button>

            {/* input escondido para importar arquivo .json */}
            <input
              type="file"
              ref={importInputRef}
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={handleImportCustomersChange}
            />
          </div>
        ) : (
          <Button variant="primary" onClick={openNewMotoboy}>
            Novo motoboy
          </Button>
        )
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "customers", label: "Clientes" },
          { value: "motoboys", label: "Entregadores" },
        ]}
      />

      <div className="people-toolbar">
        <SearchInput
          placeholder={
            isCustomersTab
              ? "Buscar cliente por nome, telefone, CPF ou bairro..."
              : "Buscar motoboy por nome, telefone, veículo ou placa..."
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Resumo rápido */}
      <div className="people-summary">
        {isCustomersTab ? (
          <span>
            {customerSummary.total} clientes ·{" "}
            {customerSummary.vip} VIP ·{" "}
            {customerSummary.frequent} frequentes
          </span>
        ) : (
          <span>
            {motoboySummary.total} entregadores ·{" "}
            {motoboySummary.active} ativos
          </span>
        )}
      </div>

      {isLoading && (
        <p className="people-loading">
          Carregando dados de {isCustomersTab ? "clientes" : "motoboys"}
          ...
        </p>
      )}

      {!isLoading && (
        <>
          {isCustomersTab ? (
            <>
              {!hasItems ? (
                <EmptyState
                  title="Nenhum cliente"
                  description="Cadastre clientes para facilitar os próximos pedidos."
                />
              ) : (
                <div className="customer-list">
                  {filteredCustomers.map((c) => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      onClick={openEditCustomer}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {!hasItems ? (
                <EmptyState
                  title="Nenhum entregador"
                  description="Cadastre seus motoboys para controlar as entregas."
                />
              ) : (
                <div className="motoboy-list">
                  {filteredMotoboys.map((m) => (
                    <MotoboyRow
                      key={m.id}
                      motoboy={m}
                      onClick={openEditMotoboy}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeModal === "customer-form" && (
        <CustomerFormModal
          initialData={selectedCustomer}
          onClose={closeModal}
          onSaved={loadCustomers}
        />
      )}

      {activeModal === "motoboy-form" && (
        <MotoboyFormModal
          initialData={selectedMotoboy}
          onClose={closeModal}
          onSaved={loadMotoboys}
        />
      )}
    </Page>
  );
};

export default PeoplePage;
