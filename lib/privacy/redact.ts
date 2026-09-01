import { isRedactedFromOutput } from "@/lib/privacy/classify";
import type { ColumnClassification } from "@/lib/privacy/types";

export function redactProjection(
  columns: string[],
  rows: Record<string, unknown>[],
  classifications: Record<string, ColumnClassification>,
  blocked: ReadonlySet<string>,
): { columns: string[]; rows: Record<string, unknown>[]; redacted_columns: string[] } {
  const redacted_columns = columns.filter((column) =>
    isRedactedFromOutput(
      classifications[column] ?? "measure",
      blocked.has(column),
    ),
  );

  const kept = columns.filter((column) => !redacted_columns.includes(column));

  const redactedRows = rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const column of kept) {
      next[column] = row[column];
    }
    return next;
  });

  return { columns: kept, rows: redactedRows, redacted_columns };
}
