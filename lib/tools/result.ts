import type { ToolErrorCode, ToolFailure, ToolSuccess } from "@/lib/webmcp/types";

export function ok(summary: string, data?: unknown): ToolSuccess {
  return data === undefined ? { ok: true, summary } : { ok: true, summary, data };
}

export function fail(
  error: ToolErrorCode,
  message: string,
  hint?: string,
): ToolFailure {
  return hint === undefined
    ? { ok: false, error, message }
    : { ok: false, error, message, hint };
}
