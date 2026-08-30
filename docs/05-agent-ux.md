# 05 — Agent UX

How the human experiences an agent working inside their workspace. This is where the
"Execution" score is won or lost, because a coherent product experience is exactly what
the criterion asks for.

## Principle

The agent is a collaborator working in the same document, not a chatbot in a sidebar
that reports back. Its output lands in the notebook where the human's own work lands.
Its actions are visible while they happen, attributable afterwards, and reversible.

Three rules follow:

1. **Nothing the agent does is invisible.** Every tool call renders before it resolves.
2. **Nothing the agent does is unattributable.** Agent-authored blocks are visually
   marked and carry the call that produced them.
3. **Nothing the agent does is irreversible.** Every mutating tool pushes an inverse onto
   the undo stack.

## Layout

Three panes.

**Left — datasets.** Loaded tables and views, each expanding to its columns with a
classification chip. This is also the policy editor's surface: click a chip to change it.
Below, the registered-tools panel, which shows the live WebMCP tier set.

**Centre — the notebook.** An ordered list of blocks: charts, aggregate tables, findings,
and released-rows blocks. Human-created and agent-created blocks are the same kind of
object, distinguished by a small agent badge and the tool call that made them.

**Right — agent and audit.** Tabs. The agent conversation, and the full tool log.

**Header** — the airlock meter, the WebMCP status pill, and the policy state.

## The tool call card

Every call renders a card in the audit log the moment it arrives, before it completes.

```
┌────────────────────────────────────────────────────┐
│ ● run_query                       read-only   142ms│
│   SELECT department, gender, median(salary) …      │
│   → 12 rows · 2 groups suppressed · salary redacted│
│                                          [ Undo ]  │
└────────────────────────────────────────────────────┘
```

- A pulsing dot while pending, so latency is legible rather than mysterious.
- The `readOnlyHint` annotation is rendered as a badge. Read-only calls are quiet;
  mutating calls are tinted.
- The result line is the tool's own `summary` field, which is why every envelope carries
  one.
- Suppression and redaction are shown here, not hidden. The human should see the privacy
  engine working.
- Undo appears only on mutating calls.

## The release dialog

The one moment the product deliberately interrupts. It has to be good, because a dialog
that is annoying gets click-throughed, and a dialog that gets click-throughed is not a
control.

```
┌─ Airlock · release request ────────────────────────────┐
│                                                        │
│ The agent is asking for 8 individual rows.             │
│                                                        │
│ Why it says it needs them                              │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Three engineering salaries sit more than 3σ below  │ │
│ │ the grade median. I need the rows to tell a data   │ │
│ │ error from a genuine outlier.                      │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ Query                                                  │
│   SELECT employee_id, grade, salary, hired_at          │
│   FROM payroll WHERE z_score < -3 LIMIT 8              │
│                                                        │
│ What would be released              8 rows × 4 cols    │
│  ☐ employee_id   identifier         ← off by default   │
│  ☑ grade         quasi-identifier                      │
│  ☑ salary        sensitive                             │
│  ☑ hired_at      quasi-identifier                      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ id     grade  salary   hired_at                  │  │
│  │ ●●●●   L4     41,200   2024-03-11                │  │
│  │ ●●●●   L4     39,800   2023-11-02                │  │
│  │ …                                                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│ Released this session: 0 → 24 cells                    │
│                                                        │
│              [ Deny ]  [ Release 24 cells ]            │
└────────────────────────────────────────────────────────┘
```

Design decisions worth defending:

- **The human sees the actual values before deciding.** Approving a release blind would
  be worse than no dialog at all, because it would look like a control while not being
  one.
- **`identifier` columns default to off.** The safe path is the default path.
- **The counter shows the delta.** `0 → 24` communicates the cost of this specific
  decision, which a running total alone does not.
- **No Enter-key default.** Deny and Release are both explicit clicks. Muscle memory
  should not be able to approve a disclosure.
- **No timeout.** An unanswered dialog blocks the tool call forever. Failing closed is the
  only acceptable direction.

## Attribution and undo

Agent-authored blocks carry a badge that links back to the tool call in the audit log.
Hovering the badge highlights the corresponding card, and vice versa.

Undo is per-call, not global. Every mutating handler returns an inverse operation
alongside its result: `add_chart` yields a remove, `update_block` yields a restore of the
previous value, `create_view` yields a drop. The inverse is stored on the audit entry, so
undoing the third of five agent actions leaves the other four intact. A linear undo stack
would be wrong here — the human is reviewing a batch of agent work and wants to reject
parts of it.

Released rows are the exception. A `RawRowsBlock` can be removed from the notebook, but
the release itself is permanent in the audit log and the meter never decrements. A
disclosure record you can erase is not a disclosure record.

## The in-page agent

Airlock's primary consumer is an external agent over WebMCP. But a judge who opens the
live URL in an ordinary browser with no agent attached must still see the product work.
Two fallbacks, in order of fidelity.

**Demo mode — no key, no configuration.** A scripted session in `lib/agent/demoScript.ts`
replays a real pay-gap investigation: eleven tool calls including one denied release
request and one approved one. It calls the *real* handlers against the *real* DuckDB
instance — only the model's turn-taking is scripted. Nothing is faked; the results are
computed live. Timed with realistic pauses so it reads as work rather than as an
animation. This is what the video records, and what a judge who clicks nothing else will
see.

**BYOK mode.** Paste an OpenAI API key and drive the same tool registry from a real
model. The key lives in `sessionStorage`, is never persisted, and is sent only to
`api.openai.com` directly from the browser. `lib/agent/toolAdapter.ts` converts the
registry into the OpenAI tool-calling shape — same names, same schemas, same handlers,
same guards.

That adapter is the "one definition, two consumers" property the WebMCP guidance
highlights, and it is a genuine architectural claim rather than a slogan: adding a tool to
`registry.ts` gives it to the external agent, the in-page agent and the demo runner at
once, with no second implementation to keep in sync.

## Degraded states

The app must be coherent when WebMCP is absent, because most visitors will arrive without
the flag on.

| State | Behaviour |
|---|---|
| WebMCP unavailable | Amber status pill: "WebMCP not detected". Clicking opens instructions for the Chrome flag and for ChatGPT's in-app browser. The notebook, DuckDB, charts, policy editor and demo mode all work normally. |
| WebMCP present, no agent attached | Green pill listing the count of registered tools. The registered-tools panel is populated and browsable. |
| Insecure context | Red pill explaining that WebMCP needs HTTPS, with the deployed URL offered as a link. |
| DuckDB failed to load | Blocking error with the actual exception and a reload action. Silent failure here is the worst outcome, because everything downstream looks merely empty. |

The rule: **the human product never depends on the agent.** WebMCP makes Airlock faster.
Its absence makes Airlock a manual notebook, not a broken page.
