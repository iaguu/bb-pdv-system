// src/renderer/pages/StockPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import Page from "../components/layout/Page";
import Tabs from "../components/layout/Tabs";
import Button from "../components/common/Button";
import SearchInput from "../components/common/SearchInput";

/**
 * Normaliza qualquer formato da coleção de produtos do DataEngine:
 * - { items: [...] }
 * - { products: [...] }
 * - [ ... ]
 */
const normalizeProductsData = (data) => {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data)) return data;
  return [];
};

/**
 * Normaliza uma string para ser usada como "chave" de ingrediente
 * (case insensitive, sem espaços extras).
 */
const normalizeKey = (value) => {
  if (!value) return "";
  return String(value).trim().toLowerCase();
};

/**
 * Aplica as regras de estoque aos produtos:
 * - Pausa pizzas que possuem ingredientes marcados como indisponíveis;
 * - Mantém flag _autoPausedByStock para saber o que foi pausado pelo estoque;
 * - Respeita pausas manuais (_manualOutOfStock).
 */
const computeProductsWithStock = (baseProducts, ingredientStockMap) => {
  const unavailableKeys = new Set(
    Object.values(ingredientStockMap || {})
      .filter((item) => {
        const q = Number(item.quantity ?? 0);
        const minQ = Number(item.minQuantity ?? 0);
        // Considera em falta se marcado explicitamente ou se quantidade <= 0 com mínimo > 0
        return item.unavailable || (minQ > 0 && q <= 0);
      })
      .map((item) => item.key)
  );

  return (baseProducts || []).map((p) => {
    const type = (p.type || "").toLowerCase();
    const ingredientes = Array.isArray(p.ingredientes) ? p.ingredientes : [];

    const hasMissingIngredient =
      type === "pizza" &&
      ingredientes.some((ing) => unavailableKeys.has(normalizeKey(ing)));

    const manualOut = p._manualOutOfStock === true;
    const wasAutoPaused = p._autoPausedByStock === true;

    // Se estiver sem ingrediente OU manualmente marcado como sem estoque → pausa
    if (hasMissingIngredient || manualOut) {
      return {
        ...p,
        _autoPausedByStock: hasMissingIngredient,
        active: false,
        isAvailable: false,
      };
    }

    // Se antes estava pausado automaticamente por estoque e agora não há mais falta → reativa
    if (wasAutoPaused && !hasMissingIngredient && !manualOut) {
      return {
        ...p,
        _autoPausedByStock: false,
        active: true,
        isAvailable: true,
      };
    }

    // Sem impacto de estoque: mantém como já estava
    return p;
  });
};

