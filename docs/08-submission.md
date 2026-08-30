# 08 — Submission

Everything that goes onto the Devpost form, drafted here so the last day is assembly
rather than composition.

## Checklist

- [ ] Live URL, public, no authentication, verified in ChatGPT's in-app browser
- [ ] Public GitHub repository with MIT `LICENSE` detected in the About sidebar
- [ ] README with a 60-second path from landing to seeing the product work
- [ ] Written description covering the four required points
- [ ] YouTube video, public, under 3:00, with audio
- [ ] Testing instructions for both browser paths
- [ ] Built entirely within the submission period — the git history is the evidence

## Devpost form fields

**Project name.** `Airlock`

**Elevator pitch** (200 character limit, 194 used):

> An analytics workspace where the AI agent does the whole analysis without ever seeing
> your data. It stays in DuckDB in your tab; WebMCP tools return only aggregates. Raw rows
> need your approval.

**Thumbnail.** 3:2, under 5 MB. A screenshot of the release dialog with the airlock meter
visible — one image that carries the whole idea. Captured on day 3 once the UI exists.

**Built with** (25 tag limit, 17 used). Order matters: the first tags render in the gallery
card. `webmcp` leads because it is the challenge's own keyword and the likely filter.

```
webmcp, model-context-protocol, duckdb, webassembly, typescript, next.js, react,
zustand, zod, observable-plot, tailwind-css, web-workers, sql, vercel, openai,
privacy, data-analytics
```

**Try it out links.** Two: the production URL and the public repository.

**Video demo link.** YouTube, public, under 3:00, with audio. Day 4.

**Image gallery** (15 allowed, 6 planned, 3:2, captured at 1080p or better). A judge looks
at the first two or three, so the order is the argument.

| # | Shot | Why it earns its place |
|---|---|---|
| 1 | The release dialog, meter visible | Also the thumbnail. One image carries the whole idea. |
| 2 | Full three-pane workspace mid-session, chart materialising | Shows a product rather than a demo. |
| 3 | Audit panel with tool-call cards | The read-only badges and the redaction and suppression lines show the privacy engine working. |
| 4 | Registered-tools panel, raw access permitted | Pairs with 5. |
| 5 | The same panel after revoking it, `request_raw_rows` gone | The `AbortSignal` capability boundary, legible without a caption. |
| 6 | DevTools Network tab during a full session | Proof of the central claim. It has to be an image, not just a sentence. |

## Additional info — the judges-only page

Not shown on the public project page. Several fields are answerable before the build
exists.

| Field | Answer |
|---|---|
| Submitter Type | Individual |
| Country of residence | **Open — must be checked against the excluded-territory list in the official rules, which keys off where OpenAI's API services are available. This affects eligibility, not just prize payment.** |
| Organization name | Blank |
| App Status | **New.** The project did not exist before Aug 25; the entire git history sits inside the submission window. |
| If Existing, what did you update | Blank. Filling it while claiming New invites questions we do not need. |
| Live URL | Pending deployment |
| Public repo URL | Pending |
| Level of learning / AI career value | Organiser telemetry, not judging input. Answer honestly. |

### Testing instructions

The FAQ says judges are not required to run the project, and that when they do, this is
what they follow. It is written for someone with no context and sixty seconds.

```
No credentials required. The app is public, stores nothing, and has no backend.

FASTEST PATH — 60 seconds, no setup
1. Open the live URL in any browser.
2. Click "Load sample payroll". A synthetic HR dataset loads into DuckDB inside the tab.
3. Click "Run demo" in the agent panel. A scripted session drives the real tools against
   the real engine: profiling, guarded SQL, a chart, one denied release request and one
   approved one.
4. Watch the airlock meter in the header. It reads 0 until you approve a release.

WITH A REAL AGENT
- ChatGPT in-app browser: WebMCP works with no flag and no token. Open the URL and ask
  "Is there a gender pay gap in this data?"
- Google Chrome 149+: enable chrome://flags/#enable-webmcp-testing, relaunch, open the
  URL. The status pill in the header turns green and shows the registered tool count.

WHAT TO LOOK FOR
- Open DevTools > Network before loading the data. No request carries the dataset. The
  only traffic is static assets and the DuckDB WebAssembly binaries. This is the claim
  the whole project rests on and it takes ten seconds to verify.
- Ask the agent for individual rows. run_query fails with `too_many_rows`. That is
  structural: the tool cannot return a raw row, it is not a setting that was switched on.
- Open the policy editor and turn off raw-row requests. `request_raw_rows` disappears
  from the registered-tools panel. The tool is unregistered through its AbortSignal, not
  merely refused, so the agent can no longer see that the capability exists.
- The advertised tool count changes as you work: 4 on a fresh page, 15 once a dataset is
  loaded, 16 while raw requests are permitted.

Optional: Chrome's WebMCP Tool Inspector extension lists every registered tool with its
description, schema and annotations, and lets you invoke them by hand.
```

### Which agents or clients did you test your WebMCP tools with

Finalised on day 4 against what was actually exercised. Expected answer:

