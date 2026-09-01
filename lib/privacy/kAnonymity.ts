import { triggersKAnonymity } from "@/lib/privacy/classify";
import type { ColumnClassification } from "@/lib/privacy/types";

const COUNT_COLUMN = /^(count|cnt|n|row_count|num_rows|total)$/i;

function findCountColumn(columns: string[], rows: Record<string, unknown>[]): string | null {
  for (const column of columns) {
    if (COUNT_COLUMN.test(column)) return column;
  }

  const numeric = columns.filter((column) =>
    rows.every((row) => {
      const value = row[column];
      return typeof value === "number" || typeof value === "bigint";
    }),
  );

  return numeric.length === 1 ? numeric[0]! : null;
}

/**
 * Merge groups below the k threshold into a single « suppressed » row.
 * Only runs when quasi-identifier columns appear in the output.
 */
export function suppressSmallGroups(
  columns: string[],
  rows: Record<string, unknown>[],
  classifications: Record<string, ColumnClassification>,
  k: number,
): { rows: Record<string, unknown>[]; suppressed_groups: number } {
  const quasiColumns = columns.filter((column) =>
    triggersKAnonymity(classifications[column] ?? "measure"),
  );

  if (quasiColumns.length === 0 || rows.length === 0) {
    return { rows, suppressed_groups: 0 };
  }

  const countColumn = findCountColumn(columns, rows);
  if (!countColumn) {
    return { rows, suppressed_groups: 0 };
  }

  const kept: Record<string, unknown>[] = [];
  let suppressedCount = 0;
  let suppressedTotal = 0;

  for (const row of rows) {
    const groupSize = Number(row[countColumn] ?? 0);
    if (groupSize < k) {
      suppressedCount += 1;
      suppressedTotal += groupSize;
      continue;
    }
    kept.push(row);
  }

  if (suppressedCount === 0) {
    return { rows, suppressed_groups: 0 };
  }

  const suppressedRow: Record<string, unknown> = {};
  for (const column of columns) {
    if (column === countColumn) {
      suppressedRow[column] = suppressedTotal;
    } else if (quasiColumns.includes(column)) {
      suppressedRow[column] = "« suppressed »";
    } else {
      suppressedRow[column] = null;
    }
  }

  return { rows: [...kept, suppressedRow], suppressed_groups: suppressedCount };
}
