import { normalizeProductsCollections } from "../renderer/utils/normalizeProductsCollections.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
    return true;
  } catch (err) {
    console.error(`fail - ${name}`);
    console.error(err.message);
    return false;
  }
}

const results = [];

results.push(
  test("returns empty groups when raw is null", () => {
    const result = normalizeProductsCollections(null);
    assert(Array.isArray(result.pizzas), "pizzas should be array");
    assert(Array.isArray(result.drinks), "drinks should be array");
    assert(Array.isArray(result.extras), "extras should be array");
    assert(result.pizzas.length === 0, "pizzas should be empty");
    assert(result.drinks.length === 0, "drinks should be empty");
    assert(result.extras.length === 0, "extras should be empty");
  })
);

results.push(
  test("normalizes arrays and classifies by category", () => {
    const raw = {
      items: [
        { id: "p1", nome: "Pizza 1", preco_broto: 25, categoria: "Pizzas" },
        { id: "d1", nome: "Coca", priceGrande: 8, categoria: "Bebida" },
        { id: "e1", nome: "Borda", priceBroto: 5, categoria: "Extra" },
      ],
    };

    const result = normalizeProductsCollections(raw);
    assert(result.pizzas.length === 1, "should keep one pizza");
    assert(result.drinks.length === 1, "should keep one drink");
    assert(result.extras.length === 1, "should keep one extra");
    assert(result.pizzas[0].name === "Pizza 1", "pizza name normalized");
    assert(result.drinks[0].type === "drink", "drink type normalized");
    assert(result.extras[0].prices.broto === 5, "extra price normalized");
  })
);

results.push(
  test("supports fallback price fields", () => {
    const raw = [
      { id: "p2", name: "Pizza 2", preco_grande: "40.5", categoria: "Pizza" },
      { id: "d2", name: "Suco", preco: "7", categoria: "Suco" },
    ];

    const result = normalizeProductsCollections(raw);
    assert(result.pizzas.length === 1, "pizza should be included");
    assert(result.drinks.length === 1, "drink should be included");
    assert(result.pizzas[0].prices.grande === 40.5, "priceGrande parsed");
    assert(result.drinks[0].prices.grande === 7, "preco fallback parsed");
  })
);

results.push(
  test("respects explicit type override", () => {
    const raw = [
      { id: "x1", name: "Item", type: "drink", priceBroto: 3 },
      { id: "x2", name: "Item 2", type: "extra", priceBroto: 2 },
    ];

    const result = normalizeProductsCollections(raw);
    assert(result.drinks.length === 1, "explicit drink stays drink");
    assert(result.extras.length === 1, "explicit extra stays extra");
  })
);

const passed = results.filter(Boolean).length;
const total = results.length;
console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
