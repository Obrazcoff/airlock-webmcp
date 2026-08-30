# ADR-0004 — Self-hosted `eh` bundle, no cross-origin isolation

**Status:** accepted · 2026-08-30

## Context

DuckDB-Wasm ships three flavours. `mvp` is the baseline, `eh` adds Wasm exception
handling, and `coi` adds threading for parallel query execution. The `coi` bundle needs
`SharedArrayBuffer`, which needs the page to be cross-origin isolated, which needs
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

Separately, `getJsDelivrBundles()` points at a CDN, and browsers refuse to construct a
`Worker` from a cross-origin URL. The usual workaround is wrapping the CDN script in a
same-origin Blob that calls `importScripts`.

## Decision

Ship the single-threaded `eh` bundle, self-hosted from `/duckdb/`. No COOP/COEP headers,
no Blob-URL shim, no `coi` entry passed to `selectBundle`.

## Rationale

Cross-origin isolation is not free. `require-corp` breaks every cross-origin subresource
that does not send `Cross-Origin-Resource-Policy`, which turns into an afternoon of
debugging fonts and images. It also constrains where the app can be hosted, since the
headers must be configurable — and ADR-0002 deliberately keeps the artifact host-agnostic.

There is a known DuckDB-Wasm bug on the threaded bundle where registering an OPFS file
handle throws `DataCloneError` once pthread workers are warm, because
`FileSystemSyncAccessHandle` is not structured-cloneable. It fails intermittently
depending on whether a query has run yet. That is exactly the kind of flaky failure that
ruins a demo recording.

Self-hosting is the cleaner half of the decision regardless of threading: it sidesteps the
cross-origin Worker restriction entirely, so the Blob shim disappears, and it removes a
CDN from the critical path of a product whose pitch is that nothing leaves the machine. A
reviewer watching the network tab should see requests to our origin and nowhere else.

The demo dataset is thousands of rows, not billions. Single-threaded is not the bottleneck.

## Consequences

- `scripts/vendor-duckdb.mjs` copies the bundles out of `node_modules` into `public/duckdb`
  and runs as a `prebuild` hook. Forgetting it produces 404s only in production.
- The artifacts are gitignored; the script is the source of truth.
- Enabling threading later is a headers change plus a `coi` entry in `selectBundle`, and
  `selectBundle` already falls back correctly, so nothing is closed off.
