const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bb-pedidos-vitals-"));
}

async function getFetch() {
  if (typeof fetch === "function") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

function logStep(label, details = null) {
  if (details) {
    console.log(`[vitals] ${label}`, details);
  } else {
    console.log(`[vitals] ${label}`);
  }
}

function buildSettings(overrides = {}) {
  return {
    id: "default",
    pizzaria: "LOCAL PDV",
    versao: "0.1.0",
    tema: "light",
    delivery: {
      blockedNeighborhoods: [],
      minOrderValue: 0,
      maxDistanceKm: 0,
      etaMinutesDefault: 45,
      ranges: [
        { id: "r0", label: "ate 1 km", minKm: 0, maxKm: 1, price: 5 },
        { id: "r1", label: "1.1 a 5 km", minKm: 1.1, maxKm: 5, price: 9 },
      ],
      ...overrides.delivery,
    },
    businessHours: {
      enabled: false,
      openTime: "10:00",
      closeTime: "23:00",
      closedWeekdays: [],
      ...overrides.businessHours,
    },
    printing: {
      kitchenPrinterName: "",
      counterPrinterName: "",
      silentMode: true,
      autoPrintWebsiteOrders: false,
    },
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
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
  logStep("server started", { baseUrl, dataDir });

  async function postJson(pathname, payload, method = "POST") {
    const response = await fetchFn(`${baseUrl}${pathname}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json().catch(() => ({}));
    logStep(`http ${method} ${pathname}`, {
      status: response.status,
      ok: response.ok,
    });
    return { response, body };
  }

  try {
    logStep("seed settings");
    const settings = buildSettings({
      delivery: { blockedNeighborhoods: ["Santana"], minOrderValue: 60 },
    });
    await db.setCollection("settings", { items: [settings] });

    const settingsRaw = await db.getCollection("settings");
    assert.strictEqual(settingsRaw.items[0].pizzaria, "LOCAL PDV");

    logStep("update settings");
    const updatedSettings = await db.updateItem("settings", "default", {
      pizzaria: "LOCAL PDV 2",
      updatedAt: new Date().toISOString(),
    });
    assert.strictEqual(updatedSettings.pizzaria, "LOCAL PDV 2");

    const pdvSettings = await fetchFn(`${baseUrl}/api/pdv/settings`, {
      method: "GET",
    });
    const pdvPayload = await pdvSettings.json().catch(() => ({}));
    assert.strictEqual(pdvSettings.status, 200);
    assert.ok(pdvPayload);
    logStep("pdv settings ok");

    logStep("pdv summary");
    const summaryRes = await fetchFn(`${baseUrl}/api/pdv/summary`, {
      method: "GET",
    });
    const summaryBody = await summaryRes.json().catch(() => ({}));
    assert.strictEqual(summaryRes.status, 200);
    assert.strictEqual(summaryBody.success, true);

    logStep("pdv features");
    const featuresRes = await fetchFn(`${baseUrl}/api/pdv/features`, {
      method: "GET",
    });
    const featuresBody = await featuresRes.json().catch(() => ({}));
    assert.strictEqual(featuresRes.status, 200);
    assert.strictEqual(featuresBody.success, true);

    logStep("pdv business hours");
    const hoursRes = await fetchFn(`${baseUrl}/api/pdv/business-hours`, {
      method: "GET",
    });
    const hoursBody = await hoursRes.json().catch(() => ({}));
    assert.strictEqual(hoursRes.status, 200);
    assert.strictEqual(hoursBody.success, true);

    logStep("delivery quote violations");
    const quoteRes = await fetchFn(
      `${baseUrl}/api/pdv/delivery/quote?distanceKm=3&subtotal=50&neighborhood=Santana`,
      { method: "GET" }
    );
    const quoteBody = await quoteRes.json().catch(() => ({}));
    assert.strictEqual(quoteRes.status, 200);
    assert.ok(Array.isArray(quoteBody.validation?.violations));
    assert.ok(quoteBody.validation.violations.includes("NeighborhoodBlocked"));

    logStep("delivery blocked neighborhoods");
    const blockedRes = await fetchFn(
      `${baseUrl}/api/pdv/delivery/blocked-neighborhoods`,
      { method: "GET" }
    );
    const blockedBody = await blockedRes.json().catch(() => ({}));
    assert.strictEqual(blockedRes.status, 200);
    assert.ok(Array.isArray(blockedBody.items));

    logStep("printing config");
    const printRes = await fetchFn(`${baseUrl}/api/pdv/printing/config`, {
      method: "GET",
    });
    const printBody = await printRes.json().catch(() => ({}));
    assert.strictEqual(printRes.status, 200);
    assert.ok(printBody);

    logStep("create customer");
    const customerPayload = {
      name: "Cliente Teste",
      phone: "11999999999",
      address: {
        cep: "00000000",
        street: "Rua Teste",
        number: "100",
        neighborhood: "Centro",
        city: "Sao Paulo",
        state: "SP",
      },
    };
    const { response: custRes, body: custBody } = await postJson(
      "/api/customers",
      customerPayload
    );
    assert.strictEqual(custRes.status, 201);
    assert.ok(custBody && custBody.customer && custBody.customer.id);

    logStep("customer by phone");
    const byPhoneRes = await fetchFn(
      `${baseUrl}/api/customers/by-phone?phone=11999999999`,
      { method: "GET" }
    );
    const byPhoneBody = await byPhoneRes.json().catch(() => ({}));
    assert.strictEqual(byPhoneRes.status, 200);
    assert.ok(byPhoneBody && byPhoneBody.id);

    logStep("customer segments");
    const segmentsRes = await fetchFn(
      `${baseUrl}/api/pdv/customers/segments`,
      { method: "GET" }
    );
    const segmentsBody = await segmentsRes.json().catch(() => ({}));
    assert.strictEqual(segmentsRes.status, 200);
    assert.ok(segmentsBody && typeof segmentsBody.total === "number");

    logStep("create order");
    const { response: createRes, body: createBody } = await postJson(
      "/api/orders",
      buildOrder({
        customerId: custBody.customer.id,
        subtotal: 80,
        customerAddress: { neighborhood: "Centro" },
        items: [{ quantity: 1, unitPrice: 80, total: 80 }],
      })
    );
    assert.strictEqual(createRes.status, 201);
    assert.ok(createBody && createBody.id);

    const createdId = createBody.id;
    const ordersAfterCreate = await db.getCollection("orders");
    const created = ordersAfterCreate.items.find(
      (item) => String(item.id) === String(createdId)
    );
    assert.ok(created);

    logStep("update order");
    const { response: updateRes, body: updateBody } = await postJson(
      `/api/orders/${createdId}`,
      { status: "preparing" },
      "PUT"
    );
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateBody.status, "preparing");

    const ordersAfterUpdate = await db.getCollection("orders");
    const updated = ordersAfterUpdate.items.find(
      (item) => String(item.id) === String(createdId)
    );
    assert.strictEqual(updated.status, "preparing");

    logStep("list orders");
    const listRes = await fetchFn(`${baseUrl}/api/orders`, { method: "GET" });
    const listBody = await listRes.json().catch(() => ({}));
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listBody.items));

    logStep("orders metrics");
    const today = new Date().toISOString().slice(0, 10);
    const metricsRes = await fetchFn(
      `${baseUrl}/api/pdv/orders/metrics?from=${today}&to=${today}`,
      { method: "GET" }
    );
    const metricsBody = await metricsRes.json().catch(() => ({}));
    assert.strictEqual(metricsRes.status, 200);
    assert.ok(metricsBody && metricsBody.success === true);

    logStep("delete order");
    const delRes = await fetchFn(
      `${baseUrl}/api/orders/${createdId}`,
      { method: "DELETE" }
    );
    const delBody = await delRes.json().catch(() => ({}));
    assert.strictEqual(delRes.status, 200);
    assert.ok(delBody && delBody.id);

    logStep("reset orders");
    const resetRes = await postJson("/api/orders/reset", null, "POST");
    assert.strictEqual(resetRes.response.status, 200);

    logStep("pdv health");
    const healthRes = await fetchFn(`${baseUrl}/api/pdv/health`, {
      method: "GET",
    });
    const healthBody = await healthRes.json().catch(() => ({}));
    assert.strictEqual(healthRes.status, 200);
    assert.ok(healthBody && healthBody.success === true);
  } finally {
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log("Vitals flow tests: OK");
  })
  .catch((err) => {
    console.error("Vitals flow tests: FAIL");
    console.error(err);
    process.exitCode = 1;
  });
