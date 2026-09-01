import { z } from "zod";

import {
  columnsMatchResult,
  countCells,
  rawRequestFingerprint,
} from "@/lib/airlock/rawRequest";
import { runRawRowPreview } from "@/lib/duckdb/runQuery";
import { sanitizeRows } from "@/lib/privacy/injectionGuard";
import { release } from "@/lib/store/release";
import {
  blockedColumns,
  columnClassifications,
  datasets as datasetState,
} from "@/lib/store/datasets";
import { notebook } from "@/lib/store/notebook";
import { policy } from "@/lib/store/policy";
import type { TableBlockData } from "@/lib/store/notebook";
import { fail, ok } from "@/lib/tools/result";
import type { AnyAirlockTool } from "@/lib/webmcp/types";

const RequestRawRowsInput = z.strictObject({
  sql: z.string().min(1),
  row_limit: z.number().int().min(1).max(50),
  columns: z.array(z.string().min(1)).min(1),
  justification: z.string().min(20),
});

function defaultRedactedColumns(
  columns: string[],
  classifications: Record<string, import("@/lib/privacy/types").ColumnClassification>,
): string[] {
  return columns.filter((column) => {
    const classification = classifications[column] ?? "measure";
    return (
      classification !== "identifier" &&
      classification !== "free_text" &&
      classification !== "sensitive"
    );
  });
}

const requestRawRows: AnyAirlockTool = {
  tier: 3,
  name: "request_raw_rows",
  description:
    "Request individual rows from the human through the airlock. The query is planned but " +
    "not returned until the human approves the exact rows in a modal. Use only when aggregates " +
    "and profile_column cannot answer the question. Do not re-ask for the same rows after a " +
    "denial. Prefer profile_column for distributions.",
  input: RequestRawRowsInput,
  readOnly: false,
  async execute(input) {
    if (!policy().rawRequestsEnabled) {
      return fail(
        "policy_blocked",
        "Raw row requests are disabled in the current policy.",
        "Ask the human to enable raw requests, or continue with aggregates.",
      );
    }

    const columnCheck = columnsMatchResult(input.columns, input.columns);
    if (!columnCheck.ok) {
      return fail("invalid_input", columnCheck.message);
    }

    const fingerprint = rawRequestFingerprint(input);
    if (release().wasDenied(fingerprint)) {
      return fail(
        "denied_by_user",
        "The human already denied this exact release request in this session.",
        "Continue the analysis without these rows; do not ask again.",
      );
    }

    const primary = datasetState().datasets[0];
    if (!primary) {
      return fail("not_found", "No dataset is loaded.", "Call load_sample_dataset first.");
    }

    const classifications = columnClassifications(primary);
    const blocked = blockedColumns(primary);

    const blockedRequested = input.columns.filter((column: string) => blocked.has(column));
    if (blockedRequested.length > 0) {
      return fail(
        "policy_blocked",
        `Column(s) blocked by policy: ${blockedRequested.join(", ")}.`,
        "Choose other columns or ask the human to unblock them in the policy editor.",
      );
    }

    const preview = await runRawRowPreview(input.sql, input.row_limit, input.columns);
    if (!preview.ok) return preview;

    const data = preview.data as {
      columns: string[];
      rows: Record<string, unknown>[];
      row_count: number;
    };

    const decision = await release().requestApproval({
      sql: input.sql,
      justification: input.justification,
      row_limit: input.row_limit,
      requested_columns: input.columns,
      preview: {
        columns: data.columns,
        rows: data.rows,
        classifications: Object.fromEntries(
          data.columns.map((column) => [column, classifications[column] ?? "measure"]),
        ),
      },
      session_cells_before: policy().cellsReleased,
    });

    if (decision.kind === "deny") {
      release().markDenied(fingerprint);
      release().addHistory({
        justification: input.justification,
        sql: input.sql,
        columns: input.columns,
        cells: 0,
        decision: "denied",
      });
      return fail(
        "denied_by_user",
        "The human denied this release request.",
        "Continue without the rows; do not re-ask for the same data.",
      );
    }

    const approvedColumns =
      decision.columns.length > 0
        ? decision.columns
        : defaultRedactedColumns(data.columns, classifications);

    if (approvedColumns.length === 0) {
      return fail(
        "denied_by_user",
        "No columns were approved for release.",
        "Try a different column set or continue with aggregates.",
      );
    }

    const approvedRows = data.rows.map((row) => {
      const next: Record<string, unknown> = {};
      for (const column of approvedColumns) {
        next[column] = row[column];
      }
      return next;
    });

    const { rows: sanitizedRows, injection_flags } = sanitizeRows(approvedRows);
    const cells = countCells(sanitizedRows.length, approvedColumns.length);

    policy().recordRelease(cells);

    const redactedMode =
      approvedColumns.length < data.columns.length ||
      approvedColumns.some(
        (column) =>
          classifications[column] === "identifier" ||
          classifications[column] === "sensitive" ||
          classifications[column] === "free_text",
      );

    const tablePayload: TableBlockData = {
      type: "table",
      title: "Released rows",
      sql: input.sql,
      justification: input.justification,
      columns: approvedColumns,
      rows: sanitizedRows,
      cells_released: cells,
      mode: redactedMode ? "redacted" : "full",
    };

    const block = notebook().addBlock(tablePayload);

    release().addHistory({
      justification: input.justification,
      sql: input.sql,
      columns: approvedColumns,
      cells,
      decision: redactedMode ? "released_redacted" : "released",
    });

    return ok(
      `Released ${sanitizedRows.length} row(s) × ${approvedColumns.length} column(s) (${cells} cells).`,
      {
        block_id: block.id,
        columns: approvedColumns,
        rows: sanitizedRows,
        cells_released: cells,
        injection_flags,
      },
    );
  },
};

export const AIRLOCK_TIER_TOOLS: AnyAirlockTool[] = [requestRawRows];