```
- ChatGPT's in-app browser (no flag, no origin-trial token required)
- Google Chrome 152 stable with chrome://flags/#enable-webmcp-testing
- Chrome's WebMCP Tool Inspector extension, for manual tool invocation and for reviewing
  each tool's description and schema exactly as an agent receives them
- The app's own in-page agent, which drives the identical tool registry through an
  adapter to the OpenAI tool-calling shape — one definition, several consumers
```

### Which AI tools have you leveraged

Answered plainly. The FAQ encourages AI assistance and separately warns against
overstating what runs.

```
Cursor with Claude Opus 5 for the specification, scaffolding and implementation.
OpenAI models drive the app's optional in-page agent and were used to run the tool
evaluation suite — a fixed set of prompts checking whether a model that has never seen
the app can complete the task from the tool descriptions alone. Several tool descriptions
and error hints were rewritten based on where those runs failed.
```

## Project Story — heading plan

Devpost prefills seven headings. They are editable, and they do not cover the four points
the rules require: the fit for WebMCP, the UX improvement, what is newly possible, and the
implementation. Two of those have nowhere to live in the default template.

The plan is to keep Devpost's headings — the gallery renders against them and a judge
scanning a hundred entries looks for familiar anchors — and insert two of our own where
the required content belongs.

| Heading | Source | Required point |
|---|---|---|
| Inspiration | The problem, from `01-product.md` | — |
| What it does | Elevator + the three collaboration beats | 2, 3 |
| **Why WebMCP is the only way to build this** *(added)* | "Why this use case is a strong fit" below | **1** |
| How we built it | "How WebMCP was implemented" below, plus the stack | **4** |
| **Privacy model, honestly** *(added)* | The claimed/not-claimed pair from `04-privacy-model.md` | — |
| Challenges we ran into | **Written on day 4 from what actually happened** | — |
| Accomplishments that we're proud of | The zero-counter run and capability withdrawal | — |
| What we learned | **Written on day 4** | — |
| What's next for Airlock | Roadmap below | — |

The two added headings sit where they do on purpose. "Why WebMCP" comes straight after
"What it does", because a reader who has just understood the product is at the exact
moment where the question forms. "Privacy model, honestly" comes after the implementation,
because stating the limits carries more weight once the reader has seen that the thing
works.

`Challenges` and `What we learned` are deliberately left empty until the build is done.
Inventing them now would produce the generic filler the challenge FAQ specifically warns
against, and the real ones will be better: no portable `unregisterTool`, `DOMException`
on duplicate tool names under Strict Mode, DuckDB-Wasm inside a static export, and the
gap between a tool that works and a tool description a model can actually act on.

### Drafts for the sections that are writable now

`Accomplishments`: a full gender pay-gap review completed with the disclosure counter
reading zero; a permission model built out of tool lifetime rather than tool logic, so a
revoked capability disappears from `getTools()` instead of merely refusing; one tool
registry serving three consumers with no duplicated handler.

`What's next`: server-side release logging for organisations that need the audit trail to
outlive the tab; OPFS persistence so a session survives a reload; the threaded `coi`
DuckDB bundle behind cross-origin isolation for larger files; a shared policy file a
compliance team can author once and distribute; and query-budget accounting to blunt the
reconstruction attack the privacy model openly does not defend against today.

## Written description

### Elevator

**Airlock is an analytics workspace where an AI agent can do the whole analysis without
ever seeing the data.**

You open a payroll export, a patient extract, a transaction ledger — a file your policy
forbids you from pasting into a hosted model. It loads into DuckDB inside your browser
tab and stays there. The agent gets sixteen WebMCP tools: schema inspection, column
profiling, guarded SQL, chart authoring, findings. Those tools return statistics and
aggregates. They cannot return a row. When the agent genuinely needs individual records
it must ask, in writing, and you see the exact rows before you decide. A counter in the
header shows how many individual data values have crossed the boundary this session.

A full gender pay-gap review completes with that counter reading zero.

### Why this use case is a strong fit for WebMCP

Because the alternative architectures cannot express it.

A remote MCP server has no access to the file — it was opened from disk into a browser
tab. To give a server-side tool access you must upload it, and uploading is exactly the
act the product exists to prevent. A screen-reading agent is worse: it sees the rendered
rows, so every value enters the model's context and the boundary is gone on contact.

WebMCP is the only mechanism where the code that touches the data and the code that
decides what the model receives are the same code, running in the page, under the user's
control. `execute` is the choke point. An aggregate crosses; a row does not.

And because there is no portable `unregisterTool`, the `AbortSignal` lifecycle turns out
to be the right primitive for a permission model. When the user forbids raw-row requests,
Airlock aborts that tier's controller and `request_raw_rows` stops being advertised at
all. The agent cannot be talked into calling a tool it cannot see. That is a capability
boundary, not a filter, and the page-scoped tool lifecycle is what makes it possible.

### How it creates a better user experience

The analyst gets model-quality help on data that previously admitted none. Not a
degraded, redacted, hedged version of the help — the agent writes the SQL, controls for
the confounders, renders the charts and drafts the finding. It simply does that from
schemas and aggregates, which is what the analysis actually required.

