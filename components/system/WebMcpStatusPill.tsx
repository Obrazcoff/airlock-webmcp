"use client";

import type { WebMcpStatus } from "@/lib/webmcp/modelContext";

const COPY: Record<WebMcpStatus, { label: string; detail: string; tone: string }> = {
  ready: {
    label: "WebMCP connected",
    detail: "Tools are registered and discoverable by an agent on this page.",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  unsupported: {
    label: "WebMCP not detected",
    detail:
      "Open this page in ChatGPT's in-app browser, or in Chrome 149+ with chrome://flags/#enable-webmcp-testing enabled. Everything else on this page still works.",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  "insecure-context": {
    label: "Insecure context",
    detail:
      "WebMCP requires HTTPS or localhost. A plain http:// LAN address will not expose document.modelContext.",
    tone: "border-red-500/40 bg-red-500/10 text-red-300",
  },
  server: {
    label: "Checking…",
    detail: "",
    tone: "border-neutral-700 bg-neutral-800/60 text-neutral-400",
  },
};

export function WebMcpStatusPill({
  status,
  toolCount,
}: {
  status: WebMcpStatus;
  toolCount: number;
}) {
  const { label, detail, tone } = COPY[status];

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tone}`} title={detail}>
      <span className="font-medium">{label}</span>
      {status === "ready" && (
        <span className="ml-2 opacity-80">
          {toolCount} tool{toolCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
