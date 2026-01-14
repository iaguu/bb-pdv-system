const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bb-pedidos-motoboy-test-"));
}

async function getFetch() {
  if (typeof fetch === "function") return fetch;
  const mod = await import("node-fetch");
  return mod.default;
}

async function run() {
  const dataDir = createTempDir();
  process.env.DATA_DIR = dataDir;
  process.env.PUBLIC_API_TOKEN = "";
  process.env.ANNETOM_TRACKING_BASE_URL = "https://tracking.local/order=";

  const app = require("../apiServer");
  const db = require("../db");
  const fetchFn = await getFetch();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const motoboy = {
      id: "motoboy-1",
      name: "Joao",
      phone: "999999999",
      qrToken: "qr-1",
    };
    const order = {
      id: "order-1",
      status: "open",
      trackingCode: "trk-123",
    };

    await db.setCollection("motoboys", { items: [motoboy] });
    await db.setCollection("orders", { items: [order] });

    let response = await fetchFn(`${baseUrl}/motoboy/pedido/${order.id}`);
    let payload = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(payload.success, true);
    assert.strictEqual(payload.orderId, order.id);
    assert.strictEqual(payload.trackingCode, "trk-123");
    assert.strictEqual(
      payload.trackingUrl,
      "https://tracking.local/order=trk-123"
    );

    response = await fetchFn(
      `${baseUrl}/motoboy/pedido/${order.id}/link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    payload = await response.json();
    assert.strictEqual(response.status, 400);
    assert.strictEqual(payload.success, false);

    response = await fetchFn(
      `${baseUrl}/motoboy/pedido/${order.id}/link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: "invalid" }),
      }
    );
    payload = await response.json();
    assert.strictEqual(response.status, 404);
    assert.strictEqual(payload.success, false);

    response = await fetchFn(
      `${baseUrl}/motoboy/pedido/${order.id}/link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: "qr-1" }),
      }
    );
    payload = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(payload.success, true);
    assert.strictEqual(payload.order.status, "out_for_delivery");
    assert.strictEqual(payload.motoboy.status, "delivering");
    assert.strictEqual(payload.trackingCode, "trk-123");
    assert.strictEqual(
      payload.trackingUrl,
      "https://tracking.local/order=trk-123"
    );

    const ordersData = await db.getCollection("orders");
    const savedOrder = ordersData.items.find((item) => item.id === order.id);
    assert.ok(savedOrder);
    assert.strictEqual(savedOrder.status, "out_for_delivery");
    assert.strictEqual(savedOrder.motoboyId, motoboy.id);

    const motoboysData = await db.getCollection("motoboys");
    const savedMotoboy = motoboysData.items.find(
      (item) => item.id === motoboy.id
    );
    assert.ok(savedMotoboy);
    assert.strictEqual(savedMotoboy.status, "delivering");

    response = await fetchFn(
      `${baseUrl}/motoboy/pedido/${order.id}/link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: "qr-1" }),
      }
    );
    payload = await response.json();
    assert.strictEqual(response.status, 409);
    assert.strictEqual(payload.success, false);

    response = await fetchFn(`${baseUrl}/api/motoboys/${motoboy.id}/status`);
    payload = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(payload.status, "delivering");
  } finally {
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log("Motoboy link tests: OK");
  })
  .catch((err) => {
    console.error("Motoboy link tests: FAIL");
    console.error(err);
    process.exitCode = 1;
  });
