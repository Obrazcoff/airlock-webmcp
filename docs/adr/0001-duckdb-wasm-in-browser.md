# ADR-0001 — DuckDB-Wasm in the browser, no server-side analytics

**Status:** accepted · 2026-08-30

## Context

Airlock's entire claim is that the data never leaves the device. That rules out any
architecture where analysis happens on a server. The remaining question is what runs the
analysis in the browser.

Candidates: DuckDB-Wasm; SQL.js (SQLite compiled to Wasm); Arquero or Danfo.js as
in-memory dataframe libraries; hand-written JavaScript aggregation.

## Decision

DuckDB-Wasm.

## Rationale

- It speaks real SQL, including window functions, `QUALIFY`, `PIVOT` and statistical
  aggregates. The agent already knows SQL; anything else would require it to learn a
  bespoke API from tool descriptions, and every eval would be testing our API design
  rather than the product.
- Columnar and vectorised, so hundreds of megabytes are workable in a tab. SQL.js is
  row-oriented and falls over well before that.
- Native Parquet and CSV readers with type inference, which removes an entire ingest layer.
- `EXPLAIN` gives us `explain_query` almost for free, and the plan is what the aggregate
  guard inspects.

Cost: the wasm bundle is tens of megabytes, so first load is slow. Acceptable — the
product is a workspace people sit in, not a landing page, and the bundle is cached after
the first visit.

## Consequences

- Every module that reaches DuckDB is client-only; SSR must be avoided on that path.
- The instance must be a module-level singleton promise, or Strict Mode spawns two
  workers.
- Bundle selection and worker origin need explicit handling — see ADR-0004.
