const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bb-pedidos-api-test-"));
}

async function getFetch() {
  if (typeof fetch === "function") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

function buildSettings(overrides = {}) {
  return {
    id: "default",
    delivery: {
      blockedNeighborhoods: [],
      minOrderValue: 0,
      maxDistanceKm: 0,
      ...overrides.delivery,
    },
    businessHours: {
      enabled: false,
      openTime: "10:00",
      closeTime: "23:00",
      closedWeekdays: [],
      ...overrides.businessHours,
    },
  };
}

function buildOrder(overrides = {}) {
  return {
    orderType: "delivery",
    customerAddress: {
      neighborhood: "Santana",
    },
    items: [{ quantity: 1, unitPrice: 50, total: 50 }],
    subtotal: 50,
    deliveryDistanceKm: 3,
    ...overrides,
  };
}

async function run() {
  const dataDir = createTempDir();
  process.env.DATA_DIR = dataDir;
  process.env.PUBLIC_API_TOKEN = "";

  const app = require("../apiServer");
  const db = require("../db");
  const fetchFn = await getFetch();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function setSettings(overrides) {
    const settings = buildSettings(overrides);
    await db.setCollection("settings", { items: [settings] });
  }

  async function postOrder(order) {
    const response = await fetchFn(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  }

  try {
    await setSettings({
      businessHours: { enabled: true, closedWeekdays: [new Date().getDay()] },
    });
    let { response, payload } = await postOrder(buildOrder());
    assert.strictEqual(response.status, 422);
    assert.strictEqual(payload.error, "BusinessHoursClosed");

    await setSettings({ delivery: { minOrderValue: 100 } });
    ({ response, payload } = await postOrder(buildOrder({ subtotal: 50 })));
    assert.strictEqual(response.status, 422);
    assert.strictEqual(payload.error, "MinOrderValue");

    await setSettings({ delivery: { maxDistanceKm: 5 } });
    ({ response, payload } = await postOrder(buildOrder({ deliveryDistanceKm: 6 })));
    assert.strictEqual(response.status, 422);
    assert.strictEqual(payload.error, "MaxDistanceExceeded");

    await setSettings({
      delivery: { blockedNeighborhoods: ["Santana"] },
    });
    ({ response, payload } = await postOrder(buildOrder()));
    assert.strictEqual(response.status, 422);
    assert.strictEqual(payload.error, "NeighborhoodBlocked");

    await setSettings({
      delivery: { minOrderValue: 20, maxDistanceKm: 10 },
    });
    ({ response } = await postOrder(buildOrder({ subtotal: 80 })));
    assert.strictEqual(response.status, 201);
  } finally {
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log("API validation tests: OK");
  })
  .catch((err) => {
    console.error("API validation tests: FAIL");
    console.error(err);
    process.exitCode = 1;
  });
