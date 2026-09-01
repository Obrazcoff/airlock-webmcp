# Devpost project story

**Paste everything below the line** into Edit project → Story (skip this header).

---

## Inspiration

Analysts sit on payroll files, patient extracts, and transaction logs they **cannot paste into ChatGPT**. The barrier is policy, not preference. Until WebMCP, the browser had _no way_ to offer AI help without an upload.

## What it does

**[Airlock](https://airlock-webmcp.vercel.app)** is a local-first analytics workspace. Your file loads into DuckDB in the tab and **never leaves the device**. An AI agent works through **14 WebMCP tools** — profiling, guarded SQL, charts, findings — and returns aggregates, not rows.

When individual values are truly needed, the agent must ask in writing. You see the SQL, the preview, and the cell count before you approve. A header counter tracks **every value that crossed the boundary**.

One click runs a full gender pay-gap demo:

- Headline gap **~20%**
- Within-grade gap **~7%**
- Cells released: **0**

Try it: [live demo](https://airlock-webmcp.vercel.app) · [source on GitHub](https://github.com/Obrazcoff/airlock-webmcp)

## Why WebMCP is the only way to build this

A remote MCP server cannot read a file that never left the browser. Uploading defeats the purpose. Screen-reading agents see every rendered row — _the boundary is gone on contact_.

WebMCP runs the code that touches the data and the code that filters what the model receives **in the same page**. `execute` is the choke point:

```javascript
// Tier 3 gone → tool unregistered, not just refused
controller.abort();
// request_raw_rows disappears from getTools()
```

When raw requests are disabled, we abort the tier's `AbortController` and `request_raw_rows` vanishes from the agent's tool list — it cannot call a tool it cannot see.

## How we built it

- **Next.js 16** static export — no backend, no API routes
- **DuckDB-Wasm** for in-tab SQL
- **14 tools** in one Zod-backed registry via `document.modelContext.registerTool()`
- Tiers map to **AbortController lifetimes**: page open → dataset loaded → raw requests permitted

Every handler returns an envelope — never throws:

```json
{ "ok": true, "summary": "...", "data": { ... } }
{ "ok": false, "error": "too_many_rows", "hint": "Use aggregates or request_raw_rows" }
```

Privacy pipeline: SQL guard → aggregate-only `run_query` → column redaction → k-anonymity → human gate on raw release.

## Privacy model, honestly

**We claim:** no server, no upload, provable cell count, explicit release approval.

**We do not claim:** protection against a patient adversary reconstructing rows from many narrow aggregates. That limit is stated openly in the app.

## Challenges we ran into

- DuckDB-Wasm inside a static export (no `Worker` at build time)
- React Strict Mode double-registering WebMCP tools
- Observable Plot tooltips on a dark theme
- Making **capability withdrawal visible** in the UI — red dot, strikethrough — not just in code

## Accomplishments that we're proud of

- A complete pay-gap review with the counter at **0**
- **Permission as tool lifetime**, not tool logic
- One registry serving WebMCP agents, the in-page demo, and manual inspection
- Judges can verify in DevTools → Network: _no request carries your data_

## What we learned

Tool descriptions are part of the product — agents read failures and hints. The airlock meter turns an abstract privacy promise into something a judge can glance at. **Presentation beats feature lists** in a hackathon.

## What's next for Airlock

OPFS session persistence, org-side audit export, AST-tightened SQL guard, query-budget accounting against aggregate reconstruction.
