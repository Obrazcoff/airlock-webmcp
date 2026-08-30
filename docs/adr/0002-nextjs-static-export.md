# ADR-0002 — Next.js with `output: 'export'`, zero server code

**Status:** accepted · 2026-08-30

## Context

Next.js on Vercel is the chosen stack. Next.js defaults to a server runtime: server
components, route handlers, middleware. Airlock needs none of it and is actively harmed
by its availability, because "there is no backend" is a claim a reviewer should be able to
verify rather than take on trust.

## Decision

`output: 'export'`. The build emits static files. No API routes, no server actions, no
middleware. The workspace is loaded through `next/dynamic` with `ssr: false`.

## Rationale

- The absence of server code is structural, not a convention someone could break in a
  later commit. A reviewer confirms it by reading `next.config.ts` and looking at `out/`.
- The artifact is host-independent. The same directory serves from Cloudflare Pages,
  Netlify, Render or an S3 bucket. Given that four of the challenge's sponsors are hosts,
  being demonstrably portable is worth more than being deeply integrated with one.
- No environment variables and no secrets, so no configuration step for a judge and no
  deployment state to get wrong.

## Consequences

- The BYOK agent calls `api.openai.com` directly from the browser. The key lives in
  `sessionStorage` and is never persisted. There is no proxy to hide it behind, which is a
  real tradeoff and is documented in the UI at the point the key is entered.
- The origin-trial token ships as a `<meta>` tag in the root layout rather than an HTTP
  header.
- No server-side logging. The audit trail is in-page only, and the product says so — for
  a real deployment, server-side logging of releases would be the obvious next step.
