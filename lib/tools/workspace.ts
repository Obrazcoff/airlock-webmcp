import { z } from "zod";

import { runGuardedQuery } from "@/lib/duckdb/runQuery";
import { fail, ok } from "@/lib/tools/result";
import {
  blockedColumns,
  columnClassifications,
  datasets as datasetState,
} from "@/lib/store/datasets";
import { notebook } from "@/lib/store/notebook";
import { policy } from "@/lib/store/policy";
import type { AnyAirlockTool, ToolResult } from "@/lib/webmcp/types";
import type { ChartBlockData, FindingBlockData } from "@/lib/store/notebook";

const Mark = z.enum(["bar", "line", "area", "point"]);

const AddChartInput = z.strictObject({
  title: z.string().min(1),
  sql: z.string().min(1),
  mark: Mark,
  x: z.string().min(1),
  y: z.string().min(1),
  color: z.string().optional(),
  facet: z.string().optional(),
  caption: z.string().optional(),
});

const AddFindingInput = z.strictObject({
  title: z.string().min(1),
  body_markdown: z.string().min(1),
  severity: z.enum(["info", "watch", "material"]),
  evidence_block_ids: z.array(z.string()).default([]),
});

const BlockIdInput = z.strictObject({
  block_id: z.string().uuid(),
});

const UpdateBlockInput = z.strictObject({
  block_id: z.string().uuid(),
  title: z.string().optional(),
  body_markdown: z.string().optional(),
  caption: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

async function queryForWorkspace(sql: string): Promise<ToolResult & { rows?: Record<string, unknown>[]; columns?: string[] }> {
  const primary = datasetState().datasets[0];
  if (!primary) {
    return fail("not_found", "No dataset is loaded.", "Call load_sample_dataset first.");
  }

  const { maxPreviewRows, kAnonymityThreshold } = policy();
  return runGuardedQuery(sql, {
    maxPreviewRows,
    kThreshold: kAnonymityThreshold,
    classifications: columnClassifications(primary),
    blockedColumns: blockedColumns(primary),
  });
}

const addChart: AnyAirlockTool = {
  tier: 2,
  name: "add_chart",
  description:
    "Append a chart to the shared notebook. The SQL runs through the same guarded pipeline " +
    "as run_query, so a chart cannot show what a query cannot return. The human sees the " +
    "chart appear while the agent is still working — use this for the main analytical beats.",
  input: AddChartInput,
  readOnly: false,
  async execute(input) {
    const query = await queryForWorkspace(input.sql);
    if (!query.ok) return query;

    const data = query.data as {
      columns: string[];
      rows: Record<string, unknown>[];
    };

    const payload: ChartBlockData = {
      type: "chart",
      title: input.title,
      caption: input.caption,
      mark: input.mark,
      x: input.x,
      y: input.y,
      color: input.color,
      sql: input.sql,
      columns: data.columns,
      rows: data.rows,
    };

    const block = notebook().addBlock(payload);

    return ok(`Chart "${input.title}" added to the notebook.`, {
      block_id: block.id,
      row_count: data.rows.length,
    });
  },
};

const addFinding: AnyAirlockTool = {
  tier: 2,
  name: "add_finding",
  description:
    "Write a conclusion into the notebook as a finding block — info, watch, or material. " +
    "This is how the agent records what it learned in the shared document instead of chat.",
  input: AddFindingInput,
  readOnly: false,
  async execute(input) {
    const payload: FindingBlockData = {
      type: "finding",
      title: input.title,
      body_markdown: input.body_markdown,
      severity: input.severity,
      evidence_block_ids: input.evidence_block_ids,
    };

    const block = notebook().addBlock(payload);

    return ok(`Finding "${input.title}" added (${input.severity}).`, { block_id: block.id });
  },
};

const removeBlock: AnyAirlockTool = {
  tier: 2,
  name: "remove_block",
  description: "Remove a block from the notebook by id. Undoable from the audit log.",
  input: BlockIdInput,
  readOnly: false,
  async execute({ block_id }) {
    const blocks = notebook().blocks;
    if (!blocks.some((block) => block.id === block_id)) {
      return fail("not_found", `Unknown block: ${block_id}`);
    }
    notebook().removeBlock(block_id);
    return ok(`Removed block ${block_id}.`, { block_id });
  },
};

const updateBlock: AnyAirlockTool = {
  tier: 2,
  name: "update_block",
  description:
    "Update a notebook block's title, body, caption, or position. Use when the human " +
    "pushes back and the agent revises its work.",
  input: UpdateBlockInput,
  readOnly: false,
  async execute({ block_id, position, ...patch }) {
    const block = notebook().blocks.find((entry) => entry.id === block_id);
    if (!block) {
      return fail("not_found", `Unknown block: ${block_id}`);
    }

    notebook().updateBlock(block_id, patch, position);
    return ok(`Updated block ${block_id}.`, { block_id });
  },
};

export const WORKSPACE_TOOLS: AnyAirlockTool[] = [
  addChart,
  addFinding,
  updateBlock,
  removeBlock,
];