const StockPage = () => {
  const [tab, setTab] = useState("ingredients"); // ingredients | products

  const [products, setProducts] = useState([]);
  const [ingredientStock, setIngredientStock] = useState({}); // key -> { key, name, quantity, minQuantity, unavailable }

  const [searchIngredient, setSearchIngredient] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("all"); // all | pizza | drink | extra

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // -----------------------------
  // LOAD INICIAL (produtos + estoque de ingredientes)
  // -----------------------------
  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.dataEngine || typeof window.dataEngine.get !== "function") {
        console.warn("[StockPage] window.dataEngine.get não disponível");
        setProducts([]);
        setIngredientStock({});
        return;
      }

      const [productsData, stockIngredientsData] = await Promise.all([
        window.dataEngine.get("products"),
        // se ainda não existir a coleção de estoque de ingredientes, não quebra
        window.dataEngine.get("stock_ingredients").catch(() => null),
      ]);

      const items = normalizeProductsData(productsData);
      const normalizedProducts = Array.isArray(items) ? items : [];

      // Constrói índice de ingredientes existentes nas pizzas
      const ingredientIndexFromProducts = {};
      normalizedProducts.forEach((p) => {
        const type = (p.type || "").toLowerCase();
        if (type !== "pizza") return;

        const ingredientes = Array.isArray(p.ingredientes)
          ? p.ingredientes
          : [];

        ingredientes.forEach((rawName) => {
          const key = normalizeKey(rawName);
          if (!key) return;

          if (!ingredientIndexFromProducts[key]) {
            ingredientIndexFromProducts[key] = {
              key,
              name: rawName,
            };
          }
        });
      });

      // Normaliza estoque salvo (se existir)
      const stockItemsRaw = Array.isArray(stockIngredientsData?.items)
        ? stockIngredientsData.items
        : Array.isArray(stockIngredientsData)
        ? stockIngredientsData
        : [];

      const ingredientStockMap = {};

      // Primeiro, usa os ingredientes que existem no catálogo
      Object.values(ingredientIndexFromProducts).forEach((ing) => {
        const existing = stockItemsRaw.find(
          (s) =>
            normalizeKey(s.key || s.name || s.ingrediente) === ing.key ||
            normalizeKey(s.name) === ing.key
        );

        ingredientStockMap[ing.key] = {
          key: ing.key,
          name: (existing && existing.name) || ing.name,
          quantity: Number(existing?.quantity ?? 0),
          minQuantity: Number(existing?.minQuantity ?? 0),
          unavailable: Boolean(existing?.unavailable),
        };
      });

      // Depois, adiciona qualquer ingrediente salvo que não está mais no catálogo,
      // mas que ainda pode ser útil manter no controle.
      stockItemsRaw.forEach((s) => {
        const key = normalizeKey(s.key || s.name || s.ingrediente);
        if (!key) return;
        if (ingredientStockMap[key]) return;

        ingredientStockMap[key] = {
          key,
          name: s.name || s.ingrediente || key,
          quantity: Number(s.quantity ?? 0),
          minQuantity: Number(s.minQuantity ?? 0),
          unavailable: Boolean(s.unavailable),
        };
      });

      // Aplica regras de estoque aos produtos na memória
      const productsWithStock = computeProductsWithStock(
        normalizedProducts,
        ingredientStockMap
      );

      setProducts(productsWithStock);
      setIngredientStock(ingredientStockMap);

      // Garante que o estado de "products" com estoque aplicado está persistido
      if (window.dataEngine && typeof window.dataEngine.set === "function") {
        await window.dataEngine.set("products", {
          items: productsWithStock,
        });
      }
    } catch (err) {
      console.error("[StockPage] Erro ao carregar estoque:", err);
      setError("Não foi possível carregar os dados de estoque.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // -----------------------------
  // PERSISTÊNCIA DO ESTOQUE DE INGREDIENTES
  // -----------------------------
  const persistIngredientStock = async (stockMap, updatedProducts) => {
    if (!window.dataEngine || typeof window.dataEngine.set !== "function") {
      console.warn("[StockPage] window.dataEngine.set não disponível");
      return;
    }

    const stockItems = Object.values(stockMap || {}).map((s) => ({
      key: s.key,
      name: s.name,
      quantity: Number(s.quantity ?? 0),
      minQuantity: Number(s.minQuantity ?? 0),
      unavailable: Boolean(s.unavailable),
    }));

    await Promise.all([
      window.dataEngine.set("stock_ingredients", {
        items: stockItems,
      }),
      updatedProducts &&
        window.dataEngine.set("products", {
          items: updatedProducts,
        }),
    ]);
  };

  // -----------------------------
  // SUMMARY / DERIVADOS
  // -----------------------------
  const stockSummary = useMemo(() => {
    const ingredients = Object.values(ingredientStock || {});
    const totalIngredients = ingredients.length;
    const missingIngredients = ingredients.filter(
      (i) =>
        i.unavailable ||
        (Number(i.minQuantity ?? 0) > 0 && Number(i.quantity ?? 0) <= 0)
    ).length;

    const totalProducts = (products || []).length;
    const autoPausedProducts = (products || []).filter(
      (p) => p._autoPausedByStock === true
    ).length;
    const manualPausedProducts = (products || []).filter(
      (p) => p._manualOutOfStock === true
    ).length;

    return {
      totalIngredients,
      missingIngredients,
      totalProducts,
      autoPausedProducts,
      manualPausedProducts,
    };
  }, [ingredientStock, products]);

  const unavailableIngredientsSet = useMemo(() => {
    const set = new Set();
    Object.values(ingredientStock || {}).forEach((i) => {
      const qty = Number(i.quantity ?? 0);
      const minQ = Number(i.minQuantity ?? 0);
      if (i.unavailable || (minQ > 0 && qty <= 0)) {
        set.add(i.key);
      }
    });
    return set;
  }, [ingredientStock]);

  // -----------------------------
  // HANDLERS – INGREDIENTES
  // -----------------------------
  const handleIngredientFieldChange = (key, field, rawValue) => {
    setIngredientStock((prev) => {
      const current = prev[key];
      if (!current) return prev;

      let value = rawValue;
      if (field === "quantity" || field === "minQuantity") {
        const n = Number(rawValue);
        value = Number.isNaN(n) ? "" : n;
      }

      return {
        ...prev,
        [key]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleToggleIngredientUnavailable = async (key) => {
    const current = ingredientStock[key];
    if (!current) return;

    const nextStock = {
      ...ingredientStock,
      [key]: {
        ...current,
        unavailable: !current.unavailable,
      },
    };

    setIngredientStock(nextStock);

    try {
      setSaving(true);
      const updatedProducts = computeProductsWithStock(products, nextStock);
      setProducts(updatedProducts);
      await persistIngredientStock(nextStock, updatedProducts);
    } catch (err) {
      console.error("[StockPage] Erro ao atualizar ingrediente:", err);
      setError("Erro ao atualizar o estoque do ingrediente.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllIngredients = async () => {
    try {
      setSaving(true);
      const updatedProducts = computeProductsWithStock(
        products,
        ingredientStock
      );
      setProducts(updatedProducts);
      await persistIngredientStock(ingredientStock, updatedProducts);
    } catch (err) {
      console.error("[StockPage] Erro ao salvar estoque:", err);
      setError("Erro ao salvar o estoque de ingredientes.");
    } finally {
      setSaving(false);
    }
  };

  // Lista de ingredientes filtrada
  const filteredIngredients = useMemo(() => {
    const list = Object.values(ingredientStock || {});
    const q = searchIngredient.trim().toLowerCase();

    let result = list;
    if (q) {
      result = result.filter((i) =>
        (i.name || "").toLowerCase().includes(q)
      );
    }

    // Ordena deixando os em falta primeiro
    return result.sort((a, b) => {
      const aMissing =
        a.unavailable ||
        (Number(a.minQuantity ?? 0) > 0 && Number(a.quantity ?? 0) <= 0);
      const bMissing =
        b.unavailable ||
        (Number(b.minQuantity ?? 0) > 0 && Number(b.quantity ?? 0) <= 0);

      if (aMissing && !bMissing) return -1;
      if (!aMissing && bMissing) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [ingredientStock, searchIngredient]);

  // -----------------------------
  // HANDLERS – PRODUTOS (manual "sem estoque")
  // -----------------------------
  const handleToggleProductOutOfStock = async (index) => {
    setProducts(async (prev) => {
      const base = Array.isArray(prev) ? [...prev] : [];
      const current = base[index];
      if (!current) return prev;

      const nextManualOut = !current._manualOutOfStock;

      base[index] = {
        ...current,
        _manualOutOfStock: nextManualOut,
      };

      const updated = computeProductsWithStock(base, ingredientStock);

      try {
        setSaving(true);
        if (
          window.dataEngine &&
          typeof window.dataEngine.set === "function"
        ) {
          await window.dataEngine.set("products", {
            items: updated,
          });
        }
      } catch (err) {
        console.error("[StockPage] Erro ao atualizar produto:", err);
        setError("Erro ao atualizar disponibilidade do produto.");
      } finally {
        setSaving(false);
      }

      return updated;
    });
  };

  // Lista de produtos filtrada
  const filteredProducts = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    const q = searchProduct.trim().toLowerCase();

    let result = list;

    if (productTypeFilter !== "all") {
      result = result.filter((p) => {
        const type = (p.type || "").toLowerCase();
        if (productTypeFilter === "pizza") return type === "pizza";
        if (productTypeFilter === "drink")
          return type === "drink" || type === "bebida";
        if (productTypeFilter === "extra")
          return type === "extra" || type === "adicional";
        return true;
      });
    }

    if (q) {
      result = result.filter((p) => {
        const name = (p.name || p.nome || "").toLowerCase();
        const category = (p.categoria || p.category || "").toLowerCase();
        const type = (p.type || "").toLowerCase();
        return (
          name.includes(q) || category.includes(q) || type.includes(q)
        );
      });
    }

    // Ordena por tipo e nome
    return result.sort((a, b) => {
      const ta = (a.type || "").toLowerCase();
      const tb = (b.type || "").toLowerCase();
      if (ta !== tb) return ta.localeCompare(tb);
      const na = (a.name || a.nome || "").toLowerCase();
      const nb = (b.name || b.nome || "").toLowerCase();
      return na.localeCompare(nb);
    });
  }, [products, searchProduct, productTypeFilter]);

  // -----------------------------
  // RENDER – TABS
  // -----------------------------
  const renderIngredientsTab = () => {
    return (
      <div className="stock-section">
        <div className="stock-toolbar">
          <SearchInput
            placeholder="Buscar ingrediente..."
            value={searchIngredient}
            onChange={setSearchIngredient}
          />

          <div className="stock-toolbar-actions">
            <Button
              variant="ghost"
              onClick={loadAll}
              disabled={loading || saving}
            >
              Recarregar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAllIngredients}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>

        <div className="stock-table-wrapper">
          {filteredIngredients.length === 0 ? (
            <p className="stock-empty">
              Nenhum ingrediente encontrado. Adicione ingredientes no catálogo
              de pizzas primeiro.
            </p>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Qtd. atual</th>
                  <th>Qtd. mínima</th>
                  <th>Em falta?</th>
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.map((ing) => {
                  const isMissing =
                    ing.unavailable ||
                    (Number(ing.minQuantity ?? 0) > 0 &&
                      Number(ing.quantity ?? 0) <= 0);

                  return (
                    <tr
                      key={ing.key}
                      className={isMissing ? "is-missing" : ""}
                    >
                      <td>{ing.name}</td>
                      <td>
                        <input
                          type="number"
                          className="stock-input"
                          value={
                            ing.quantity === "" ? "" : ing.quantity ?? ""
                          }
                          onChange={(e) =>
                            handleIngredientFieldChange(
                              ing.key,
                              "quantity",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="stock-input"
                          value={
                            ing.minQuantity === ""
                              ? ""
                              : ing.minQuantity ?? ""
                          }
                          onChange={(e) =>
                            handleIngredientFieldChange(
                              ing.key,
                              "minQuantity",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant={isMissing ? "secondary" : "ghost"}
                          onClick={() =>
                            handleToggleIngredientUnavailable(ing.key)
                          }
                        >
                          {isMissing ? "Em falta" : "Disponível"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="stock-hint">
          Ingredientes marcados como <strong>“Em falta”</strong> pausam
          automaticamente todas as pizzas que os utilizam. Quando normalizar o
          estoque, marque como <strong>“Disponível”</strong> e as pizzas serão
          reativadas.
        </p>
      </div>
    );
  };

  const renderProductsTab = () => {
    return (
      <div className="stock-section">
        <div className="stock-toolbar">
          <SearchInput
            placeholder="Buscar produto por nome, categoria ou tipo..."
            value={searchProduct}
            onChange={setSearchProduct}
          />

          <div className="stock-filters">
            <label className="stock-filter-label">Tipo:</label>
            <select
              className="stock-select"
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="pizza">Pizzas</option>
              <option value="drink">Bebidas</option>
              <option value="extra">Extras</option>
            </select>
          </div>
        </div>

        <div className="stock-table-wrapper">
          {filteredProducts.length === 0 ? (
            <p className="stock-empty">
              Nenhum produto encontrado no catálogo.
            </p>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Ação de estoque</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, index) => {
                  const type = (p.type || "").toLowerCase();
                  const name = p.name || p.nome || "Sem nome";
                  const category = p.categoria || p.category || "";

                  const ingredientes = Array.isArray(p.ingredientes)
                    ? p.ingredientes
                    : [];

                  const hasMissingIngredient =
                    type === "pizza" &&
                    ingredientes.some((ing) =>
                      unavailableIngredientsSet.has(normalizeKey(ing))
                    );

                  const isActive =
                    p.active !== false && p.isAvailable !== false;

                  const isOutOfStock =
                    hasMissingIngredient || p._manualOutOfStock === true;

                  let statusLabel = "";
                  if (isOutOfStock && hasMissingIngredient) {
                    statusLabel = "Pausado (ingrediente em falta)";
                  } else if (isOutOfStock && p._manualOutOfStock) {
                    statusLabel = "Pausado (sem estoque)";
                  } else if (isActive) {
                    statusLabel = "Ativo";
                  } else {
                    statusLabel = "Pausado";
                  }

                  const typeLabel =
                    type === "pizza"
                      ? "Pizza"
                      : type === "drink" || type === "bebida"
                      ? "Bebida"
                      : type === "extra" || type === "adicional"
                      ? "Extra"
                      : type || "Outro";

                  return (
                    <tr key={`${name}-${index}`}>
                      <td>
                        <div className="stock-product-main">
                          <div className="stock-product-name">
                            {name}
                          </div>
                          {category && (
                            <div className="stock-product-meta">
                              {category}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{typeLabel}</td>
                      <td>
                        <span
                          className={
                            isOutOfStock
                              ? "stock-status paused"
                              : isActive
                              ? "stock-status active"
                              : "stock-status"
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant={p._manualOutOfStock ? "secondary" : "ghost"}
                          onClick={() =>
                            handleToggleProductOutOfStock(index)
                          }
                        >
                          {p._manualOutOfStock
                            ? "Reativar manual"
                            : "Marcar sem estoque"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="stock-hint">
          Use esta aba para marcar <strong>bebidas, extras ou produtos
          específicos</strong> como sem estoque, mesmo que não dependam de um
          ingrediente. Esses itens pausados também deixarão de aparecer no
          cardápio interno.
        </p>
      </div>
    );
  };

  // -----------------------------
  // RENDER ROOT
  // -----------------------------
  return (
    <Page
      title="Estoque & Disponibilidade"
      subtitle="Controle de ingredientes e pausa automática dos itens do catálogo."
      actions={
        <div className="stock-header-actions">
          <Button variant="ghost" onClick={loadAll} disabled={loading}>
            Recarregar dados
          </Button>
        </div>
      }
    >
      <div className="stock-page">
        {error && <div className="stock-error">{error}</div>}

        {/* Resumo rápido do estoque */}
        <div className="stock-summary-grid">
          <div className="stock-summary-card">
            <div className="stock-summary-label">Ingredientes mapeados</div>
            <div className="stock-summary-value">
              {stockSummary.totalIngredients}
            </div>
          </div>
          <div className="stock-summary-card">
            <div className="stock-summary-label">Ingredientes em falta</div>
            <div className="stock-summary-value highlight">
              {stockSummary.missingIngredients}
            </div>
          </div>
          <div className="stock-summary-card">
            <div className="stock-summary-label">Produtos no catálogo</div>
            <div className="stock-summary-value">
              {stockSummary.totalProducts}
            </div>
          </div>
          <div className="stock-summary-card">
            <div className="stock-summary-label">
              Pizzas pausadas (ingrediente)
            </div>
            <div className="stock-summary-value">
              {stockSummary.autoPausedProducts}
            </div>
          </div>
          <div className="stock-summary-card">
            <div className="stock-summary-label">
              Produtos pausados (manual)
            </div>
            <div className="stock-summary-value">
              {stockSummary.manualPausedProducts}
            </div>
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "ingredients", label: "Ingredientes" },
            { value: "products", label: "Produtos" },
          ]}
        />

        {tab === "ingredients" ? renderIngredientsTab() : renderProductsTab()}
      </div>
    </Page>
  );
};

export default StockPage;
