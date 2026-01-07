const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bb-pedidos-sync-test-"));
}

async function run() {
  const dataDir = createTempDir();
  process.env.DATA_DIR = dataDir;
  process.env.SYNC_BASE_URL = "http://sync.local.test";
  process.env.SYNC_TOKEN = "token-test";

  Object.defineProperty(process.versions, "electron", { value: "test" });

  global.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: "Server Error",
  });

  const db = require("../db");

  try {
    await db.setCollection("orders", { items: [] });
    await db.addItem("orders", { name: "Order 1" });

    const queuePath = path.join(dataDir, "sync-queue.json");
    const queueRaw = JSON.parse(fs.readFileSync(queuePath, "utf8"));
    assert.ok(queueRaw.length > 0);

    const result = await db.flushSyncQueue();
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "push_failed");
    assert.ok(result.remaining >= 1);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log("Sync queue tests: OK");
  })
  .catch((err) => {
    console.error("Sync queue tests: FAIL");
    console.error(err);
    process.exitCode = 1;
  });
