# 02 — Architecture

## Shape in one paragraph

Airlock is a fully client-side single-page application. There is no backend, no database
and no API route. A Next.js App Router project is compiled to static files with
`output: 'export'` and served from a CDN. Data is loaded from the user's disk into a
DuckDB-Wasm instance running in a Web Worker inside the tab. A tool registry sits between
that engine and the outside world; the same registry is registered with
`document.modelContext` for external agents and adapted for the optional in-page agent.
Nothing the user loads is ever transmitted anywhere.

## Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 15, App Router, `output: 'export'` | Requested. Static export keeps the "no backend" claim provable and lets the app be hosted on any static host, not just Vercel. |
| Language | TypeScript, strict | Tool schemas and their handler types must not drift. |
| Hosting | Vercel | Requested. Nothing Vercel-specific is used, which is itself worth stating in the README. |
| Analytics engine | DuckDB-Wasm (`@duckdb/duckdb-wasm`), `eh` bundle, self-hosted | See ADR-0001 and ADR-0004. |
| Charts | `@observablehq/plot` | Takes a declarative spec, which is exactly what an agent emits. Lighter than Vega-Lite. Fallback recorded in ADR-0006. |
| State | Zustand, sliced by domain | Tool handlers are plain functions that read and write the store. They must be callable outside React, which rules out context-only state. |
| Validation | Zod, one schema per tool | JSON Schema for the agent is *generated from* the Zod schema so the advertised contract and the enforced contract cannot diverge. |
| Styling | Tailwind CSS v4 + a small set of local primitives | No component library. Four days. |
| Tests | Vitest for tool handlers and the privacy engine | The tool layer is pure functions over the store; it is the part worth testing and the part that is cheap to test. |

## Layer map

```
┌──────────────────────────────────────────────────────────────────┐
│  External agent (ChatGPT in-app browser, Chrome agent, Inspector)│
└───────────────────────────┬──────────────────────────────────────┘
                            │ document.modelContext
┌───────────────────────────▼──────────────────────────────────────┐
│  lib/webmcp/     registration, tier lifecycle, feature detection  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
┌─────────────▼─────────────┐  ┌──────────▼──────────────────────┐
│  lib/tools/               │  │  lib/agent/  in-page BYOK agent  │
│  one exported handler per │◄─┤  adapts the same registry to the │
│  tool; transport-agnostic │  │  OpenAI tool-calling shape       │
└─────────────┬─────────────┘  └─────────────────────────────────┘
              │
      ┌───────┴────────┬──────────────────┐
      │                │                  │
┌─────▼──────┐  ┌──────▼───────┐  ┌───────▼────────┐
│ lib/privacy│  │ lib/duckdb   │  │ lib/store      │
│ policy,    │  │ singleton,   │  │ datasets,      │
│ k-anon,    │  │ SQL guard,   │  │ notebook,      │
│ redaction, │  │ profiling    │  │ policy, audit, │
│ injection  │  │              │  │ selection      │
└────────────┘  └──────┬───────┘  └───────┬────────┘
                       │                  │
              ┌────────▼────────┐  ┌──────▼──────────┐
              │ DuckDB-Wasm     │  │ React UI        │
              │ (Web Worker)    │  │ components/     │
              └─────────────────┘  └─────────────────┘
```

The important property: **`lib/tools/` is the only path to the data.** No React component
queries DuckDB directly, and no tool handler reaches into the DOM. Human clicks and agent
tool calls both funnel through the same handlers, which means every guarantee the privacy
layer makes holds identically for both, and the audit log gets a complete picture for
free.

## File tree

