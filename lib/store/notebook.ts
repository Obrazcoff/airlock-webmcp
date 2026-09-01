import { create } from "zustand";

export type BlockType = "chart" | "finding" | "table";

export type FindingSeverity = "info" | "watch" | "material";

export interface ChartBlockData {
  type: "chart";
  title: string;
  caption?: string;
  mark: "bar" | "line" | "area" | "point";
  x: string;
  y: string;
  color?: string;
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface FindingBlockData {
  type: "finding";
  title: string;
  body_markdown: string;
  severity: FindingSeverity;
  evidence_block_ids: string[];
}

export interface TableBlockData {
  type: "table";
  title: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export type BlockPayload = ChartBlockData | FindingBlockData | TableBlockData;

export interface NotebookBlock {
  id: string;
  position: number;
  author: "agent" | "human";
  created_at: string;
  payload: BlockPayload;
}

interface NotebookState {
  blocks: NotebookBlock[];
  addBlock: (payload: BlockPayload, author?: "agent" | "human") => NotebookBlock;
  updateBlock: (id: string, patch: Partial<BlockPayload>, position?: number) => void;
  removeBlock: (id: string) => void;
  clear: () => void;
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  blocks: [],
  addBlock: (payload, author = "agent") => {
    const block: NotebookBlock = {
      id: crypto.randomUUID(),
      position: get().blocks.length,
      author,
      created_at: new Date().toISOString(),
      payload,
    };
    set((state) => ({ blocks: [...state.blocks, block] }));
    return block;
  },
  updateBlock: (id, patch, position) =>
    set((state) => ({
      blocks: state.blocks.map((block) => {
        if (block.id !== id) return block;
        return {
          ...block,
          position: position ?? block.position,
          payload: { ...block.payload, ...patch } as BlockPayload,
        };
      }),
    })),
  removeBlock: (id) =>
    set((state) => ({
      blocks: state.blocks
        .filter((block) => block.id !== id)
        .map((block, index) => ({ ...block, position: index })),
    })),
  clear: () => set({ blocks: [] }),
}));

export const notebook = () => useNotebookStore.getState();
