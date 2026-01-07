const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bb-pedidos-sync-push-"));
}

async function run() {
  const dataDir = createTempDir();
  process.env.DATA_DIR = dataDir;
  process.env.SYNC_BASE_URL = "http://sync.local.test";
  process.env.SYNC_TOKEN = "token-test";

  Object.defineProperty(process.versions, "electron", { value: "test" });

  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
  });

  const db = require("../db");

  try {
    await db.setCollection("orders", { items: [] });
    await db.addItem("orders", { name: "Order Sync OK" });

    const lastPushPath = path.join(dataDir, "sync-last-push.json");
    let payload = null;
    let lastErr = null;
    for (let i = 0; i < 10; i += 1) {
      try {
        const raw = fs.readFileSync(lastPushPath, "utf8");
        if (raw && raw.trim()) {
          payload = JSON.parse(raw);
          break;
        }
      } catch (err) {
        lastErr = err;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!payload) {
      throw lastErr || new Error("sync-last-push.json vazio");
    }
    assert.ok(payload.lastPushAt);
  } finally {
    try {
      fs.rmSync(dataDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
      });
    } catch (err) {
      try {
        const entries = fs.readdirSync(dataDir);
        for (const entry of entries) {
          const entryPath = path.join(dataDir, entry);
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
        fs.rmdirSync(dataDir);
      } catch (_err) {
        // noop: best-effort cleanup on Windows
      }
    }
  }
}

run()
  .then(() => {
    console.log("Sync last push tests: OK");
  })
  .catch((err) => {
    console.error("Sync last push tests: FAIL");
    console.error(err);
    process.exitCode = 1;
  });