The interaction is co-editing rather than chat. Agent output lands in the same notebook
as the human's, marked with an agent badge, linked to the tool call that produced it,
undoable individually. Every call renders in an audit panel while it is still running, so
the human watches the work rather than receiving a summary of it.

And the compliance question that normally has no answer — "what did the AI see?" — has a
number, an itemised log, and a per-release approval record, produced as a by-product of
ordinary use.

### What people and agents can do together that was difficult or impossible before

**Analysis without disclosure.** Completing a real, deliverable analysis on a restricted
dataset with a hosted model, and being able to prove afterwards that zero individual
values were disclosed. There is no way to do this today.

**Shared visual context.** The user highlights three bars on a chart and asks "why
these?". `get_active_selection` returns the live selection — dataset, filter, series,
notebook cursor — so the agent resolves the reference without the user describing it. A
tool running on a server has no concept of what the user is currently looking at. This is
collaboration over shared state rather than request and response.

**Negotiated disclosure.** The agent finds an outlier, needs eight rows, and asks in
writing. The human sees the justification, the SQL, the exact values and the running
total, then releases four columns and redacts the rest. Both parties know precisely what
was shared. Nothing on the web offers this.

### How WebMCP was implemented

Sixteen tools in a single registry at `lib/webmcp/registry.ts`, registered through
`document.modelContext.registerTool()` with `navigator.modelContext` as the fallback for
Chrome 146–149, behind feature detection.

The tools sit in four tiers, each owned by its own `AbortController`. Tier 0 is
orientation and is registered for the page's lifetime. Tiers 1 and 2 — inspection, guarded
query, chart and finding authoring — register when a dataset loads and abort when the
last one is removed. Tier 3 holds the single row-releasing tool and registers only while
the privacy policy permits it. The result is a tool surface that visibly changes as the
user works, which a panel in the UI renders live.

Input schemas are generated from Zod so the advertised JSON Schema and the enforced
validation are the same object. Since the browser does not validate `inputSchema` before
calling `execute`, every handler re-validates. Handlers resolve a structured
`{ ok, summary, data }` or `{ ok, error, message, hint }` envelope rather than throwing,
so a rejected query gives the agent something to act on instead of ending its turn.

The same registry drives an optional in-page agent through a thin adapter that maps it to
the OpenAI tool-calling shape — one tool definition, three consumers: external WebMCP
agents, the in-page agent, and the scripted demo.

## Video script — 2:45

Recorded in Chrome with the flag on, screen only, one take per act.

**0:00–0:20 — the problem.** Payroll CSV visible in Finder. "This is a payroll export. I
am not allowed to upload it to ChatGPT. So I can't get any help with it." Drag it into
Airlock. Columns appear with classification chips. "It loaded into DuckDB in this tab.
Watch the network panel — nothing left the machine."

**0:20–0:50 — the agent works.** "Is there a gender pay gap?" Tool calls stream into the
audit panel: `describe_dataset`, `profile_column`, `run_query`. A chart materialises in
the notebook mid-sentence. "It's writing the SQL and controlling for grade. But look at
what it's getting back — medians and counts. Never a row."

**0:50–1:15 — the wall.** "Show me the individual salaries." `run_query` fails with
`too_many_rows`. "That isn't a policy setting. `run_query` structurally cannot return a
row."

**1:15–1:55 — the airlock.** The agent finds outliers and calls `request_raw_rows`. Dialog
opens. Read the agent's justification aloud. "Eight rows, four columns. I can see exactly
what it's asking for." Toggle `employee_id` off. Release. Counter moves 0 → 24. "Now it
has them, and there's a permanent record that I approved it."

**1:55–2:20 — capability withdrawal.** Open the policy editor, disable raw requests. Cut
to the registered-tools panel: `request_raw_rows` disappears. "That's the `AbortSignal`
lifecycle. The tool isn't disabled — it's unregistered. The agent can't ask for something
it can't see."

**2:20–2:45 — close.** Scroll the finished notebook: charts, findings, the released-rows
block with its approval stamp. Header counter reads 24. "A complete pay-gap review, on a
file that couldn't leave the building, with an exact record of what the model saw. That's
only possible because the tools run in the page."

Notes: no talking-head, no logo animation, no music bed under speech. Every number on
screen is real. The tool cards and the counter carry the story, so the recording must be
legible at 1080p — zoom the panels rather than showing the full desktop.

## README structure

The README is scored directly, since judges may not run anything. Order matters.

1. One-line description and the live URL.
2. **The 60-second demo path**, numbered, assuming zero context.
3. A screenshot or GIF of the release dialog with the counter visible. This one image
   communicates the whole idea.
4. "Why WebMCP" — three paragraphs, the same argument as above.
5. "How WebMCP is implemented" with the actual `registerTool` call inlined, since the
   challenge looks for it.
6. The tool table: name, tier, read-only, one-line purpose.
7. The privacy model, including the honest limitations.
8. Local development.
9. Repository map.
10. License.
