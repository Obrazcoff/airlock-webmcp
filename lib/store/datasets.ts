import { create } from "zustand";

export interface DatasetColumn {
  name: string;
  sqlType: string;
}

export interface Dataset {
  id: string;
  name: string;
  source: string;
  rowCount: number;
  columns: DatasetColumn[];
  loadedAt: string;
}

interface DatasetState {
  datasets: Dataset[];
  loading: string | null;
  error: string | null;
  addDataset: (dataset: Dataset) => void;
  removeDataset: (id: string) => void;
  setLoading: (label: string | null) => void;
  setError: (message: string | null) => void;
}

export const useDatasetStore = create<DatasetState>((set) => ({
  datasets: [],
  loading: null,
  error: null,
  addDataset: (dataset) =>
    set((state) => ({
      datasets: [...state.datasets.filter((d) => d.id !== dataset.id), dataset],
    })),
  removeDataset: (id) =>
    set((state) => ({ datasets: state.datasets.filter((d) => d.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

/** Tool handlers run outside React, so they read the store directly rather than through
 * a hook. This is why the store is Zustand and not context. */
export const datasets = () => useDatasetStore.getState();
