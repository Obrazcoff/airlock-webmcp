/**
 * Heuristic aggregate detection for run_query's preview guard.
 *
 * Imperfect by design — the AST layer will tighten this later. Good enough to block
 * SELECT * FROM payroll under the default max_preview_rows of zero.
 */
export function isAggregateQuery(sql: string): boolean {
  const lower = sql.toLowerCase().replace(/\s+/g, " ");

  if (/\bgroup\s+by\b/.test(lower)) return true;
  if (/\bgrouping\s+sets\b/.test(lower)) return true;
  if (/\brollup\b/.test(lower)) return true;
  if (/\bcube\b/.test(lower)) return true;

  return /\b(count|sum|avg|mean|min|max|median|stddev|variance|stddev_pop|stddev_samp|var_pop|var_samp|string_agg|list|array_agg|approx_count_distinct|quantile|mode|arg_min|arg_max|first|last|product|bool_and|bool_or|every|bit_and|bit_or|bit_xor)\s*\(/i.test(
    sql,
  );
}
