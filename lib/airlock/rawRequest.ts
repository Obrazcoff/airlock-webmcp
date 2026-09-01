/** Stable key for deduplicating denied release requests within a session. */
export function rawRequestFingerprint(input: {
  sql: string;
  columns: string[];
  row_limit: number;
}): string {
  return JSON.stringify({
    sql: input.sql.trim().replace(/\s+/g, " "),
    columns: [...input.columns].sort(),
    row_limit: input.row_limit,
  });
}

export function rejectsSelectStar(sql: string): boolean {
  return /\bselect\s+\*/i.test(sql.replace(/\s+/g, " "));
}

export function columnsMatchResult(
  expected: string[],
  actual: string[],
): { ok: true } | { ok: false; message: string } {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  if (expectedSet.size !== expected.length) {
    return { ok: false, message: "Duplicate column names in the columns argument." };
  }

  const missing = expected.filter((column) => !actualSet.has(column));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Query result is missing requested column(s): ${missing.join(", ")}.`,
    };
  }

  const extra = actual.filter((column) => !expectedSet.has(column));
  if (extra.length > 0) {
    return {
      ok: false,
      message: `Query returned unexpected column(s): ${extra.join(", ")}. Project only the listed columns.`,
    };
  }

  return { ok: true };
}

export function countCells(rows: number, columns: number): number {
  return rows * columns;
}
