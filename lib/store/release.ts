import { create } from "zustand";

import type { ColumnClassification } from "@/lib/privacy/types";

export type ReleaseDecision =
  | { kind: "release"; columns: string[] }
  | { kind: "deny" };

export interface ReleasePreview {
  columns: string[];
  rows: Record<string, unknown>[];
  classifications: Record<string, ColumnClassification>;
}

export interface PendingRelease {
  id: string;
  sql: string;
  justification: string;
  row_limit: number;
  requested_columns: string[];
  preview: ReleasePreview;
  session_cells_before: number;
}

export interface ReleaseRecord {
  id: string;
  at: string;
  justification: string;
  sql: string;
  columns: string[];
  cells: number;
  decision: "released" | "released_redacted" | "denied";
}

interface ReleaseState {
  pending: PendingRelease | null;
  deniedFingerprints: string[];
  history: ReleaseRecord[];
  /** Resolver for the in-flight human decision. Not persisted. */
  _resolver: ((decision: ReleaseDecision) => void) | null;
  requestApproval: (request: Omit<PendingRelease, "id">) => Promise<ReleaseDecision>;
  resolvePending: (decision: ReleaseDecision) => void;
  markDenied: (fingerprint: string) => void;
  wasDenied: (fingerprint: string) => boolean;
  addHistory: (record: Omit<ReleaseRecord, "id" | "at">) => void;
}

export const useReleaseStore = create<ReleaseState>((set, get) => ({
  pending: null,
  deniedFingerprints: [],
  history: [],
  _resolver: null,

  requestApproval: (request) =>
    new Promise<ReleaseDecision>((resolve) => {
      const id = crypto.randomUUID();
      set({
        pending: { ...request, id },
        _resolver: resolve,
      });
    }),

  resolvePending: (decision) => {
    const { _resolver, pending } = get();
    if (!_resolver || !pending) return;
    set({ pending: null, _resolver: null });
    _resolver(decision);
  },

  markDenied: (fingerprint) =>
    set((state) => ({
      deniedFingerprints: state.deniedFingerprints.includes(fingerprint)
        ? state.deniedFingerprints
        : [...state.deniedFingerprints, fingerprint],
    })),

  wasDenied: (fingerprint) => get().deniedFingerprints.includes(fingerprint),

  addHistory: (record) =>
    set((state) => ({
      history: [
        {
          ...record,
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
        },
        ...state.history,
      ].slice(0, 30),
    })),
}));

export const release = () => useReleaseStore.getState();
