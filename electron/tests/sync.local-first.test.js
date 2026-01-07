const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bb-pedidos-sync-local-"));
}

function logStep(label, details = null) {
  if (details) {
    console.log(`[sync-local] ${label}`, details);
  } else {
    console.log(`[sync-local] ${label}`);
  }
}

function makeWrapper(items) {
  return { items, meta: { deleted: [] } };
}

async function run() {
  const dataDir = createTempDir();
  process.env.DATA_DIR = dataDir;
  process.env.SYNC_BASE_URL = "http://sync.local.test";
  process.env.SYNC_TOKEN = "token-test";

  try {
    Object.defineProperty(process.versions, "electron", {
      value: "test",
      configurable: true,
    });
  } catch (err) {
    // ignore if property is not configurable
  }

  const now = new Date().toISOString();
  const older = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const newer = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const requests = [];
  const remoteCollections = {
    settings: makeWrapper([
      {
        id: "default",
        pizzaria: "REMOTE PDV",
        createdAt: older,
        updatedAt: older,
      },
    ]),
    orders: {
      ...makeWrapper([
      {
        id: "local-1",
        status: "cancelled",
        createdAt: older,
        updatedAt: older,
        source: "website",
      },
      {
        id: "remote-2",
        status: "open",
        createdAt: newer,
        updatedAt: newer,
        source: "website",
      },
      ]),
      meta: {
        deleted: [
          { id: "local-1", deletedAt: older },
          { id: "local-3", deletedAt: newer },
        ],
      },
    },
  };

  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    requests.push({ url, method, body: options.body || null });
    const match = String(url).match(/\/sync\/collection\/([^/?]+)/);
    const collection = match ? decodeURIComponent(match[1]) : null;

    if (method === "GET") {
      const payload =
        remoteCollections[collection] || makeWrapper([]);
      return {
        ok: true,
        status: 200,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      };
    }

    if (method === "POST") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
        text: async () => JSON.stringify({ success: true }),
      };
    }

    return { ok: false, status: 400, json: async () => ({}) };
  };

  const db = require("../db");
  const sync = require("../sync");

  try {
    logStep("seed local collections", { dataDir });
    await db.setCollection(
      "settings",
      makeWrapper([
        {
          id: "default",
          pizzaria: "LOCAL PDV",
          createdAt: older,
          updatedAt: now,
        },
      ])
    );
    await db.setCollection("orders", {
      items: [
        {
          id: "local-1",
          status: "open",
          createdAt: older,
          updatedAt: now,
          source: "local",
        },
        {
          id: "local-3",
          status: "open",
          createdAt: older,
          updatedAt: older,
          source: "local",
        },
      ],
      meta: { deleted: [] },
    });

    logStep("run sync cycle");
    const result = await sync.runSyncCycle();
    logStep("sync result", result.status);

    const settingsAfter = await db.getCollection("settings");
    const ordersAfter = await db.getCollection("orders");

    const settingsItem = settingsAfter.items[0];
    assert.strictEqual(settingsItem.pizzaria, "LOCAL PDV");

    const localOrder = ordersAfter.items.find((it) => it.id === "local-1");
    const remoteOrder = ordersAfter.items.find((it) => it.id === "remote-2");
    const deletedOrder = ordersAfter.items.find((it) => it.id === "local-3");

    assert.ok(localOrder);
    assert.strictEqual(localOrder.status, "open");
    assert.ok(remoteOrder);
    assert.strictEqual(remoteOrder.status, "open");
    assert.ok(!deletedOrder);

    const postPayloads = requests
      .filter((req) => req.method === "POST")
      .map((req) => {
        try {
          return JSON.parse(req.body || "{}");
        } catch (err) {
          return {};
        }
      });
    assert.ok(postPayloads.length > 0);

    const settingsPush = postPayloads.find(
      (payload) =>
        payload &&
        payload.data &&
        payload.data.items &&
        payload.data.items.find((item) => item.id === "default")
    );
    assert.ok(settingsPush);
    const pushedSettings = settingsPush.data.items.find(
      (item) => item.id === "default"
    );
    assert.strictEqual(pushedSettings.pizzaria, "LOCAL PDV");

    logStep("sync local-first checks ok", {
      requests: requests.length,
      posts: postPayloads.length,
    });
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log("Sync local-first tests: OK");
  })
  .catch((err) => {
    console.error("Sync local-first tests: FAIL");
    console.error(err);
    process.exitCode = 1;
  });
