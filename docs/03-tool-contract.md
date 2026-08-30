# 03 — Tool contract

The tool surface is the product's API and the thing judges score hardest. This document
is the specification; `lib/webmcp/registry.ts` is its implementation and must not
diverge from it.

## Conventions

**Naming.** `snake_case`, matching the shape the challenge page itself shows
(`search_products`) and MCP convention generally. The specification permits
`[A-Za-z0-9_\-.]{1,128}`.

**Descriptions are written for a model, not for a developer.** Lead with the verb, state
what comes back, name the failure modes, and say when *not* to use the tool. A
description that says "use `profile_column` instead of `request_raw_rows` when you only
need the distribution" saves a human interruption, and interruptions are the cost this
product is trying to minimise.

**Every tool resolves; tools do not throw.** Throwing surfaces as a tool-call error and
tends to end an agent's turn. Instead every handler returns one of two envelopes:

```ts
{ ok: true,  summary: string, data: unknown }
{ ok: false, error: ErrorCode, message: string, hint?: string }
```

`summary` is a one-line natural-language rendering of the result. Agents that surface raw
tool output to the user get something readable for free, and models reliably read the
first field. Genuine programming errors are the only thing allowed to reject.

**Error codes.**

| Code | Meaning | Intended agent reaction |
|---|---|---|
| `invalid_input` | Failed Zod validation | Fix the arguments and retry |
| `not_found` | Unknown dataset, column or block id | Call `list_datasets` or `get_workspace_state` |
| `query_rejected` | SQL failed the read-only guard | Rewrite as a single SELECT |
| `too_many_rows` | Result is raw rows, not an aggregate | Aggregate, or call `request_raw_rows` |
| `policy_blocked` | Column classification forbids this | Use a different column, or `propose_policy_change` |
| `k_suppressed` | Groups fell below the k-anonymity threshold | Widen the grouping |
| `denied_by_user` | Human refused a release request | Continue without the rows; do not re-ask |
| `engine_error` | DuckDB raised | Report to the user |

**Annotations.** `readOnlyHint: true` on everything that neither mutates the workspace
nor releases data. It is set honestly: `add_chart` mutates the notebook and is marked
`false` even though it discloses nothing.

**Input schemas** are generated from Zod at build time so the advertised JSON Schema and
the enforced validation are the same object. Every schema sets
`additionalProperties: false` and lists `required` explicitly. The browser does not
enforce any of this, so the handler re-validates with the same Zod schema before doing
anything.

## Registration tiers

| Tier | Active while | Controller | Tools |
|---|---|---|---|
| 0 | The page is mounted | `pageController` | 4 |
| 1 | At least one dataset is loaded | `dataController` | 5 |
| 2 | At least one dataset is loaded | `dataController` | 6 |
| 3 | The policy permits raw-row requests | `airlockController` | 1 |

Sixteen in total. A fresh page advertises 4; loading a dataset takes it to 15; permitting
raw requests takes it to 16.

Tiers 1 and 2 share a controller because they share a lifetime; they are separated here
because they differ in whether they mutate. Aborting a controller deregisters its whole
tier in one call, which is the portable path across every Chrome version that ships
WebMCP.

---

## Tier 0 — orientation

Available from page load, before any data exists. Their job is to let an agent that has
just discovered the page work out what it is and bootstrap a session unaided.

### `get_workspace_state`
`readOnlyHint: true`

Returns what is currently on screen: loaded datasets with row counts, notebook blocks
with ids and types, the active privacy policy summary, the airlock counter, and whether
raw-row requests are currently permitted. This is the tool an agent should call first.

Input: `{}`

Output: `{ datasets, blocks, policy_summary, cells_released, raw_requests_enabled }`

### `list_datasets`
`readOnlyHint: true`

Names, ids, row counts, column counts, byte sizes, source filenames and load timestamps.
No column names — that is `describe_dataset`, deliberately a separate call so an agent
scanning for orientation does not pull a schema it does not need.

Input: `{}`

### `get_active_selection`
`readOnlyHint: true`

**The collaboration tool.** Returns what the human is looking at right now: the focused
dataset, the active filter predicate, the selected chart block, the highlighted series or
bars within it, any text selected in the notebook, and the cursor block. Lets a user say
"why these?" and have the agent resolve the deixis without describing anything.

