import { create } from "zustand";

import type { ColumnClassification } from "@/lib/privacy/types";
import type { ColumnProfileStats } from "@/lib/duckdb/profile";

export interface DatasetColumn {
  name: string;
  sqlType: string;
  classification: ColumnClassification;
  blocked?: boolean;
  stats?: ColumnProfileStats;
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
  updateDataset: (id: string, patch: Partial<Dataset>) => void;
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
  updateDataset: (id, patch) =>
    set((state) => ({
      datasets: state.datasets.map((dataset) =>
        dataset.id === id ? { ...dataset, ...patch } : dataset,
      ),
    })),
  removeDataset: (id) =>
    set((state) => ({ datasets: state.datasets.filter((d) => d.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

export const datasets = () => useDatasetStore.getState();

export function getDataset(id: string): Dataset | undefined {
  return datasets().datasets.find((dataset) => dataset.id === id);
}

export function columnClassifications(dataset: Dataset): Record<string, ColumnClassification> {
  return Object.fromEntries(
    dataset.columns.map((column) => [column.name, column.classification]),
  );
}

export function blockedColumns(dataset: Dataset): Set<string> {
  return new Set(dataset.columns.filter((column) => column.blocked).map((column) => column.name));
}
