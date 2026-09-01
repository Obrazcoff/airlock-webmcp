"use client";

import type { AuditEntry } from "@/lib/store/audit";

export function ToolLogPanel({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Tool calls will appear here as the demo runs — every action visible, nothing hidden.
      </p>
    );
  }

  return (
    <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-neutral-200">{entry.tool}</span>
            <span className="text-neutral-600">
              {entry.duration_ms != null ? `${entry.duration_ms}ms` : "…"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 ${
                entry.read_only
                  ? "bg-neutral-800 text-neutral-400"
                  : "bg-amber-500/15 text-amber-200"
              }`}
            >
              {entry.read_only ? "read-only" : "mutates"}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 ${
                entry.status === "ok"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : entry.status === "fail"
                    ? "bg-rose-500/15 text-rose-300"
                    : "bg-neutral-800 text-neutral-400"
              }`}
            >
              {entry.status}
            </span>
          </div>
          {(entry.summary || entry.error) && (
            <p className="mt-2 leading-relaxed text-neutral-400">
              {entry.summary ?? entry.error}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
