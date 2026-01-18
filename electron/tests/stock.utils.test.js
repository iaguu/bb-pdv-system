const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

async function loadUtils() {
  const utilsPath = path.join(
    __dirname,
    "..",
    "..",
    "src",
    "renderer",
    "utils",
    "stockUtils.js"
  );
  const mod = await import(pathToFileURL(utilsPath));
  return mod;
}

async function run() {
  const {
    normalizeProductsData,
    normalizeKey,
    buildIngredientStockMap,
    computeProductsWithStock,
  } = await loadUtils();

  assert.deepStrictEqual(normalizeProductsData(null), []);
  assert.deepStrictEqual(normalizeProductsData({ items: [1] }), [1]);
  assert.deepStrictEqual(normalizeProductsData({ products: [2] }), [2]);
  assert.deepStrictEqual(normalizeProductsData([3]), [3]);

  assert.strictEqual(normalizeKey(" Cheese "), "cheese");
  assert.strictEqual(normalizeKey(""), "");
  assert.strictEqual(normalizeKey(null), "");

  const products = [
    {
      id: "p1",
      type: "pizza",
      ingredientes: ["Cheese", "Tomato", " Olive "],
    },
    { id: "p2", type: "drink", ingredientes: ["Ignored"] },
  ];
  const stockItemsRaw = [
    { name: "Cheese", quantity: 2, minQuantity: 1, unavailable: false },
    { ingrediente: "Basil", quantity: 0, minQuantity: 1, unavailable: true },
    null,
  ];

  const stockMap = buildIngredientStockMap(products, stockItemsRaw);
  assert.ok(stockMap.cheese);
  assert.ok(stockMap.tomato);
  assert.ok(stockMap.olive);
  assert.ok(stockMap.basil);
  assert.strictEqual(stockMap.cheese.quantity, 2);
  assert.strictEqual(stockMap.basil.unavailable, true);

  const paused = computeProductsWithStock(
    [
      {
        id: "p3",
        type: "pizza",
        ingredientes: ["Cheese"],
      },
    ],
    { cheese: { key: "cheese", quantity: 0, minQuantity: 1 } }
  );
  assert.strictEqual(paused[0].active, false);
  assert.strictEqual(paused[0].isAvailable, false);
  assert.strictEqual(paused[0]._autoPausedByStock, true);

  const manual = computeProductsWithStock(
    [{ id: "p4", type: "drink", _manualOutOfStock: true }],
    {}
  );
  assert.strictEqual(manual[0].active, false);
  assert.strictEqual(manual[0]._autoPausedByStock, false);

  const reactivated = computeProductsWithStock(
    [{ id: "p5", type: "pizza", _autoPausedByStock: true }],
    {}
  );
  assert.strictEqual(reactivated[0].active, true);
  assert.strictEqual(reactivated[0].isAvailable, true);
  assert.strictEqual(reactivated[0]._autoPausedByStock, false);
}

run()
  .then(() => {
    console.log("Stock utils tests: OK");
  })
  .catch((err) => {
    console.error("Stock utils tests: FAIL");
    console.error(err);
    process.exitCode = 1;
  });