No server-side tool can implement this. It is the clearest single demonstration of why
tools belong in the page.

Input: `{}`

Output: `{ dataset_id?, block_id?, series?, filter_sql?, selected_text?, empty: boolean }`

### `load_sample_dataset`
`readOnlyHint: false`

Loads the bundled synthetic payroll export. Exists so an agent can set up its own demo,
and so a judge who says "show me what you can do" gets a working session without
touching the file picker.

Input: `{ id: 'payroll_2026' }`

---

## Tier 1 — inspection and query

Registered on first dataset load. Everything here is read-only and aggregate-only.

### `describe_dataset`
`readOnlyHint: true`

Per-column: name, SQL type, assigned classification, null fraction, distinct count, and
for numeric columns min / max / mean / median. Columns classified `identifier` are listed
but their statistics are withheld — the agent learns that an employee id exists without
learning its range. Columns the user has blocked outright report
`{ blocked: true }` and nothing else.

Sample values are **not** returned. That is what `profile_column` is for, and it applies
k-anonymity.

Input: `{ dataset_id: string }`

### `profile_column`
`readOnlyHint: true`

The distribution of one column. Numeric columns get histogram buckets; low-cardinality
columns get top-k value counts. Any bucket or category whose count falls below the
k-anonymity threshold (default 5) is merged into an `« suppressed »` bucket rather than
returned. Free-text columns return length statistics and a token histogram, never
verbatim values.

Input: `{ dataset_id, column, top_k?: number (≤ 25) }`

Failure: `k_suppressed` when so much is suppressed the result would be misleading.

### `run_query`
`readOnlyHint: true`

The workhorse. Runs SQL against the loaded datasets and returns the result set.

Guards applied in order:

1. **Statement guard.** Exactly one statement, and it must be `SELECT` or `WITH`. `ATTACH`,
   `COPY`, `INSTALL`, `LOAD`, `EXPORT`, `PRAGMA`, any DDL or DML, and DuckDB's filesystem
   functions (`read_csv` and friends against arbitrary paths) are rejected with
   `query_rejected`. This prevents both data exfiltration and local file access.
2. **Redaction.** Blocked columns are stripped from the projection. Referencing one in a
   `WHERE` clause is permitted — filtering on a value discloses far less than selecting
   it — but it cannot appear in the output.
3. **Aggregate guard.** If the result set is not an aggregate (no `GROUP BY`, no aggregate
   function) and exceeds `max_preview_rows` (default 0 — that is, none at all in the
   default policy), the call fails with `too_many_rows` and a hint pointing at
   `request_raw_rows`. This is the rule that makes the guarantee real: **`run_query`
   cannot return a raw row.**
4. **k-anonymity.** Grouped results whose groups fall below the threshold are suppressed.
5. **Injection guard.** Surviving string values are wrapped before return.

Input: `{ sql: string, max_rows?: number (≤ 1000) }`

Output: `{ columns, rows, row_count, truncated, suppressed_groups, redacted_columns }`

The `redacted_columns` field is deliberate: the agent is told what it was not given, so
it can reason about the gap and explain it to the user rather than silently drawing a
wrong conclusion.

### `explain_query`
`readOnlyHint: true`

Returns the DuckDB plan plus whether the query would pass each guard, **without running
it**. Lets an agent check its work before spending a turn on a rejection. Cheap to build,
disproportionately improves how the agent behaves.

Input: `{ sql: string }`

### `propose_policy_change`
`readOnlyHint: false`

The agent may *suggest* that a column's classification is wrong — a column named
`notes_internal` classified `free_text` that is actually a numeric code, say. The tool
queues a suggestion in the policy editor with the agent's rationale. **It changes
nothing.** The human approves or discards it.

This is the privilege-escalation boundary, stated explicitly: an agent can ask for more
access but can never grant itself more access. Loosening a policy is UI-only and has no
tool at any tier, by design.

It sits in tier 1 rather than tier 3 on purpose: the moment an agent most needs to argue
that a classification is wrong is when the resulting restriction is blocking it, which is
exactly when tier 3 is absent.

`{ column, dataset_id, proposed_classification, rationale }`

---

## Tier 2 — workspace mutation

