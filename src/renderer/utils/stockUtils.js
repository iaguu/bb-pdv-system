export const normalizeProductsData = (data) => {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data)) return data;
  return [];
};

export const normalizeKey = (value) => {
  if (!value) return "";
  return String(value).trim().toLowerCase();
};

export const buildIngredientStockMap = (products, stockItemsRaw) => {
  const normalizedProducts = Array.isArray(products) ? products : [];
  const stockItems = Array.isArray(stockItemsRaw)
    ? stockItemsRaw.filter((item) => item && typeof item === "object")
    : [];

  const ingredientIndexFromProducts = {};
  normalizedProducts.forEach((product) => {
    const type = (product.type || "").toLowerCase();
    if (type !== "pizza") return;

    const ingredientes = Array.isArray(product.ingredientes)
      ? product.ingredientes
      : [];

    ingredientes.forEach((rawName) => {
      const key = normalizeKey(rawName);
      if (!key) return;

      if (!ingredientIndexFromProducts[key]) {
        ingredientIndexFromProducts[key] = {
          key,
          name:
            typeof rawName === "string" && rawName.trim()
              ? rawName
              : key,
        };
      }
    });
  });

  const ingredientStockMap = {};

  Object.values(ingredientIndexFromProducts).forEach((ing) => {
    const existing = stockItems.find(
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

  stockItems.forEach((s) => {
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

  return ingredientStockMap;
};

export const computeProductsWithStock = (baseProducts, ingredientStockMap) => {
  const unavailableKeys = new Set(
    Object.values(ingredientStockMap || {})
      .filter((item) => {
        const q = Number(item.quantity ?? 0);
        const minQ = Number(item.minQuantity ?? 0);
        return item.unavailable || (minQ > 0 && q <= 0);
      })
      .map((item) => item.key)
  );

  return (baseProducts || []).map((product) => {
    const type = (product.type || "").toLowerCase();
    const ingredientes = Array.isArray(product.ingredientes)
      ? product.ingredientes
      : [];

    const hasMissingIngredient =
      type === "pizza" &&
      ingredientes.some((ing) => unavailableKeys.has(normalizeKey(ing)));

    const manualOut = product._manualOutOfStock === true;
    const wasAutoPaused = product._autoPausedByStock === true;

    if (hasMissingIngredient || manualOut) {
      return {
        ...product,
        _autoPausedByStock: hasMissingIngredient,
        active: false,
        isAvailable: false,
      };
    }

    if (wasAutoPaused && !hasMissingIngredient && !manualOut) {
      return {
        ...product,
        _autoPausedByStock: false,
        active: true,
        isAvailable: true,
      };
    }

    return product;
  });
};
