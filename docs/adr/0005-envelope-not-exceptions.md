# ADR-0005 — Tools resolve a result envelope instead of throwing

**Status:** accepted · 2026-08-30

## Context

Anything thrown inside `execute` propagates to the calling agent as a tool-call error.
Most agent runtimes treat that as a failure of the turn rather than as information, and
the model frequently gives up or retries the identical call.

Airlock rejects calls constantly and by design: queries that would return raw rows,
groups below the k-anonymity threshold, columns the policy blocks, releases the human
denied. Rejection is the normal operating mode, not an exception.

## Decision

Every handler resolves one of two shapes and never throws for an expected condition:

```ts
{ ok: true,  summary: string, data: unknown }
{ ok: false, error: ErrorCode, message: string, hint?: string }
```

Only genuine programming errors are allowed to reject.

## Rationale

- A rejection carrying `error: 'too_many_rows'` and `hint: 'aggregate, or call
  request_raw_rows with a justification'` is a usable instruction. A thrown exception is a
  dead end.
- `summary` gives the model a readable first field. Agents that surface raw tool output to
  the user get something sensible without any client-side rendering, and models reliably
  read the first field of a result.
- A closed set of error codes makes the eval suite meaningful: eval 7 asserts that the
  agent reads the hint and adapts, which is only testable if the hint is structured.

## Consequences

- `ok: false` is not an error at the transport layer, so the audit log distinguishes
  refusals from failures itself rather than relying on the browser to.
- Handlers need `try`/`catch` around DuckDB calls to convert engine errors into
  `engine_error` envelopes.
- `lib/tools/result.ts` provides `ok()` and `fail()` so the shape cannot drift between
  sixteen handlers.
