export type WebMcpStatus =
  | "ready"
  | "unsupported"
  | "insecure-context"
  | "server";

/**
 * Resolve the WebMCP entry point.
 *
 * `document.modelContext` is the current location; `navigator.modelContext` was
 * deprecated in Chrome 150 but is all that Chrome 146-149 exposes. Calling registerTool
 * on an undefined context throws synchronously, so every caller must go through here.
 */
export function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;

  const context = document.modelContext ?? navigator.modelContext;
  if (!context || typeof context.registerTool !== "function") return null;

  return context;
}

/**
 * Why WebMCP is or is not available, in a form the status pill can render. The
 * insecure-context case is worth distinguishing: it looks identical to "unsupported"
 * from the API surface, but the fix is completely different and it is the failure people
 * hit when testing over a plain-http LAN address.
 */
export function getWebMcpStatus(): WebMcpStatus {
  if (typeof window === "undefined") return "server";
  if (getModelContext()) return "ready";
  if (!window.isSecureContext) return "insecure-context";
  return "unsupported";
}
