import { create } from "zustand";

import type { ColumnClassification } from "@/lib/privacy/types";

export interface PolicySuggestion {
  id: string;
  dataset_id: string;
  column: string;
  proposed_classification: ColumnClassification;
  rationale: string;
  created_at: string;
}

interface PolicyState {
  rawRequestsEnabled: boolean;
  kAnonymityThreshold: number;
  /** Raw row previews through run_query. Zero is the default guarantee. */
  maxPreviewRows: number;
  cellsReleased: number;
  suggestions: PolicySuggestion[];
  setRawRequestsEnabled: (enabled: boolean) => void;
  setKAnonymityThreshold: (k: number) => void;
  setMaxPreviewRows: (rows: number) => void;
  recordRelease: (cells: number) => void;
  addSuggestion: (suggestion: Omit<PolicySuggestion, "id" | "created_at">) => PolicySuggestion;
}

export const usePolicyStore = create<PolicyState>((set) => ({
  rawRequestsEnabled: true,
  kAnonymityThreshold: 5,
  maxPreviewRows: 0,
  cellsReleased: 0,
  suggestions: [],
  setRawRequestsEnabled: (rawRequestsEnabled) => set({ rawRequestsEnabled }),
  setKAnonymityThreshold: (kAnonymityThreshold) => set({ kAnonymityThreshold }),
  setMaxPreviewRows: (maxPreviewRows) => set({ maxPreviewRows }),
  recordRelease: (cells) =>
    set((state) => ({ cellsReleased: state.cellsReleased + cells })),
  addSuggestion: (input) => {
    const suggestion: PolicySuggestion = {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    set((state) => ({ suggestions: [...state.suggestions, suggestion] }));
    return suggestion;
  },
}));

export const policy = () => usePolicyStore.getState();
