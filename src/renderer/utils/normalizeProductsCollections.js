export function normalizeProductsCollections(raw) {
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

    const priceBroto = p.priceBroto  p.preco_broto  null;
    const priceGrande = p.priceGrande  p.preco_grande  p.preco  null;

    const prices = {
      broto:
        priceBroto != null && !Number.isNaN(Number(priceBroto))
           Number(priceBroto)
          : 0,
      grande:
        priceGrande != null && !Number.isNaN(Number(priceGrande))
           Number(priceGrande)
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
