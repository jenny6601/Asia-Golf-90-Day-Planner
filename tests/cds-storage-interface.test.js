import test from "node:test";
import assert from "node:assert/strict";
import { createCdsStorage, CDS_STORAGE_PORT } from "../assets/js/cds-storage-interface.js";

const batch = {
  batchId: "pilot-20160101-v1", retrievedAt: "2026-11-26T11:00:00Z",
  dataset: "seasonal-original-single-levels", model: "ECMWF-SEAS5.1",
  modelVersion: "System 51", requestScope: { initialization: "2016-01-01" },
  rawSha256: "test-sha"
};
const sample = {
  dataset: "seasonal-original-single-levels", countryCode: "JP",
  initializationTime: "2016-01-01T00:00:00Z", validTime: "2016-01-18T00:00:00Z",
  leadHours: 408, ensembleMember: 0, variable: "2t", value: 12.5,
  unit: "degC", temporalSemantics: "instantaneous"
};

function createFakeAdapter() {
  const objects = new Map();
  return {
    objects,
    async putImmutable(key, value) {
      if (objects.has(key)) return { created: false, reason: "already-exists" };
      objects.set(key, value);
      return { created: true };
    },
    async get(key) { return objects.has(key) ? objects.get(key) : null; },
    async list(prefix) { return [...objects.keys()].filter(key => key.startsWith(prefix)); }
  };
}

test("storage port documents conditional create and isolated namespace", () => {
  assert.deepEqual(CDS_STORAGE_PORT.methods, ["putImmutable", "get", "list"]);
  assert.equal(CDS_STORAGE_PORT.writeSemantics, "conditional-create-only");
  assert.equal(CDS_STORAGE_PORT.productionForecastImpact, false);
});

test("storage requires an explicit backend adapter", () => {
  assert.throws(() => createCdsStorage(null), /missing methods/);
  assert.throws(() => createCdsStorage({ get() {}, list() {} }), /putImmutable/);
});

test("batch is saved as one immutable envelope and can be read back", async () => {
  const storage = createCdsStorage(createFakeAdapter());
  const saved = await storage.saveBatch({ batch, records: [sample] });
  assert.equal(saved.status, "saved");
  assert.equal(saved.recordCount, 1);
  const loaded = await storage.getBatch(batch.batchId);
  assert.equal(loaded.manifest.batchId, batch.batchId);
  assert.equal(loaded.records.length, 1);
  assert.equal((await storage.listBatches()).length, 1);
});

test("repeated batch ID is rejected and cannot overwrite original data", async () => {
  const adapter = createFakeAdapter();
  const storage = createCdsStorage(adapter);
  await storage.saveBatch({ batch, records: [sample] });
  const original = await storage.getBatch(batch.batchId);
  const repeated = await storage.saveBatch({ batch: { ...batch, retrievedAt: "2026-11-27T00:00:00Z" }, records: [{ ...sample, value: 99 }] });
  assert.equal(repeated.status, "rejected");
  assert.equal(repeated.reason, "batch-already-exists");
  assert.deepEqual(await storage.getBatch(batch.batchId), original);
});

test("invalid batch is rejected before calling backend", async () => {
  let writes = 0;
  const adapter = createFakeAdapter();
  const storage = createCdsStorage({
    ...adapter,
    async putImmutable(...args) { writes++; return adapter.putImmutable(...args); }
  });
  const result = await storage.saveBatch({ batch, records: [{ value: 1 }] });
  assert.equal(result.status, "rejected");
  assert.equal(writes, 0);
});

test("read detects a malformed stored envelope", async () => {
  const adapter = createFakeAdapter();
  adapter.objects.set("cds/hindcast/batches/broken.json", JSON.stringify({ manifest: {}, records: "not-array" }));
  const storage = createCdsStorage(adapter);
  await assert.rejects(() => storage.getBatch("broken"), /integrity checks/);
});
