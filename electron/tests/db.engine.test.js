const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bb-pedidos-db-test-"));
}

async function run() {
  const dataDir = createTempDir();
  process.env.DATA_DIR = dataDir;

  const db = require("../db");

  try {
    await db.setCollection("customers", { items: [] });

    const created = await db.addItem("customers", { name: "Ana" });
    assert.ok(created.id);
    assert.ok(created.createdAt);
    assert.ok(created.updatedAt);

    let collection = await db.getCollection("customers");
    assert.strictEqual(collection.items.length, 1);
    assert.strictEqual(collection.items[0].id, created.id);

    const updated = await db.updateItem("customers", created.id, {
      name: "Ana B",
    });
    assert.strictEqual(updated.name, "Ana B");
    assert.ok(updated.updatedAt);
    assert.strictEqual(updated.createdAt, created.createdAt);

    const removed = await db.removeItem("customers", created.id);
    assert.strictEqual(removed.id, created.id);

    collection = await db.getCollection("customers");
    assert.strictEqual(collection.items.length, 0);
    assert.ok(Array.isArray(collection.meta.deleted));
    assert.ok(collection.meta.deleted.find((entry) => entry.id === created.id));

    const reset = await db.resetCollection("customers");
    assert.ok(Array.isArray(reset.items));
    assert.strictEqual(reset.items.length, 0);

    assert.ok(db.listCollections().includes("orders"));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log("DB engine tests: OK");
  })
  .catch((err) => {
    console.error("DB engine tests: FAIL");
    console.error(err);
    process.exitCode = 1;
  });
