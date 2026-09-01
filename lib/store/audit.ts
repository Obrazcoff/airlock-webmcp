import { create } from "zustand";

export type AuditStatus = "pending" | "ok" | "fail";

export interface AuditEntry {
  id: string;
  tool: string;
  read_only: boolean;
  input: unknown;
  status: AuditStatus;
  summary?: string;
  error?: string;
  started_at: string;
  duration_ms?: number;
}

interface AuditState {
  entries: AuditEntry[];
  start: (tool: string, readOnly: boolean, input: unknown) => string;
  finish: (id: string, result: { ok: boolean; summary?: string; error?: string }) => void;
  clear: () => void;
}

export const useAuditStore = create<AuditState>((set) => ({
  entries: [],
  start: (tool, read_only, input) => {
    const id = crypto.randomUUID();
    const entry: AuditEntry = {
      id,
      tool,
      read_only,
      input,
      status: "pending",
      started_at: new Date().toISOString(),
    };
    set((state) => ({ entries: [entry, ...state.entries].slice(0, 50) }));
    return id;
  },
  finish: (id, result) =>
    set((state) => ({
      entries: state.entries.map((entry) => {
        if (entry.id !== id) return entry;
        const duration_ms = Date.now() - new Date(entry.started_at).getTime();
        return {
          ...entry,
          status: result.ok ? "ok" : "fail",
          summary: result.summary,
          error: result.error,
          duration_ms,
        };
      }),
    })),
  clear: () => set({ entries: [] }),
}));

export const audit = () => useAuditStore.getState();
