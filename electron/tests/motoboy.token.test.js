const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bb-pedidos-motoboy-token-test-"));
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
      qrToken: "qr-1"
    };
    await db.setCollection("motoboys", { items: [motoboy] });

    // Teste: token válido
    let response = await fetchFn(`${baseUrl}/motoboy/token/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: "qr-1" })
    });
    let payload = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(payload.success, true);
    assert.strictEqual(payload.motoboy.id, motoboy.id);
    assert.strictEqual(payload.motoboy.name, motoboy.name);

    // Teste: token inválido
    response = await fetchFn(`${baseUrl}/motoboy/token/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: "qr-invalido" })
    });
    payload = await response.json();
    assert.strictEqual(response.status, 404);
    assert.strictEqual(payload.success, false);
    assert.strictEqual(payload.motoboy, null);

    // Teste: corpo ausente
    response = await fetchFn(`${baseUrl}/motoboy/token/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    payload = await response.json();
    assert.strictEqual(response.status, 400);
    assert.strictEqual(payload.success, false);
    assert.strictEqual(payload.motoboy, null);
  } finally {
    server.close();
  }
}

if (require.main === module) {
  run().then(() => console.log("motoboy.token.test.js: OK"), err => { console.error(err); process.exit(1); });
}
