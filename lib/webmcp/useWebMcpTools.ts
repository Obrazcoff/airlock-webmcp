"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { getModelContext, getWebMcpStatus, type WebMcpStatus } from "@/lib/webmcp/modelContext";
import { toolsForTiers } from "@/lib/webmcp/registry";
import { toJsonSchema } from "@/lib/webmcp/toJsonSchema";
import { fail } from "@/lib/tools/result";
import type { AnyAirlockTool, Tier } from "@/lib/webmcp/types";

/**
 * Wrap an Airlock tool as a WebMCP descriptor.
 *
 * Two things happen at this boundary. Input is re-validated, because the browser does not
 * check inputSchema before calling execute and a malformed call would otherwise reach the
 * handler. And expected failures are converted into resolved envelopes rather than thrown
 * exceptions, so a refusal gives the agent something to act on instead of ending its
 * turn. See docs/adr/0005-envelope-not-exceptions.md.
 */
function toDescriptor(tool: AnyAirlockTool): ModelContextTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: toJsonSchema(tool.input),
    annotations: { readOnlyHint: tool.readOnly },
    async execute(rawInput) {
      const parsed = tool.input.safeParse(rawInput ?? {});

      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ");
        return fail(
          "invalid_input",
          `Input did not match the schema for ${tool.name}. ${detail}`,
          "Correct the arguments and call the tool again.",
        );
      }

      try {
        return await tool.execute(parsed.data);
      } catch (error) {
        return fail(
          "engine_error",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}

// WebMCP availability is fixed for the lifetime of the document: the flag, the token and
// the secure context are all decided before the page runs. So there is nothing to
// subscribe to, and useSyncExternalStore is here purely to read a browser-only value
// without writing state from an effect.
const noSubscribe = () => () => {};
const serverSnapshot = (): WebMcpStatus => "server";

/**
 * Register the tools for the currently active tiers, and deregister them when the tier
 * set changes.
 *
 * One AbortController per active tier set. Aborting tears down every registration
 * atomically, which is the only path that works across all Chrome versions shipping
 * WebMCP, and it is also what makes revoking a capability real: the tool stops being
 * advertised rather than merely refusing.
 *
 * The cleanup is not optional. React Strict Mode double-invokes effects in development,
 * and registerTool throws a DOMException on a duplicate name.
 */
export function useWebMcpTools(activeTiers: Set<Tier>) {
  const status = useSyncExternalStore(noSubscribe, getWebMcpStatus, serverSnapshot);

  const tierKey = useMemo(() => [...activeTiers].sort().join(","), [activeTiers]);

  // Derived, not stored. Which tools are registered is a pure function of availability
  // and the active tier set, so keeping it in state would only create a way for the two
  // to disagree.
  const tools = useMemo(() => {
    if (status !== "ready") return [];
    const tiers = new Set(
      tierKey.length > 0 ? tierKey.split(",").map((tier) => Number(tier) as Tier) : [],
    );
    return toolsForTiers(tiers);
  }, [status, tierKey]);

  useEffect(() => {
    if (tools.length === 0) return;

    const modelContext = getModelContext();
    if (!modelContext) return;

    const controller = new AbortController();
    for (const tool of tools) {
      modelContext.registerTool(toDescriptor(tool), { signal: controller.signal });
    }

    return () => controller.abort();
  }, [tools]);

  return { status, registered: tools.map((tool) => tool.name) };
}
