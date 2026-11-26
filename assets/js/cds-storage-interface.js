/**
 * Backend-neutral CDS persistence port.
 *
 * The caller injects an adapter implementing conditional immutable writes.
 * No concrete cloud/database adapter is bundled or selected here. This module
 * is not imported by the live forecast runtime.
 */
import { buildCdsArchiveBatch } from "./cds-archive-store.js";

const REQUIRED_ADAPTER_METHODS = ["putImmutable", "get", "list"];

function assertAdapter(adapter) {
  const missing = REQUIRED_ADAPTER_METHODS.filter(name => typeof adapter?.[name] !== "function");
  if (missing.length) {
    throw new TypeError(`CDS storage adapter missing methods: ${missing.join(", ")}`);
  }
}

function batchObjectKey(batchId) {
  return `cds/hindcast/batches/${encodeURIComponent(String(batchId))}.json`;
}

export function createCdsStorage(adapter) {
  assertAdapter(adapter);

  return Object.freeze({
    async saveBatch(input) {
      const staged = buildCdsArchiveBatch(input);
      if (staged.status !== "staged-append-only") return staged;

      const key = batchObjectKey(staged.manifest.batchId);
      const envelope = {
        envelopeVersion: "1.0.0",
        manifest: staged.manifest,
        records: staged.records
      };
      const payload = JSON.stringify(envelope);
      const result = await adapter.putImmutable(key, payload, {
        contentType: "application/json",
        batchId: staged.manifest.batchId,
        sha256: input.batch.rawSha256 ?? null
      });

      if (result?.created !== true) {
        return {
          status: "rejected",
          reason: result?.reason === "already-exists" ? "batch-already-exists" : "immutable-write-not-confirmed",
          batchId: staged.manifest.batchId
        };
      }
      return { status: "saved", key, batchId: staged.manifest.batchId, recordCount: staged.records.length };
    },

    async getBatch(batchId) {
      const key = batchObjectKey(batchId);
      const value = await adapter.get(key);
      if (value === null || value === undefined) return null;
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (parsed?.manifest?.batchId !== String(batchId) || !Array.isArray(parsed?.records)) {
        throw new Error("Stored CDS batch failed envelope integrity checks");
      }
      return parsed;
    },

    async listBatches() {
      const keys = await adapter.list("cds/hindcast/batches/");
      return Array.isArray(keys) ? keys.filter(key => typeof key === "string") : [];
    }
  });
}

export const CDS_STORAGE_PORT = Object.freeze({
  methods: REQUIRED_ADAPTER_METHODS,
  writeSemantics: "conditional-create-only",
  batchAtomicity: "single-immutable-envelope",
  namespace: "cds/hindcast/batches/",
  productionForecastImpact: false
});
