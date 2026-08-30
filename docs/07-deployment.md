# 07 — Deployment and browser enablement

## Target

Static export on Vercel. `next.config.ts` sets `output: 'export'`, so the build produces
plain files with no server component, no API route and no runtime. Nothing
Vercel-specific is used — the same `out/` directory would serve correctly from Cloudflare
Pages, Netlify or an S3 bucket. Worth stating in the README, because host-independence is
evidence for the "no backend" claim rather than a boast.

## Build

```bash
npm ci
npm run vendor:duckdb   # copies wasm + worker bundles from node_modules to public/duckdb
npm run build           # → out/
```

`vendor:duckdb` runs automatically as a `prebuild` hook so a Vercel build with no extra
configuration produces a complete artifact. The bundles are gitignored: they are large
binaries, and the script that produces them is the reproducible source of truth. This is
also what keeps the repository clone fast for a judge.

Vercel project settings: framework preset Next.js, build command `npm run build`, output
directory `out`, no environment variables. There are no secrets, because there is no
backend to hold one.

## Enabling WebMCP

Three access paths, in the order a judge is likely to take them.

### ChatGPT in-app browser — the primary path

WebMCP works out of the box. No flag, no token, no configuration. This is the path the
challenge itself recommends and the one the README should list first.

### Chrome with the testing flag

1. Chrome 149 or newer. Our development machine runs 152 stable, which is inside the
   Chrome 149–156 origin-trial window.
2. Open `chrome://flags/#enable-webmcp-testing`, set it to Enabled, relaunch.
3. Open the deployed URL. The status pill in the header turns green.

Optionally install Chrome's WebMCP Tool Inspector extension to browse the registered
tools and invoke them by hand. Handy for judges and essential for us — the DevTools
WebMCP panel shows each tool's name, description, schema and annotations exactly as an
agent receives them.

### Origin trial token — removes the flag requirement

Registering the deployed origin for the Chrome origin trial yields a token that enables
WebMCP for every visitor to that origin without any flag. Delivered as a meta tag in
`app/layout.tsx`:

```html
<meta http-equiv="origin-trial" content="TOKEN" />
```

Tokens are bound to a specific origin, so the production domain must be fixed before
registering. Register early — issuance is not instantaneous, and the whole point is to
remove a step for a judge who may not read the README.

**This is a nice-to-have, not a dependency.** The challenge explicitly tells judges to use
ChatGPT's in-app browser or the Chrome flag. If the token does not arrive in time, both
documented paths still work and nothing about the submission changes.

## Local development

```bash
npm run dev   # http://localhost:3000
```

`localhost` is a secure context, so WebMCP works locally with the flag on. A LAN address
over plain `http://` is not a secure context and `document.modelContext` will be
undefined there — a confusing failure worth knowing about before it costs an hour.

## Deployment sequence

Deploy on day one with a skeleton, not on the last day with a finished app. A broken
deploy discovered on September 3rd is an unrecoverable failure; discovered on August 30th
it is twenty minutes.

1. **Day 0.** Vercel project created and connected. A page that only feature-detects
   WebMCP and registers `get_workspace_state` deploys green. Confirm the tool is visible
   in the Inspector on the deployed HTTPS origin, not just on localhost. Register for the
   origin trial token against the final domain.
2. **Days 1–3.** Every push to `main` redeploys. Preview deployments for anything risky.
3. **Day 4, before the freeze.** Final production deploy, then the full pre-submission
   gate from `06-testing-and-evals.md` against the live URL in a clean browser profile.

## Freeze protocol

After the deadline nothing may be edited — not the repository, not the live site, not the
Devpost entry. Editing during judging risks eligibility.

Internal cutoff is **20:00 CEST on September 3rd**, two hours before the real deadline.
After that:

- Last commit pushed, last deploy promoted to production, deployment protection
  disabled so the URL is publicly reachable.
- Verify the production URL from a device that has never visited it.
- Verify the GitHub About sidebar shows the MIT license.
- Submit on Devpost, then stop.
- Any further work happens on a fork, as the rules explicitly permit.

## Deployment failure modes to check for explicitly

| Symptom | Cause | Fix |
|---|---|---|
| `document.modelContext` undefined on the deployed site but fine locally | Flag not enabled in that profile, or the page was served over plain HTTP | Enable the flag; confirm HTTPS |
| DuckDB 404s in production | `vendor:duckdb` did not run in the CI build | Confirm the `prebuild` hook; check the build log for the copy step |
| Worker fails to construct | Bundles being loaded from a CDN rather than same-origin | Self-hosted `/duckdb/` paths are what avoids this; verify the resolved URLs |
| `SharedArrayBuffer is not defined` | Something selected the `coi` bundle | We ship `eh` only. Confirm `selectBundle` is not being handed a `coi` entry |
| Blank page, no error | Static export tried to prerender a client-only module | The workspace must be imported via `next/dynamic` with `ssr: false` |
| `DOMException: duplicate tool name` | Strict Mode double-invoked the registration effect without aborting the previous controller | Abort in the effect's cleanup |
