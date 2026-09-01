import { AIRLOCK_TOOLS } from "@/lib/webmcp/registry";
import { audit } from "@/lib/store/audit";
import type { ToolResult } from "@/lib/webmcp/types";

export async function invokeTool(name: string, input: Record<string, unknown> = {}): Promise<ToolResult> {
  const tool = AIRLOCK_TOOLS.find((entry) => entry.name === name);
  if (!tool) {
    return { ok: false, error: "not_found", message: `Unknown tool: ${name}` };
  }

  const auditId = audit().start(name, tool.readOnly, input);

  try {
    const result = await tool.execute(input);
    audit().finish(auditId, {
      ok: result.ok,
      summary: result.ok ? result.summary : undefined,
      error: result.ok ? undefined : result.message,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    audit().finish(auditId, { ok: false, error: message });
    return { ok: false, error: "engine_error", message };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
