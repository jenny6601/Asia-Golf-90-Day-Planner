# CDS archive and storage contract

## Current implementation boundary

The repository has no configured persistent database or object-storage backend for CDS. Therefore this stage establishes a storage-neutral append-only contract and validation layer only. It does **not** claim that data is already durably stored. The existing GitHub Actions artifact is a short-lived diagnostic handoff, not the long-term archive.

## Data layers

1. **Raw layer** — original GRIB file, request payload/scope, retrieval timestamp, file size and SHA-256. Preserve the source bytes unchanged.
2. **Normalized layer** — one record per model member, variable, valid time and spatial extraction, with original and converted units, temporal semantics, course/grid coordinates and distance.
3. **Verification layer** — only paired forecast/verification samples that pass same-valid-time, variable, unit and temporal-resolution checks. ERA5 remains a reanalysis proxy, not station truth.

## Append-only rules

- Every retrieval is a new batch with a unique batchId.
- Never overwrite an earlier batch. A corrected extraction creates a new batch version and references the superseded batch; it does not erase it.
- Store raw-file SHA-256 and request scope so identical downloads can be recognized.
- Deterministic record keys identify duplicates within a batch. Repeated batch IDs are rejected by archive inventory checks.
- Missing values remain missing. Unknown temporal semantics fail the verification quality gate.
- Every normalized record remains qualityStatus=unverified until independently paired and assessed.
- Storage implementation must remain separate from the live forecast runtime.

## Current storage implementation

- `cds-archive-store.js` builds validated append-only batch packages and inventories duplicate batch IDs.
- `cds-hindcast-record.schema.json` defines the normalized record contract.
- No DB or bucket writes are made in this stage. A future object store/database adapter can consume this stable contract when the backend is selected.
- Do not use GitHub Actions artifact retention as the long-term archive.

## Future backend adapter requirements

A later backend should provide immutable raw-object storage, indexed normalized records, batch-level metadata, checksum verification, idempotent ingest, retention/backup policy and read-only access for analysis. Backend selection is intentionally deferred so the current forecast system remains unchanged.
