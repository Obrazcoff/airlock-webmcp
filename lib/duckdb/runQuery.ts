import { isAggregateQuery } from "@/lib/duckdb/aggregateGuard";
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
