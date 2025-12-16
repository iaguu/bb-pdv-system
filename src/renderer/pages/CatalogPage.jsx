// src/renderer/pages/CatalogPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Page from "../components/layout/Page";
import Button from "../components/common/Button";
import ProductList from "../components/catalog/ProductList";
import ProductFormModal from "../components/catalog/ProductFormModal";

// Normaliza qualquer formato da colecao de produtos
// - { items: [...] }  (DataEngine)
// - { products: [...] } (products.json da API)
// - [ ... ]           (array puro)
const normalizeProductsData = (data) => {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data)) return data;
  return [];
};

const TYPE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "pizza", label: "Pizzas" },
  { value: "drink", label: "Bebidas" },
  { value: "extra", label: "Adicionais" },
];

const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Pausados" },
];

const FilterChips = ({ options, value, onChange }) => {
  if (!Array.isArray(options)) return null;

  return (
    <div className="catalog-filter-chips">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={"chip" + (value === opt.value ? " chip-active" : "")}
          onClick={() => onChange && onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const CatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | pizza | drink | extra
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive

  const [activeProduct, setActiveProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // {type: 'ok'|'error', message: string}
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef(null);

  // ------------------ CARREGAR DO DATAENGINE ------------------
  const loadProducts = async () => {
    try {
      setLoading(true);
      if (!window.dataEngine || typeof window.dataEngine.get !== "function") {
        console.warn("[CatalogPage] window.dataEngine.get nao disponivel");
        setProducts([]);
        return;
      }

      const data = await window.dataEngine.get("products");
      const items = normalizeProductsData(data);
      setProducts(items);
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // ---- Resumo de catalogo (cards no topo) ----
  const catalogSummary = useMemo(() => {
    if (!products || !products.length) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        pizzas: 0,
        drinks: 0,
        extras: 0,
      };
    }

    let total = products.length;
    let active = 0;
    let inactive = 0;
    let pizzas = 0;
    let drinks = 0;
    let extras = 0;

    products.forEach((p) => {
      const isActive = p.active !== false && p.isAvailable !== false;
      if (isActive) active += 1;
      else inactive += 1;

      const type = (p.type || "").toLowerCase();
      if (type === "pizza") pizzas += 1;
      else if (type === "drink" || type === "bebida") drinks += 1;
      else if (type === "extra" || type === "adicional") extras += 1;
    });

    return { total, active, inactive, pizzas, drinks, extras };
  }, [products]);

  // ---- Filtro principal (busca + tipo + status) ----
  const filteredProducts = useMemo(() => {
    let result = [...products];
    const q = search.trim().toLowerCase();

    if (q) {
      result = result.filter((p) => {
        const name = (p.name || p.nome || "").toLowerCase();
        const type = (p.type || "").toLowerCase();
        const category = (p.category || p.categoria || "").toLowerCase();
        const description = (p.description || "").toLowerCase();

        return (
          name.includes(q) ||
          type.includes(q) ||
          category.includes(q) ||
          description.includes(q)
        );
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((p) => {
        const type = (p.type || "").toLowerCase();
        if (typeFilter === "pizza") return type === "pizza";
        if (typeFilter === "drink") return type === "drink" || type === "bebida";
        if (typeFilter === "extra") return type === "extra" || type === "adicional";
        return true;
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => {
        const isActive = p.active !== false && p.isAvailable !== false;
        if (statusFilter === "active") return isActive;
        if (statusFilter === "inactive") return !isActive;
        return true;
      });
    }

    return result;
  }, [products, search, typeFilter, statusFilter]);

  const openForm = (productToEdit = null) => {
    setActiveProduct(productToEdit);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setActiveProduct(null);
  };

  const handleFormSaved = async () => {
    await loadProducts();
    setShowForm(false);
    setActiveProduct(null);
  };

  // ------------------ EXPORTAR JSON (FORMATO DA API) ------------------
  const handleExportJson = async () => {
    try {
      setImportStatus(null);

      if (!window.dataEngine || typeof window.dataEngine.get !== "function") {
        console.warn("[CatalogPage] window.dataEngine.get nao disponivel");
      }

      const data = await window.dataEngine.get("products");
      const items = normalizeProductsData(data);

      const exported = {
        version: 1,
        exportedAt: new Date().toISOString(),
        products: items.map((p) => ({
          id: p.id,
          type: p.type || "pizza", // pizza | drink | extra
          // API / site trabalham com "nome" e "categoria"
          nome: p.nome || p.name || "",
          categoria: p.categoria || p.category || "",
          ingredientes: Array.isArray(p.ingredientes) ? p.ingredientes : [],
          preco_broto: p.preco_broto ?? p.priceBroto ?? null,
          preco_grande: p.preco_grande ?? p.priceGrande ?? null,
          badges: Array.isArray(p.badges) ? p.badges : [],
          extras: Array.isArray(p.extras) ? p.extras : [],
          sugestoes:
            Array.isArray(p.sugestoes) || Array.isArray(p.suggestions)
              ? p.sugestoes || p.suggestions
              : [],
        })),
      };

      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalogo-products-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setImportStatus({
        type: "ok",
        message: "Catalogo exportado com sucesso.",
      });
    } catch (err) {
      console.error("Erro ao exportar JSON:", err);
      setImportStatus({
        type: "error",
        message: "Erro ao exportar JSON.",
      });
    }
  };

  // ------------------ IMPORTAR JSON (FORMATO DA API) ------------------
  const handleClickImport = () => {
    setImportStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!json || !Array.isArray(json.products)) {
        throw new Error("JSON sem campo 'products' valido.");
      }

      const items = json.products
        .filter((p) => p && (p.name || p.nome))
        .map((p, index) => ({
          id: p.id || `prod-${index + 1}`,
          type: p.type || "pizza",
          // Internamente o sistema usa "name" e "category"
          name: p.name || p.nome || "",
          description:
            p.description ||
            (Array.isArray(p.ingredientes) ? p.ingredientes.join(", ") : ""),
          category: p.category || p.categoria || "",
          priceBroto:
            typeof p.priceBroto === "number"
              ? p.priceBroto
              : typeof p.preco_broto === "number"
              ? p.preco_broto
              : null,
          priceGrande:
            typeof p.priceGrande === "number"
              ? p.priceGrande
              : typeof p.preco_grande === "number"
              ? p.preco_grande
              : null,
          price: typeof p.price === "number" ? p.price : null,
          active: p.active !== false,
          // Guardamos info extra pra outros usos (site, CardapioPage, etc.)
          ingredientes: Array.isArray(p.ingredientes) ? p.ingredientes : [],
          badges: Array.isArray(p.badges) ? p.badges : [],
          extras: Array.isArray(p.extras) ? p.extras : [],
          sugestoes:
            Array.isArray(p.sugestoes) || Array.isArray(p.suggestions)
              ? p.sugestoes || p.suggestions
              : [],
        }));

      if (!window.dataEngine || typeof window.dataEngine.set !== "function") {
        console.warn(
          "[CatalogPage] window.dataEngine.set nao disponivel; aplicando apenas em memoria"
        );
        setProducts(items);
        setImportStatus({
          type: "ok",
          message: `Catalogo importado em memoria (${items.length} produto(s)).`,
        });
        return;
      }

      await window.dataEngine.set("products", { items });
      await loadProducts();

      setImportStatus({
        type: "ok",
        message: `Catalogo importado (${items.length} produto(s)).`,
      });
    } catch (err) {
      console.error("Erro ao importar JSON:", err);
      setImportStatus({
        type: "error",
        message: "Nao foi possivel importar o arquivo. Verifique o formato do JSON.",
      });
    }
  };

  return (
    <Page
      title="Catalogo"
      subtitle="Pizzas, bebidas e adicionais disponiveis para pedidos."
      actions={
        <div className="catalog-header-actions">
          <Button variant="secondary" onClick={handleClickImport}>
            Importar JSON
          </Button>
          <Button variant="ghost" onClick={handleExportJson}>
            Exportar JSON
          </Button>
          <Button variant="primary" onClick={() => openForm()}>
            Novo produto
          </Button>
        </div>
      }
    >
      {/* input invisivel para selecionar o arquivo JSON */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {importStatus && (
        <p
          className={
            "catalog-import-status" +
            (importStatus.type === "error"
              ? " catalog-import-status-error"
              : " catalog-import-status-ok")
          }
        >
          {importStatus.message}
        </p>
      )}

      {/* Resumo do catalogo (cards simples) */}
      <div className="catalog-summary-grid">
        <div className="catalog-summary-card">
          <div className="catalog-summary-label">Produtos totais</div>
          <div className="catalog-summary-value">{catalogSummary.total}</div>
        </div>
        <div className="catalog-summary-card">
          <div className="catalog-summary-label">Ativos</div>
          <div className="catalog-summary-value">{catalogSummary.active}</div>
        </div>
        <div className="catalog-summary-card">
          <div className="catalog-summary-label">Pausados</div>
          <div className="catalog-summary-value">{catalogSummary.inactive}</div>
        </div>
        <div className="catalog-summary-card">
          <div className="catalog-summary-label">Pizzas</div>
          <div className="catalog-summary-value">{catalogSummary.pizzas}</div>
        </div>
        <div className="catalog-summary-card">
          <div className="catalog-summary-label">Bebidas</div>
          <div className="catalog-summary-value">{catalogSummary.drinks}</div>
        </div>
        <div className="catalog-summary-card">
          <div className="catalog-summary-label">Adicionais</div>
          <div className="catalog-summary-value">{catalogSummary.extras}</div>
        </div>
      </div>

      {/* Barra de filtros / busca */}
      <div className="catalog-toolbar">
        <div className="catalog-toolbar-left">
          <label className="field">
            <span className="field-label">Buscar no catalogo</span>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, categoria, tipo ou descricao..."
            />
          </label>
        </div>

        <div className="catalog-toolbar-right">
          <div className="catalog-filter-group">
            <FilterChips
              options={TYPE_FILTERS}
              value={typeFilter}
              onChange={setTypeFilter}
            />
          </div>

          <div className="catalog-filter-group">
            <FilterChips
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="catalog-loading">Carregando produtos...</p>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-title">Nenhum produto encontrado.</h3>
          <p className="empty-description">
            Ajuste a busca ou filtros, ou importe um JSON de catalogo.
          </p>
        </div>
      ) : (
        <ProductList products={filteredProducts} onEdit={openForm} />
      )}

      {showForm && (
        <ProductFormModal
          product={activeProduct}
          onClose={handleFormClose}
          onSave={handleFormSaved}
        />
      )}
    </Page>
  );
};

export default CatalogPage;
