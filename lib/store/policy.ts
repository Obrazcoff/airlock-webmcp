import { create } from "zustand";

interface PolicyState {
  /** Gates tier 3. When false the raw-row tool is not merely refused, it is unregistered,
   * so it disappears from the agent's tool list entirely. */
  rawRequestsEnabled: boolean;
  /** Groups smaller than this are suppressed in aggregate results. */
  kAnonymityThreshold: number;
  /** Individual data values released to an agent this session. Monotonic within a
   * session: a disclosure record you can decrement is not a disclosure record. */
  cellsReleased: number;
  setRawRequestsEnabled: (enabled: boolean) => void;
  setKAnonymityThreshold: (k: number) => void;
  recordRelease: (cells: number) => void;
}

export const usePolicyStore = create<PolicyState>((set) => ({
  rawRequestsEnabled: true,
  kAnonymityThreshold: 5,
  cellsReleased: 0,
  setRawRequestsEnabled: (rawRequestsEnabled) => set({ rawRequestsEnabled }),
  setKAnonymityThreshold: (kAnonymityThreshold) => set({ kAnonymityThreshold }),
  recordRelease: (cells) =>
    set((state) => ({ cellsReleased: state.cellsReleased + cells })),
}));

export const policy = () => usePolicyStore.getState();
