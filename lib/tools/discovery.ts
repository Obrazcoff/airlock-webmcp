import { z } from "zod";

import { loadCsvFromUrl } from "@/lib/duckdb/loader";
import { fail, ok } from "@/lib/tools/result";
import { datasets, useDatasetStore } from "@/lib/store/datasets";
import { notebook } from "@/lib/store/notebook";
import { policy } from "@/lib/store/policy";
import type { AirlockTool, AnyAirlockTool } from "@/lib/webmcp/types";

const Empty = z.strictObject({});

const SAMPLES = {
  payroll_2026: {
    url: "/data/payroll-sample.csv",
    table: "payroll",
    name: "Payroll export 2026 (synthetic)",
  },
} as const;

const getWorkspaceState: AirlockTool<Record<string, never>> = {
  tier: 0,
  name: "get_workspace_state",
  description:
    "Return what is currently loaded and on screen: datasets with row counts, the " +
    "active privacy settings, and how many individual data values have been released " +
    "to an agent this session. Call this first to orient yourself before any other " +
    "tool. Read-only and cheap.",
  input: Empty,
  readOnly: true,
  async execute() {
    const { datasets: loaded } = datasets();
    const { rawRequestsEnabled, kAnonymityThreshold, maxPreviewRows, cellsReleased } = policy();

    return ok(
      loaded.length === 0
        ? "No dataset is loaded yet. Call load_sample_dataset to start with the sample payroll export."
        : `${loaded.length} dataset(s) loaded; ${cellsReleased} individual values released this session.`,
      {
        datasets: loaded.map((d) => ({
          id: d.id,
          name: d.name,
          row_count: d.rowCount,
          column_count: d.columns.length,
        })),
        blocks: notebook().blocks.map((block) => ({
          id: block.id,
          type: block.payload.type,
          title:
            block.payload.type === "finding"
              ? block.payload.title
              : block.payload.type === "chart"
                ? block.payload.title
                : block.payload.title,
        })),
        policy: {
          raw_row_requests_enabled: rawRequestsEnabled,
          k_anonymity_threshold: kAnonymityThreshold,
          max_preview_rows: maxPreviewRows,
        },
        cells_released: cellsReleased,
      },
    );
  },
};

const listDatasets: AirlockTool<Record<string, never>> = {
  tier: 0,
  name: "list_datasets",
  description:
    "List the datasets loaded in this browser tab with their ids, row counts, source " +
    "filenames and load times. Column names are deliberately not included; use " +
    "describe_dataset for the schema so an orientation call does not pull one it does " +
    "not need.",
  input: Empty,
  readOnly: true,
  async execute() {
    const { datasets: loaded } = datasets();

    if (loaded.length === 0) {
      return ok("No datasets are loaded.", { datasets: [] });
    }

    return ok(`${loaded.length} dataset(s) loaded.`, {
      datasets: loaded.map((d) => ({
        id: d.id,
        name: d.name,
        source: d.source,
        row_count: d.rowCount,
        column_count: d.columns.length,
        loaded_at: d.loadedAt,
      })),
    });
  },
};

const LoadSampleInput = z.strictObject({
  id: z
    .enum(["payroll_2026"])
    .describe("Identifier of the bundled sample dataset to load."),
});

const loadSampleDataset: AirlockTool<z.infer<typeof LoadSampleInput>> = {
  tier: 0,
  name: "load_sample_dataset",
  description:
    "Load a bundled synthetic dataset into the workspace so there is something to " +
    "analyse. 'payroll_2026' is a 4,000-row HR payroll export with salary, grade, " +
    "department, gender, tenure and free-text notes. Loading a dataset also makes the " +
    "inspection and query tools available, which are not registered on an empty " +
    "workspace.",
  input: LoadSampleInput,
  readOnly: false,
  async execute({ id }) {
    const sample = SAMPLES[id];
    if (!sample) {
      return fail("not_found", `Unknown sample dataset: ${id}`);
    }

    const store = useDatasetStore.getState();
    store.setLoading(sample.name);
    store.setError(null);

    try {
      const dataset = await loadCsvFromUrl(sample.url, sample.table, sample.name);
      useDatasetStore.getState().addDataset(dataset);

      return ok(
        `Loaded ${dataset.name}: ${dataset.rowCount.toLocaleString()} rows, ${dataset.columns.length} columns. Call describe_dataset for the schema.`,
        {
          dataset_id: dataset.id,
          row_count: dataset.rowCount,
          columns: dataset.columns.map((c) => c.name),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      useDatasetStore.getState().setError(message);
      return fail("engine_error", `Could not load the sample dataset: ${message}`);
    } finally {
      useDatasetStore.getState().setLoading(null);
    }
  },
};

const getActiveSelection: AnyAirlockTool = {
  tier: 0,
  name: "get_active_selection",
  description:
    "Return what the human is looking at right now: focused dataset, selected chart, " +
    "highlighted series, active filter, or selected notebook text. Call this when the " +
    "user points at something on screen ('why these?', 'explain this bar'). Read-only.",
  input: Empty,
  readOnly: true,
  async execute() {
    return ok("Nothing is selected in the UI yet.", {
      empty: true,
      dataset_id: null,
      block_id: null,
      series: null,
      filter_sql: null,
      selected_text: null,
    });
  },
};

export const DISCOVERY_TOOLS: AnyAirlockTool[] = [
  getWorkspaceState,
  listDatasets,
  getActiveSelection,
  loadSampleDataset,
];
