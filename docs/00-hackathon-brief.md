# 00 — Hackathon brief

Source of truth for what the WebMCP Challenge actually requires. Everything else in
`docs/` exists to satisfy something on this page.

## The event

| | |
|---|---|
| Event | The WebMCP Challenge, hosted by OpenAI, managed by Devpost |
| Submission window | Aug 25, 2026 12:00 PDT → **Sep 3, 2026 13:00 PDT** |
| Deadline in our timezone | **Sep 3, 2026 22:00 CEST** |
| Judging | Sep 4 10:00 PDT → Sep 21 17:00 PDT |
| Results | Sep 23, 2026 |
| Prize pool | $35,000 cash, 10 winners at $3,000 (OpenAI) + $500 (Netlify) each, plus credits |
| Participants at time of writing | ~4,200 |

## Mandatory deliverables

1. **A working live URL.** Must function in ChatGPT's in-app browser, or in Google
   Chrome with WebMCP enabled. Authentication is permitted if credentials are supplied
   on the submission form. Airlock requires no authentication — see `07-deployment.md`.
2. **A public repository** on GitHub, GitLab or Bitbucket containing all source, assets
   and instructions needed to make the project functional. It must carry an
   **open-source license file that GitHub detects and displays in the About sidebar**.
   `LICENSE` at the repository root, MIT — done.
3. **A written description** covering four specific points:
   - why the use case is a strong fit for WebMCP;
   - how it creates a better user experience;
   - what people and agents can do together that was difficult or impossible before;
   - briefly, how WebMCP was implemented.
   Drafted in `08-submission.md`.
4. **A demo video** under 3 minutes, public on YouTube, **with audio**, showing the
   project working and explaining how WebMCP was used. Script in `08-submission.md`.
5. The repository is expected to contain a recognisable `registerTool` call. The
   challenge page shows the shape it looks for:

   ```js
   document.modelContext.registerTool({
     name: "search_products",
     description: "Search the product catalog",
     inputSchema: { /* ... */ },
     execute: async (input) => { /* ... */ },
   });
   ```

   Our equivalent lives in `lib/webmcp/registry.ts`, one entry per tool, with the
   registration loop in `lib/webmcp/useWebMcpTools.ts`.

## Judging criteria

Two stages. Stage one is a pass/fail viability review: does it fit the theme and does it
actually use the required API. Stage two scores four **equally weighted** criteria.

| Criterion | What it asks | How Airlock answers it |
|---|---|---|
| **WebMCP Leverage** | How thoroughly and skilfully is WebMCP used? Is the implementation non-trivial? | 16 tools across 4 registration tiers, with the tier set changing at runtime via `AbortController` as the user loads data and edits the privacy policy. Tool results are shaped for model consumption, not dumped JSON. See `03-tool-contract.md`. |
| **Execution** | A complete, coherent product — not a proof of concept | A usable analytics notebook that stands on its own with zero agent involvement. The agent makes it faster; it is not a prerequisite. |
| **Potential Impact** | A credible, specific case for a real problem and a real audience | Analysts holding data they are contractually or legally barred from pasting into a hosted model. Named, sized and evidenced in `01-product.md`. |
| **Creativity & Ambition** | Novelty versus existing concepts | The inversion: the agent is given capability without being given the data. Most submissions will expose tools that hand data to the model. Airlock's central tool refuses to, and the one that can is gated behind a human. |

## Rules that constrain how we work

- **New work only.** The project did not exist before Aug 25, so the entire repository
  is in-period work. First commit is dated inside the window; the git history is the
  evidence. No pre-existing code is imported.
- **Freeze at the deadline.** After Sep 3 13:00 PDT nothing may be edited: not the
  Devpost entry, not the repository, not the live site. Editing during judging risks
  disqualification. Our internal cutoff is 20:00 CEST, two hours early.
- **Public repo, no private-plus-invite path.** There is no option to keep the code
  private for this challenge.
- **AI assistance is explicitly allowed** for scaffolding, debugging, README drafting and
  edge-case brainstorming. It is explicitly discouraged for naming the project and for
  writing vague descriptions or overstating what runs.
- **Judges may not test the live app.** They are permitted to score from the description
  and repository alone. This makes `README.md` and the Devpost description
  first-class deliverables, not afterthoughts.

## Platform facts that shape the build

- WebMCP is a W3C Web Machine Learning Community Group **draft**, not a standard. The
  API has moved twice already (`window.agent` → `navigator.modelContext` →
  `document.modelContext`).
- Chrome ships it as an origin trial across **Chrome 149–156**. Local development uses
  `chrome://flags/#enable-webmcp-testing`. Our dev machine runs Chrome 152 stable, which
  is inside the window.
- ChatGPT's in-app browser supports WebMCP with no flag and no token.
- A **secure context is required**. `localhost` counts; plain `http://` on a LAN address
  does not.
- The browser does **not** validate `inputSchema` before invoking `execute`. Input
  validation is entirely the page's responsibility.
- There is no portable `unregisterTool`. Deregistration is done by aborting the
  `AbortSignal` passed at registration time.

## References

- Challenge overview and criteria — https://webmcp.devpost.com/
- Official rules — https://webmcp.devpost.com/rules
- Resources and FAQ — https://webmcp.devpost.com/resources
- WebMCP specification — https://webmachinelearning.github.io/webmcp/
- Specification repository — https://github.com/webmachinelearning/webmcp
- Chrome developer documentation — https://developer.chrome.com/docs/ai/webmcp/imperative-api