Registered alongside tier 1. These change what the human sees. None of them disclose
data; they are marked `readOnlyHint: false` because they mutate state, which is what the
annotation actually means.

### `create_view`
Registers a named DuckDB view and adds it to the sidebar, so later queries and the human
can both reuse it. `{ name, sql, description }`

### `add_chart`
Appends a chart block to the notebook. The chart renders immediately — the human watches
it appear while the agent is still working, which is the moment that sells the product on
video. `{ title, sql, mark: 'bar'|'line'|'area'|'point'|'rule'|'heatmap', x, y, color?, facet?, caption? }`

The `sql` runs through the identical `run_query` pipeline. A chart cannot display
something a query is not allowed to return.

### `add_finding`
Appends a markdown finding with a severity and links to the blocks that evidence it.
This is how the agent writes its conclusions into the shared document instead of into a
chat log that nobody keeps.
`{ title, body_markdown, severity: 'info'|'watch'|'material', evidence_block_ids: string[] }`

### `update_block` / `remove_block`
Ordinary editing, so the agent can revise its own work when the human pushes back. Both
are undoable from the audit log. `update_block` carries an optional `position`, so
reordering does not need a tool of its own.

### `export_report`
Renders the notebook to self-contained markdown or HTML and triggers a download.
Aggregate content only unless released rows were explicitly approved, in which case the
export carries the approval stamps with them. `{ format: 'md'|'html' }`

---

## Tier 3 — the airlock

Registered only while the policy permits it. When the user turns raw requests off, this
controller aborts and the tool disappears from `getTools()`.

### `request_raw_rows`
`readOnlyHint: false`

The single channel through which actual row data can reach the agent.

```ts
{
  sql: string,          // must resolve to ≤ row_limit rows
  row_limit: number,    // 1..50
  columns: string[],    // explicit; no SELECT *
  justification: string // ≥ 20 chars, shown verbatim to the human
}
```

Behaviour:

1. The query is planned but **not returned**. Its result is rendered into a modal.
2. The modal shows the agent's justification, the exact SQL, the exact rows, a per-column
   classification badge, the cell count this release would add, and the session total.
3. The human chooses: **Release**, **Release redacted** (per-column toggles), or **Deny**.
4. On release, the approved cells are returned to the agent, a `RawRowsBlock` is appended
   to the notebook stamped with the timestamp and the approving action, and the airlock
   meter increments.
5. On denial the tool resolves `{ ok: false, error: 'denied_by_user' }`. The description
   instructs the agent not to re-ask for the same rows, and the handler enforces it by
   rejecting an identical request within the same session.

There is no timeout that defaults to allow. An unanswered dialog blocks the tool call
indefinitely; if the tab is closed the promise never resolves, which is the correct
failure direction.

---

## Deliberately absent

Worth stating in the README, because absence is a design decision that a reviewer will
otherwise read as an oversight.

| Not a tool | Why |
|---|---|
| `set_privacy_policy` | An agent that can widen its own access has no boundary. Human-only. |
| `delete_dataset` | Destructive, no upside, and the human is one click away. |
| `execute_sql` (unrestricted) | The guard in `run_query` is the product. An escape hatch would void it. |
| `read_file` | The agent has no business reaching the filesystem. DuckDB's file functions are blocked in the SQL guard for the same reason. |
| `fetch_url` | Nothing in Airlock should be able to make an outbound request. That is the whole promise. |

## Reference implementation shape

```ts
// lib/webmcp/registry.ts
export const AIRLOCK_TOOLS: AirlockTool[] = [
  {
    tier: 1,
    name: "run_query",
    description:
      "Run a read-only SQL query over the loaded datasets and return an aggregate " +
      "result. Only a single SELECT or WITH statement is accepted. Raw rows are never " +
      "returned: if the query is not an aggregate the call fails with `too_many_rows`. " +
      "Prefer profile_column when you only need a distribution.",
    inputSchema: toJsonSchema(RunQueryInput),
    annotations: { readOnlyHint: true },
    execute: runQuery,
  },
  // …
];

// lib/webmcp/useWebMcpTools.ts
const modelContext = document.modelContext ?? navigator.modelContext;
const controller = new AbortController();
for (const tool of toolsForActiveTiers) {
  modelContext.registerTool(tool, { signal: controller.signal });
}
return () => controller.abort();
```
