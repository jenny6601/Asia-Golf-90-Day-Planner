# CDS storage adapter interface

## Purpose

Provide one stable persistence interface for CDS archives while deferring the choice of physical storage. The interface is isolated from the live forecast engine and requires an explicitly injected backend adapter.

## Adapter contract

A backend must implement:

- `putImmutable(key, value, metadata)`: atomic conditional-create operation. It must never overwrite an existing key and must return `{ created: true }` only after durable creation. Existing keys return `{ created: false, reason: "already-exists" }`.
- `get(key)`: return the stored value or null.
- `list(prefix)`: return object keys under the namespace.

A batch manifest and all normalized records are stored as one immutable envelope, preventing partial writes where metadata exists but records do not.

## Namespace and format

- Namespace: `cds/hindcast/batches/`
- Key: one URL-encoded batch ID per JSON object.
- Envelope includes envelope version, manifest and normalized records.
- Repeated batch IDs are rejected; corrections require a new batch ID/version.
- Invalid batches are rejected before the backend is called.

## Current status

- `assets/js/cds-storage-interface.js` implements the backend-neutral port.
- Automated tests use an in-memory fake adapter only. This validates the contract; it is not persistent storage.
- No Cloudflare R2, Supabase, or other storage credentials, buckets, tables or production bindings are configured by this change.
- No production forecast code imports this module.

## Future backend selection

A later implementation may map this port to Cloudflare R2, Supabase Storage/Postgres or another durable service. Selection should follow retention, cost, backup, access-control and query requirements. Backend connection is a separate deployment decision and must not be required by the forecast runtime.
