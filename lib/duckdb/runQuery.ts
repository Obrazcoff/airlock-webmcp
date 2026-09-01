import { isAggregateQuery } from "@/lib/duckdb/aggregateGuard";
import { columnsMatchResult, rejectsSelectStar } from "@/lib/airlock/rawRequest";
import { connect } from "@/lib/duckdb/client";
import { checkSql } from "@/lib/duckdb/sqlGuard";
import { sanitizeRows } from "@/lib/privacy/injectionGuard";
import { suppressSmallGroups } from "@/lib/privacy/kAnonymity";
import { redactProjection } from "@/lib/privacy/redact";
import type { ColumnClassification } from "@/lib/privacy/types";
import { fail, ok } from "@/lib/tools/result";
import type { ToolResult } from "@/lib/webmcp/types";

export interface GuardedQueryOptions {
  maxPreviewRows: number;
  kThreshold: number;
  classifications: Record<string, ColumnClassification>;
  blockedColumns: ReadonlySet<string>;
  maxRows?: number;
}

export interface GuardedQueryData {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
  suppressed_groups: number;
  redacted_columns: string[];
  injection_flags: number;
}

function arrowRowToRecord(
  row: { toJSON: () => Record<string, unknown> },
  columns: string[],
): Record<string, unknown> {
  const json = row.toJSON();
  const record: Record<string, unknown> = {};
  for (const column of columns) {
    record[column] = json[column];
  }
  return record;
}

export async function runGuardedQuery(
  sql: string,
  options: GuardedQueryOptions,
): Promise<ToolResult> {
  const guard = checkSql(sql);
  if (!guard.allowed) {
    return fail("query_rejected", guard.reason, guard.hint);
  }

  const aggregate = isAggregateQuery(sql);
  if (!aggregate && options.maxPreviewRows === 0) {
    return fail(
      "too_many_rows",
      "This query would return individual rows. run_query only returns aggregates under the current policy.",
      "Rewrite with GROUP BY and aggregate functions, or call request_raw_rows if individual rows are truly needed.",
    );
  }

  const rowCap = Math.min(options.maxRows ?? 1000, 1000);

  const conn = await connect();
  try {
    const limitedSql = aggregate ? sql : `${sql.replace(/;\s*$/, "")} LIMIT ${rowCap + 1}`;
    const result = await conn.query(limitedSql);
    const columns = result.schema.fields.map((field) => field.name);
    const rawRows = result.toArray().map((row) => arrowRowToRecord(row, columns));

    if (!aggregate && rawRows.length > options.maxPreviewRows) {
      return fail(
        "too_many_rows",
        `The query would return ${rawRows.length} rows, but the policy allows at most ${options.maxPreviewRows}.`,
        "Aggregate further, or call request_raw_rows.",
      );
    }

    const truncated = rawRows.length > rowCap;
    const sliced = truncated ? rawRows.slice(0, rowCap) : rawRows;

    const { columns: redactedCols, rows: redactedRows, redacted_columns } = redactProjection(
      columns,
      sliced,
      options.classifications,
      options.blockedColumns,
    );

    const { rows: kRows, suppressed_groups } = suppressSmallGroups(
      redactedCols,
      redactedRows,
      options.classifications,
      options.kThreshold,
    );

    const { rows: finalRows, injection_flags } = sanitizeRows(kRows);

    return ok(
      `${finalRows.length} row(s) returned${redacted_columns.length ? `; ${redacted_columns.length} column(s) redacted` : ""}.`,
      {
        columns: redactedCols,
        rows: finalRows,
        row_count: finalRows.length,
        truncated,
        suppressed_groups,
        redacted_columns,
        injection_flags,
      },
    );
  } catch (error) {
    return fail(
      "engine_error",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await conn.close();
  }
}

/** Preview rows for the airlock dialog — no aggregate guard, explicit columns only. */
export async function runRawRowPreview(
  sql: string,
  rowLimit: number,
  expectedColumns: string[],
): Promise<ToolResult> {
  const guard = checkSql(sql);
  if (!guard.allowed) {
    return fail("query_rejected", guard.reason, guard.hint);
  }

  if (rejectsSelectStar(sql)) {
    return fail(
      "query_rejected",
      "SELECT * is not permitted for raw row requests.",
      "List every column explicitly in both the SQL and the columns argument.",
    );
  }

  if (rowLimit < 1 || rowLimit > 50) {
    return fail("invalid_input", "row_limit must be between 1 and 50.");
  }

  const columnCheck = columnsMatchResult(expectedColumns, expectedColumns);
  if (!columnCheck.ok) {
    return fail("invalid_input", columnCheck.message);
  }

  const conn = await connect();
  try {
    const normalized = sql.replace(/;\s*$/, "");

    const countResult = await conn.query(
      `SELECT count(*) AS n FROM (${normalized}) AS _airlock_count`,
    );
    const total = Number(
      (countResult.toArray()[0]?.toJSON() as { n?: bigint | number } | undefined)?.n ?? 0,
    );

    if (total > rowLimit) {
      return fail(
        "too_many_rows",
        `Query matches ${total} rows, but row_limit is ${rowLimit}.`,
        "Add WHERE filters or LIMIT to the SQL so it resolves to fewer rows.",
      );
    }

    const previewSql = /\bLIMIT\s+\d+\s*$/i.test(normalized)
      ? normalized
      : `${normalized} LIMIT ${rowLimit}`;

    const result = await conn.query(previewSql);
    const columns = result.schema.fields.map((field) => field.name);

    const match = columnsMatchResult(expectedColumns, columns);
    if (!match.ok) {
      return fail("invalid_input", match.message);
    }

    const rawRows = result.toArray().map((row) => arrowRowToRecord(row, columns));

    if (rawRows.length > rowLimit) {
      return fail(
        "too_many_rows",
        `The query returned ${rawRows.length} rows, but row_limit is ${rowLimit}.`,
        "Add filters or lower row_limit.",
      );
    }

    return ok(`${rawRows.length} row(s) ready for human review.`, {
      columns,
      rows: rawRows,
      row_count: rawRows.length,
    });
  } catch (error) {
    return fail(
      "engine_error",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await conn.close();
  }
}

export function explainGuards(
  sql: string,
  maxPreviewRows: number,
): {
  statement_guard: "pass" | "fail";
  aggregate_guard: "pass" | "fail" | "n/a";
  reason?: string;
} {
  const guard = checkSql(sql);
  if (!guard.allowed) {
    return {
      statement_guard: "fail",
      aggregate_guard: "n/a",
      reason: guard.reason,
    };
  }

  const aggregate = isAggregateQuery(sql);
  const aggregate_guard =
    aggregate || maxPreviewRows > 0 ? "pass" : ("fail" as const);

  return {
    statement_guard: "pass",
    aggregate_guard,
    reason:
      aggregate_guard === "fail"
        ? "Non-aggregate queries are blocked while max_preview_rows is 0."
        : undefined,
  };
}