```
airlock/
├── app/
│   ├── layout.tsx                  root layout; origin-trial meta tag lives here
│   ├── page.tsx                    the only route; composes the workspace
│   └── globals.css
├── components/
│   ├── workspace/
│   │   ├── WorkspaceShell.tsx      three-pane layout
│   │   ├── DatasetSidebar.tsx      loaded datasets, views, column classification chips
│   │   ├── Notebook.tsx            ordered list of blocks
│   │   ├── blocks/
│   │   │   ├── ChartBlock.tsx
│   │   │   ├── TableBlock.tsx      aggregate results only
│   │   │   ├── FindingBlock.tsx    agent-authored markdown finding
│   │   │   └── RawRowsBlock.tsx    released rows, stamped with who approved and when
│   │   └── DropZone.tsx            CSV / Parquet drag-and-drop + sample loader
│   ├── airlock/
│   │   ├── AirlockMeter.tsx        cells released this session; the headline number
│   │   ├── ReleaseRequestDialog.tsx  the human gate
│   │   ├── PolicyEditor.tsx        per-column classification, UI-only
│   │   └── ClassificationBadge.tsx
│   ├── agent/
│   │   ├── AgentPanel.tsx
│   │   ├── ToolCallCard.tsx        one card per call: name, input, result, duration
│   │   ├── ApiKeyDialog.tsx        BYOK, sessionStorage only
│   │   └── DemoScriptRunner.tsx    scripted walkthrough, no key required
│   ├── telemetry/
│   │   ├── ToolLogPanel.tsx        full audit trail
│   │   └── UndoButton.tsx
│   ├── system/
│   │   ├── WebMcpStatus.tsx        detected / not detected, with enable instructions
│   │   └── RegisteredToolsPanel.tsx  live view of the current tier set
│   └── ui/                         button, dialog, table, tabs, badge, tooltip
├── lib/
│   ├── webmcp/
│   │   ├── types.ts                ambient ModelContext / ModelContextTool declarations
│   │   ├── modelContext.ts         getModelContext(): document ?? navigator ?? null
│   │   ├── registry.ts             every tool definition, in one array
│   │   ├── tiers.ts                tier membership and activation predicates
│   │   ├── toJsonSchema.ts         Zod → JSON Schema for inputSchema
│   │   └── useWebMcpTools.ts       React hook: registers/aborts per tier
│   ├── tools/
│   │   ├── discovery.ts            list_datasets, describe_dataset, profile_column, …
│   │   ├── query.ts                run_query, explain_query
│   │   ├── workspace.ts            create_view, add_chart, add_finding, update_block, …
│   │   ├── airlock.ts              request_raw_rows, propose_policy_change
│   │   └── result.ts               ok() / fail() envelope helpers
│   ├── duckdb/
│   │   ├── client.ts               module-level singleton promise
│   │   ├── loader.ts               registerFileHandle, CSV/Parquet ingest
│   │   ├── sqlGuard.ts             single-statement SELECT enforcement
│   │   └── profile.ts              column statistics and histograms
│   ├── privacy/
│   │   ├── classify.ts             heuristic column classification on load
│   │   ├── policy.ts               effective policy resolution
│   │   ├── kAnonymity.ts           small-cell suppression
│   │   ├── redact.ts               column masking applied to every result set
│   │   └── injectionGuard.ts       neutralises instructions embedded in free-text data
│   ├── agent/
│   │   ├── openaiClient.ts         direct browser call, BYOK
│   │   ├── toolAdapter.ts          registry → OpenAI tool shape
│   │   └── demoScript.ts           deterministic scripted session
│   └── store/
│       ├── datasets.ts  notebook.ts  policy.ts  audit.ts  selection.ts
├── public/
│   ├── data/payroll-sample.csv     generated, committed
│   └── duckdb/                     vendored bundles, gitignored, produced by script
├── scripts/
│   ├── generate-payroll.ts         seeded synthetic data generator
│   └── vendor-duckdb.mjs           copies wasm bundles out of node_modules into public
├── types/webmcp.d.ts
├── docs/
└── notes-ru/                       internal Russian-language working notes
```

## Data flow: loading a file

1. User drops a CSV, or clicks "Load sample payroll".
2. `loader.ts` hands the `File` to DuckDB-Wasm via `registerFileHandle`, then runs
   `CREATE TABLE … AS SELECT * FROM read_csv(...)`. The bytes are streamed into the
   worker; they are never read into a JS string and never touch the network.
3. `profile.ts` computes per-column statistics in one pass.
4. `classify.ts` assigns each column a classification from those statistics and its name:
   `identifier`, `quasi_identifier`, `sensitive`, `measure`, `free_text`. The user can
   override every one of them in `PolicyEditor`.
5. The dataset slice updates. `useWebMcpTools` observes that a dataset now exists and
   activates tier 1 and tier 2 — those tools become visible to the agent for the first
   time.

## Data flow: an agent tool call

1. Agent calls `run_query` with `{ sql }`.
2. `useWebMcpTools`'s wrapper starts a timer and writes a pending entry to the audit
   slice, which renders immediately in `ToolLogPanel`. The human sees the call arrive
   before it completes.
3. `sqlGuard.ts` rejects anything that is not a single read-only statement.
4. The handler executes against DuckDB.
5. `redact.ts` drops or masks columns the policy blocks. `kAnonymity.ts` suppresses
   groups below the threshold. The aggregate guard rejects result sets that are really
   raw rows in disguise.
6. `injectionGuard.ts` wraps any free-text values that survive.
7. The result is returned as a structured envelope, the audit entry is completed with the
   duration and a result summary, and any workspace mutation is pushed onto the undo
   stack.

## Registration lifecycle

Four `AbortController`s, each owning a tier:

| Tier | Controller lifetime | Tools |
|---|---|---|
| 0 | Page mount → unmount | Always available: orientation and the sample loader |
| 1 | First dataset loaded → last dataset removed | Read-only inspection and query |
| 2 | Same as tier 1 | Workspace mutation: views, charts, findings |
| 3 | Policy allows raw requests → user revokes it | `request_raw_rows` |

Aborting a controller removes every tool registered under it in one call, which is why
tools are grouped by lifetime rather than by topic. `RegisteredToolsPanel` renders the
live set so a judge can watch tools appear and disappear as they interact with the page.

## Constraints and known sharp edges

- **SSR.** DuckDB-Wasm touches `Worker` and `WebAssembly` at import time. Every module
  that reaches it is client-only, and `page.tsx` loads the workspace through
  `next/dynamic` with `ssr: false`.
- **React Strict Mode double-invocation.** `registerTool` throws a `DOMException` on a
  duplicate name. The registration effect must abort its previous controller in cleanup,
  and the DuckDB client must be a module-level singleton promise rather than per-effect
  state.
- **No cross-origin isolation.** We use the single-threaded `eh` bundle deliberately, so
  no `COOP`/`COEP` headers are needed and the app stays host-agnostic. Threading is a
  post-hackathon change, not a hackathon one. ADR-0004.
- **Worker origin.** Self-hosting the bundles under `/duckdb/` avoids the cross-origin
  Worker restriction entirely, so no Blob-URL `importScripts` shim is needed.
- **No streaming tool results.** The WebMCP draft has no streaming surface. Long queries
  report progress by mutating page state, which the human sees; the agent gets one
  resolved value at the end.
