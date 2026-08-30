# 01 — Product

**Airlock — the agent analyses your private data without ever seeing it.**

## The problem

There is a large and growing category of data that an analyst cannot paste into a hosted
model, and the barrier is not squeamishness. It is a contract, a regulation, or an
internal policy with someone's signature on it.

- Payroll and compensation tables. HR shares them with a named list of people; uploading
  the file to a third party is a disclosure event.
- Patient-level clinical data. Re-identification risk is the entire reason de-identified
  extracts exist, and de-identification is done before the data leaves the institution.
- Bank transaction ledgers, KYC output, chargeback exports.
- Customer support transcripts, which contain PII in free text where no schema warns you.
- Anything a Data Processing Agreement lists by name.

The analyst holding that file has two options today. Do the work by hand, which is slow
and where the model would genuinely help. Or upload it and hope, which is the thing the
policy exists to prevent.

There is a third option that nobody has built, because until WebMCP the browser had no
way to offer it: **let the model direct the analysis without ever receiving the data**.

## The insight

An analyst asking a model for help does not actually need the model to read their rows.
They need it to know what columns exist, what the distributions look like, which cohorts
are worth comparing, what SQL answers the question, and how to read the result. All of
that is possible with schemas and aggregates.

Raw rows are needed occasionally — to sanity-check an outlier, to see why a join
produced nulls. But that is a rare, deliberate act, and it is exactly the kind of act
that deserves a human pressing a button.

So: give the agent the *capability* and withhold the *data*. Put a controlled opening
between the two and make every passage through it visible and counted. That opening is
the airlock, and it is what the product is named after.

## Why this needs WebMCP specifically

This is the part of the submission that has to be airtight, because a weak answer here
caps the WebMCP Leverage score.

A conventional remote MCP server cannot do this. **The server has no data.** The file was
opened from the analyst's disk into their browser tab. For a server-side tool to operate
on it, the file must first be uploaded — which is precisely the action the entire product
exists to avoid. The moment you upload, the guarantee is gone and the product is
pointless.

Screen-scraping agents cannot do it either. An agent driving the UI by reading pixels or
the accessibility tree *sees the rendered rows*. Every value on screen enters the model's
context. The privacy boundary does not survive contact with a vision model.

WebMCP is the only mechanism that gives all three properties at once:

1. **Execution happens inside the page**, where the data already lives, with the user's
   session and their in-memory DuckDB instance.
2. **The page controls the return value.** `execute` decides what crosses back. An
   aggregate can cross; a row can be refused. The agent cannot reach around the tool.
3. **The tool surface is dynamic.** `AbortController` lets the page withdraw a capability
   the instant the user revokes it, mid-session, with no reload.

Point 3 is what makes the privacy policy real rather than decorative. When the user
switches "allow raw row requests" off, the `request_raw_rows` tool is not merely
disabled — it stops being advertised. `getTools()` no longer lists it. The agent cannot
call a tool it cannot see.

## What people and agents can do together that was not possible before

Framed as three concrete beats, which double as the video's three acts.

1. **Analysis without disclosure.** The analyst opens a payroll export. The agent
   profiles it, proposes a cohort comparison, writes the SQL, renders the chart and
   drafts the finding. At the end of the session the airlock meter reads *0 raw cells
   released*. The work is done; the data never left the tab. This is not achievable with
   a hosted model today at any price.

2. **The agent picks up where the human is looking.** The analyst highlights three bars
   on a chart and types "why these?". `get_active_selection` returns the current
   selection — dataset, filter predicate, highlighted series, notebook cursor — so the
   agent resolves "these" without the human describing it. A server-side tool has no
   concept of what the user is currently looking at. This is collaboration on shared
   state, not request/response.

3. **Negotiated disclosure.** The agent hits a genuine outlier and needs eight actual
   rows. It calls `request_raw_rows` with a written justification. A modal shows the
   analyst the exact SQL, the exact rows, which columns are classified sensitive, and the
   session total. The analyst releases four columns and redacts the rest. The counter
   moves from 0 to 32 cells. Both parties know precisely what was disclosed, and there is
   a record. Nothing on the web offers this today.

## Target user

The primary user is an analyst inside a mid-size organisation who is technically capable
of writing SQL but does it slowly, and who works with at least one dataset covered by a
policy that forbids third-party upload. HR analytics, clinical operations, fraud and
risk, and internal audit are the four functions where this describes the median person.

Secondary user: a privacy or compliance officer who needs to answer "what did the AI
see?" and today has no mechanism to answer it. Airlock's audit log and airlock meter
produce a per-session disclosure record as a by-product of normal use.

## Scope for the hackathon build

The demo dataset is a **synthetic HR payroll export** — salary, grade, tenure, department,
manager, gender, age band, termination date — generated by a seeded script in
`scripts/generate-payroll.ts` and committed to the repository. Synthetic, but shaped like
the real thing, including a deliberately planted pay gap for the agent to find and one
data-quality trap.

The task the demo drives at is a **gender pay-gap review**: a real deliverable, legally
mandated in several jurisdictions, performed on exactly the kind of file that cannot be
uploaded. It gives the agent something substantive to do and gives the video a plot.

Users can also drop their own CSV or Parquet. Nothing in the product is specific to the
sample; the sample is a one-click starting point so a judge who spends ninety seconds
still sees the whole story.

## What this is not

- Not a chat wrapper around a SQL database.
- Not a BI tool with an AI button bolted on. The privacy boundary is the product; the
  notebook is the surface it needs in order to be useful.
- Not a claim of formal differential privacy. Airlock enforces column classification,
  k-anonymity suppression on profiles, aggregate-only query results and human-gated raw
  access. That is a strong, auditable practical boundary. It is not a mathematical
  guarantee against a determined adversary running adaptive queries, and
  `04-privacy-model.md` says so plainly rather than overselling it.
