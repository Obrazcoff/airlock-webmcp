# ADR-0003 — Tool lifetime as a permission model, via `AbortController` tiers

**Status:** accepted · 2026-08-30

## Context

WebMCP has no portable `unregisterTool`. Chrome 150 added one, but the `AbortSignal`
passed at registration is the only path that works across every version that ships the
API. This reads at first like a limitation to work around.

Separately, Airlock needs a permission model: the user must be able to forbid raw-row
requests, and that prohibition must be meaningful.

## Decision

Treat tool lifetime as the permission model. Group tools into four tiers, each owned by an
`AbortController` whose lifetime matches an application condition. When the condition
becomes false, abort the controller.

| Tier | Condition | Contents |
|---|---|---|
| 0 | Page mounted | Orientation |
| 1 | ≥ 1 dataset loaded | Inspection and query |
| 2 | ≥ 1 dataset loaded | Workspace mutation |
| 3 | Policy permits raw requests | `request_raw_rows` |

## Rationale

A tool that is registered but refuses is a filter. A tool that is not registered is a
capability boundary. The difference matters under adversarial pressure: prompt injection
can talk a model into calling a tool it should not, but it cannot conjure a tool that is
absent from `getTools()`.

It also removes an entire class of state bug. There is no "is this allowed right now?"
check to forget at the top of a handler, because the handler is unreachable.

And it makes the WebMCP integration visibly non-trivial. A submission that registers a
fixed list at page load has used the API; one whose tool surface reconfigures itself in
response to user intent has used the design of the API.

## Consequences

- Tools are grouped by lifetime rather than by topic, which is why tiers 1 and 2 share a
  controller despite differing in mutability.
- The registration effect must abort its previous controller in cleanup, or Strict Mode's
  double invocation throws `DOMException: duplicate tool name`.
- `RegisteredToolsPanel` renders the live set, so the mechanism is observable rather than
  merely described.
