# ADR-0006 — Observable Plot for agent-authored charts

**Status:** accepted · 2026-08-30

## Context

`add_chart` lets the agent put a chart into the notebook. The agent emits a chart
description; something has to render it. Candidates: Vega-Lite via `vega-embed`,
Observable Plot, Recharts, or Chart.js.

## Decision

`@observablehq/plot`, driven by a narrow Airlock chart spec rather than by a raw library
spec.

## Rationale

- Plot's grammar is declarative and close to what a model naturally produces: a mark, an
  x, a y, an optional colour and facet. Recharts and Chart.js are component and options
  APIs, which means writing a translation layer anyway.
- Vega-Lite is the closest match conceptually but is a heavy dependency, and its full
  schema is far larger than anything we want to expose in an `inputSchema`.
- Plot consumes Arrow tables, which is what DuckDB-Wasm already returns. No conversion.

The agent does **not** emit a Plot spec directly. `add_chart` takes a constrained shape —
`{ mark, x, y, color?, facet?, sql, title, caption? }` — which we translate. Two reasons:
the input schema stays small enough for a model to fill correctly on the first attempt,
which eval 6 measures; and the human editing that chart in the UI edits the same fields
the agent sets, so both parties manipulate one object rather than the human being handed
a generated blob.

## Consequences

- Chart types are limited to what the spec covers. That is a feature at this scope.
- Plot renders to SVG, so `export_report` in HTML mode can inline charts with no
  screenshotting.
- If Plot's bundle turns out to be a problem, Recharts behind the same spec is a
  contained swap — the spec is the interface, not the library.
