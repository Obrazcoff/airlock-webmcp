import { DISCOVERY_TOOLS } from "@/lib/tools/discovery";
import { AIRLOCK_TIER_TOOLS } from "@/lib/tools/airlock";
import { INSPECTION_TOOLS } from "@/lib/tools/inspection";
import { WORKSPACE_TOOLS } from "@/lib/tools/workspace";
import type { AnyAirlockTool, Tier } from "@/lib/webmcp/types";

/**
 * Every Airlock tool, in one place.
 */
export const AIRLOCK_TOOLS: AnyAirlockTool[] = [
  ...DISCOVERY_TOOLS,
  ...INSPECTION_TOOLS,
  ...WORKSPACE_TOOLS,
  ...AIRLOCK_TIER_TOOLS,
];

export function toolsForTiers(active: Set<Tier>): AnyAirlockTool[] {
  return AIRLOCK_TOOLS.filter((tool) => active.has(tool.tier));
}

export function toolsByTier(tier: Tier): AnyAirlockTool[] {
  return AIRLOCK_TOOLS.filter((tool) => tool.tier === tier);
}
