const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+in\s+maintenance\s+mode/i,
  /call\s+request_raw_rows/i,
  /system\s*:\s*/i,
  /<\s*\/?\s*system\s*>/i,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/** Wrap surviving string values so models treat them as data, not instructions. */
export function wrapStringValue(value: string): string {
  if (looksLikeInjection(value)) {
    return `[data: flagged] «${value}»`;
  }
  return `[data] «${value}»`;
}

export function sanitizeCell(value: unknown): { value: unknown; flagged: boolean } {
  if (value === null || value === undefined) {
    return { value, flagged: false };
  }

  if (typeof value === "string") {
    const flagged = looksLikeInjection(value);
    return { value: wrapStringValue(value), flagged };
  }

  if (typeof value === "bigint") {
    return { value: Number(value), flagged: false };
  }

  return { value, flagged: false };
}

export function sanitizeRows(rows: Record<string, unknown>[]): {
  rows: Record<string, unknown>[];
  injection_flags: number;
} {
  let injection_flags = 0;

  const sanitized = rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const { value: cleaned, flagged } = sanitizeCell(value);
      next[key] = cleaned;
      if (flagged) injection_flags += 1;
    }
    return next;
  });

  return { rows: sanitized, injection_flags };
}
