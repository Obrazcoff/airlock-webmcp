import type { ZodType } from "zod";

/**
 * Registration tier. Each tier is owned by an AbortController whose lifetime matches an
 * application condition, which is how tool lifetime doubles as the permission model.
 * See docs/adr/0003-abortsignal-tiers.md.
 */
export type Tier = 0 | 1 | 2 | 3;

export const TIER_LABELS: Record<Tier, string> = {
  0: "Always available",
  1: "Requires a loaded dataset",
  2: "Requires a loaded dataset",
  3: "Requires permission for raw rows",
};

export type ToolErrorCode =
  | "invalid_input"
  | "not_found"
  | "query_rejected"
  | "too_many_rows"
  | "policy_blocked"
  | "k_suppressed"
  | "denied_by_user"
  | "engine_error";

export type ToolSuccess = {
  ok: true;
  /** One-line natural-language rendering of the result. Agents that surface raw tool
   * output get something readable without any client-side formatting, and models
   * reliably read the first field. */
  summary: string;
  data?: unknown;
};

export type ToolFailure = {
  ok: false;
  error: ToolErrorCode;
  message: string;
  /** What the agent should do instead. This field is why refusals are useful rather than
   * dead ends. */
  hint?: string;
};

export type ToolResult = ToolSuccess | ToolFailure;

export interface AirlockTool<Input = unknown> {
  tier: Tier;
  name: string;
  description: string;
  /** Single source of truth for both the advertised JSON Schema and the runtime
   * validation, so the two cannot drift. */
  input: ZodType<Input>;
  /** Maps to annotations.readOnlyHint. False for anything that mutates the workspace or
   * moves the airlock meter, even when it discloses nothing. */
  readOnly: boolean;
  execute(input: Input): Promise<ToolResult>;
}

/**
 * A tool of unknown input shape. `unknown` will not do: Input is contravariant in
 * `execute`, so a concretely-typed tool is not assignable to `AirlockTool<unknown>`. The
 * registry is heterogeneous by nature and each handler validates its own input at
 * runtime, so the looseness is confined to the collection type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAirlockTool = AirlockTool<any>;

/** Spec regex for tool names: [A-Za-z0-9_\-.]{1,128} */
export const TOOL_NAME_PATTERN = /^[A-Za-z0-9_\-.]{1,128}$/;
