import { DISCOVERY_TOOLS } from "@/lib/tools/discovery";
import { INSPECTION_TOOLS } from "@/lib/tools/inspection";
import type { AnyAirlockTool, Tier } from "@/lib/webmcp/types";

/**
 * Every Airlock tool, in one place.
 *
 * This array is the single source of truth for three consumers: external agents over
 * WebMCP, the optional in-page agent, and the scripted demo. Adding a tool here gives it
 * to all three with no second implementation to keep in sync.
 */
export const AIRLOCK_TOOLS: AnyAirlockTool[] = [
  ...DISCOVERY_TOOLS,
  ...INSPECTION_TOOLS,
];

export function toolsForTiers(active: Set<Tier>): AnyAirlockTool[] {
  return AIRLOCK_TOOLS.filter((tool) => active.has(tool.tier));
}

export function toolsByTier(tier: Tier): AnyAirlockTool[] {
  return AIRLOCK_TOOLS.filter((tool) => tool.tier === tier);
}
