# Airlock

**An analytics workspace where an AI agent does the whole analysis without ever seeing
your data.**

Live demo: _pending deployment_ · Built for [The WebMCP Challenge](https://webmcp.devpost.com/)

---

> **Status: documentation phase.** The specification in `docs/` is complete and the build
> follows it. This README will carry the live URL, screenshots and the finished tool table
> once the application is deployed. Everything below describes what is being built and
> why.

---

## The problem

There is a large category of data an analyst cannot paste into a hosted model, and the
barrier is a contract or a regulation, not a preference. Payroll tables. Patient-level
extracts. Transaction ledgers. Support transcripts with PII buried in free text.

The person holding that file can do the analysis slowly by hand, or upload it and hope.
There has never been a third option, because until WebMCP the browser had no way to offer
one.

## The idea

Give the agent the capability and withhold the data.

Your file loads into DuckDB inside the browser tab and stays there. The agent gets sixteen
WebMCP tools: schema inspection, column profiling, guarded SQL, chart authoring, findings.
Those tools return statistics and aggregates. **They cannot return a row.** When the agent
genuinely needs individual records it has to ask, in writing, and you see the exact values
before you decide.

A counter in the header shows how many individual data values have crossed the boundary
this session. A complete gender pay-gap review finishes with that counter reading zero.

## Why WebMCP, specifically

A remote MCP server cannot do this, because the server has no data — the file was opened
from your disk into your tab. Giving a server-side tool access means uploading, which is
the exact act the product exists to prevent.

A screen-reading agent is worse. It sees the rendered rows, so every value enters the
model's context and the boundary is gone on first contact.

WebMCP is the only mechanism where the code that touches the data and the code that
decides what the model receives are the same code, running inside the page, under the
user's control. `execute` is the choke point. An aggregate crosses; a row does not.

And because WebMCP has no portable `unregisterTool`, the `AbortSignal` lifecycle turns out
to be the right primitive for a permission model. When you forbid raw-row requests,
Airlock aborts that tier's controller and `request_raw_rows` stops being advertised at
all. The agent cannot be talked into calling a tool it cannot see. That is a capability
boundary rather than a filter, and the page-scoped tool lifecycle is what makes it
possible.

## How WebMCP is implemented

One registry, four tiers, each owned by an `AbortController` whose lifetime matches an
application condition.

```js
// lib/webmcp/registry.ts — one entry per tool
{
  name: "run_query",
  description:
    "Run a read-only SQL query over the loaded datasets and return an aggregate result. " +
    "Only a single SELECT or WITH statement is accepted. Raw rows are never returned: if " +
    "the query is not an aggregate the call fails with `too_many_rows`. Prefer " +
    "profile_column when you only need a distribution.",
  inputSchema: toJsonSchema(RunQueryInput),
  annotations: { readOnlyHint: true },
  execute: runQuery,
}

// lib/webmcp/useWebMcpTools.ts — registration, scoped to a tier
const modelContext = document.modelContext ?? navigator.modelContext;
const controller = new AbortController();

for (const tool of toolsForActiveTiers) {
  modelContext.registerTool(tool, { signal: controller.signal });
}

return () => controller.abort(); // deregisters the whole tier atomically
```

| Tier | Registered while | Contents |
|---|---|---|
| 0 | The page is open | Orientation: workspace state, dataset list, live selection, sample loader |
| 1 | A dataset is loaded | Inspection: describe, profile, guarded query, explain |
| 2 | A dataset is loaded | Authoring: views, charts, findings, block editing, export |
| 3 | The policy permits it | The airlock: `request_raw_rows` |

Input schemas are generated from Zod, so the JSON Schema the agent is shown and the
validation the handler enforces are the same object. The browser does not validate
`inputSchema` before calling `execute`, so every handler re-validates. Handlers resolve a
structured envelope rather than throwing, so a rejected query hands the agent something to
act on instead of ending its turn.

The same registry drives an optional in-page agent through a thin adapter to the OpenAI
tool-calling shape. One tool definition, three consumers: external WebMCP agents, the
in-page agent, and the scripted demo.

## What people and agents can do together that was not possible before

**Analysis without disclosure.** A real, deliverable analysis on a restricted dataset,
with proof afterwards that zero individual values were disclosed.

**Shared visual context.** Highlight three bars on a chart and ask "why these?".
`get_active_selection` returns the live selection — dataset, filter, series, cursor — so
the agent resolves the reference without you describing it. A server-side tool has no
concept of what you are currently looking at.

**Negotiated disclosure.** The agent finds an outlier, needs eight rows, and asks in
writing. You see the justification, the SQL, the exact values and the running total, then
release four columns and redact the rest. Both parties know precisely what was shared,
and there is a record.

## Privacy model, honestly stated

**Claimed:** data loaded into Airlock is never transmitted off the device. An agent
receives schemas, statistics and aggregates. It receives an individual value only after a
human has seen that exact value and approved its release, and every release is counted and
logged.

**Not claimed:** this is not differential privacy. Airlock does not defend against an
adaptive adversary reconstructing records from a long sequence of carefully chosen
aggregate queries. The controls below reduce that surface; they do not close it.

Five enforcement points: a statement guard that permits only single read-only SQL and
blocks DuckDB's filesystem functions; projection redaction applied to results rather than
by rewriting SQL; an aggregate guard that makes raw rows structurally unreachable through
`run_query`; k-anonymity suppression on grouped results; and an injection guard for free
text, which is never returned verbatim.

Full detail, including the threat model and its residual risks, in
[`docs/04-privacy-model.md`](docs/04-privacy-model.md).

## Verify the claim in one minute

1. Open DevTools → Network. Load the sample payroll. **No request carries the data** — the
   only traffic is the static bundle and the wasm binaries.
2. Ask the agent for raw rows. Watch `run_query` fail with `too_many_rows`.
3. Turn off raw requests in the policy editor. Watch `request_raw_rows` disappear from the
   registered-tools panel.
4. Finish the pay-gap analysis. The airlock meter still reads 0.

## Running it

### In a browser with WebMCP

- **ChatGPT's in-app browser** — works out of the box. No flag, no token.
- **Google Chrome 149+** — open `chrome://flags/#enable-webmcp-testing`, set it to
  Enabled, relaunch. Chrome's WebMCP Tool Inspector extension is useful for browsing and
  invoking the registered tools by hand.

Without WebMCP the notebook, engine, charts and policy editor all still work; a status
pill explains what is missing. The human product never depends on the agent.

### Locally

```bash
npm ci
npm run dev      # http://localhost:3000
```

`localhost` is a secure context, so WebMCP works there with the flag on. A LAN address
over plain `http://` is not, and `document.modelContext` will be undefined.

```bash
npm run build    # static export to out/
npm test         # Vitest: SQL guard, redaction, k-anonymity, tool registry
```

The DuckDB-Wasm bundles are vendored into `public/duckdb/` by a `prebuild` hook rather
than committed. They are large binaries; the script is the source of truth.

## Stack

Next.js 15 with `output: 'export'` — no server code, no API routes, no environment
variables. DuckDB-Wasm (single-threaded `eh` bundle, self-hosted) for the engine.
Observable Plot for charts. Zustand for state. Zod for schemas and validation. TypeScript
throughout.

The build artifact is a directory of static files. It runs on Vercel, and equally on
Cloudflare Pages, Netlify, Render or any static host — which is itself part of the
argument that there is no backend.

## Repository map

```
app/          one route, client-only workspace
components/   workspace, airlock, agent, telemetry, ui
lib/
  webmcp/     registry, tier lifecycle, feature detection
  tools/      one handler per tool; the only path to the data
  duckdb/     singleton client, ingest, SQL guard, profiling
  privacy/    classification, policy, k-anonymity, redaction, injection guard
  agent/      BYOK client, OpenAI tool adapter, demo script
  store/      zustand slices
scripts/      synthetic payroll generator, duckdb vendoring
docs/         specification — see below
```

| Document | Contents |
|---|---|
| [`00-hackathon-brief.md`](docs/00-hackathon-brief.md) | Requirements, deadlines, judging criteria |
| [`01-product.md`](docs/01-product.md) | Problem, audience, the WebMCP argument |
| [`02-architecture.md`](docs/02-architecture.md) | Stack, layer map, file tree, data flows |
| [`03-tool-contract.md`](docs/03-tool-contract.md) | Every tool, its schema, its guards |
| [`04-privacy-model.md`](docs/04-privacy-model.md) | Enforcement points and threat model |
| [`05-agent-ux.md`](docs/05-agent-ux.md) | Audit trail, release dialog, undo, degraded states |
| [`06-testing-and-evals.md`](docs/06-testing-and-evals.md) | Test plan and the ten tool evals |
| [`07-deployment.md`](docs/07-deployment.md) | Hosting, origin trial, freeze protocol |
| [`08-submission.md`](docs/08-submission.md) | Submission text and video script |
| [`adr/`](docs/adr/) | Six architecture decision records |

## License

MIT — see [`LICENSE`](LICENSE).
