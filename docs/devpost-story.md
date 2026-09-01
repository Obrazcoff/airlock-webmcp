# Devpost project story — paste into Edit project → Story

Replace the internal `08-submission.md` draft if it was pasted by mistake.

---

## Inspiration

Analysts sit on payroll files, patient extracts, and transaction logs they cannot paste into ChatGPT. The barrier is policy, not preference. Until WebMCP, the browser had no way to offer help without an upload.

## What it does

Airlock is a local-first analytics workspace. Data loads into DuckDB in your tab and stays there. An AI agent works through fourteen WebMCP tools — profiling, guarded SQL, charts, findings — and returns aggregates, not rows.

When individual values are truly needed, the agent must ask in writing. You see the SQL, the preview, and the cell count before you approve. A header counter tracks every value that crossed the boundary.

One click runs a full gender pay-gap demo: headline gap ~20%, within-grade gap ~7%, zero cells released.

## Why WebMCP is the only way to build this

A remote MCP server cannot read a file that never left the browser. Uploading defeats the purpose. Screen-reading agents see every rendered row — the boundary is gone on contact.

WebMCP runs the code that touches the data and the code that filters what the model receives in the same page. `execute` is the choke point.

When raw requests are disabled, we abort the tier's AbortController and `request_raw_rows` disappears from `getTools()` — the agent cannot call a tool it cannot see.

## How we built it

Next.js static export — no backend. DuckDB-Wasm for in-tab SQL. Fourteen tools in one Zod-backed registry, registered via `document.modelContext.registerTool()`. Tiers map to AbortController lifetimes: page load, dataset loaded, raw requests permitted.

Every handler returns `{ ok, summary, data }` or `{ ok, error, hint }` — never throws. Privacy pipeline: SQL guard, aggregate-only `run_query`, column redaction, k-anonymity, injection wrapping, human gate on raw release.

## Privacy model, honestly

We claim: no server, no upload, provable cell count, explicit release approval. We do not claim: protection against a patient adversary reconstructing rows from many narrow aggregates. That limit is stated openly.

## Challenges we ran into

DuckDB-Wasm inside a static export. React Strict Mode double-registering WebMCP tools. Observable Plot tooltips on dark theme. Making capability withdrawal visible in the UI, not just in code.

## Accomplishments that we're proud of

A complete pay-gap review with the counter at zero. Permission as tool lifetime, not tool logic. One registry serving WebMCP agents, the in-page demo, and manual inspection.

## What we learned

Tool descriptions are part of the product — agents read failures and hints. The airlock meter turns an abstract privacy promise into something a judge can glance at. Presentation beats feature lists in a hackathon.

## What's next for Airlock

OPFS session persistence, org-side audit export, AST-tightened SQL guard, query-budget accounting against aggregate reconstruction.
