import { connect } from "@/lib/duckdb/client";
import { classifyColumn } from "@/lib/privacy/classify";
import type { ColumnClassification } from "@/lib/privacy/types";
import type { DatasetColumn } from "@/lib/store/datasets";

export interface ColumnProfileStats {
  null_fraction: number;
  distinct_count: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  mean_string_length?: number;
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export async function profileColumnStats(
  table: string,
  column: string,
): Promise<ColumnProfileStats> {
  const conn = await connect();
  const col = quote(column);
  const tbl = quote(table);

  try {
    const summary = await conn.query(`
      SELECT
        avg(CASE WHEN ${col} IS NULL THEN 1.0 ELSE 0.0 END) AS null_fraction,
        count(DISTINCT ${col}) AS distinct_count,
        min(TRY_CAST(${col} AS DOUBLE)) AS min_val,
        max(TRY_CAST(${col} AS DOUBLE)) AS max_val,
        avg(TRY_CAST(${col} AS DOUBLE)) AS mean_val,
        median(TRY_CAST(${col} AS DOUBLE)) AS median_val,
        avg(length(CAST(${col} AS VARCHAR))) AS mean_len
      FROM ${tbl}
    `);

    const row = summary.toArray()[0]?.toJSON() as Record<string, unknown> | undefined;
    if (!row) {
      return { null_fraction: 0, distinct_count: 0 };
    }

    return {
      null_fraction: Number(row.null_fraction ?? 0),
      distinct_count: Number(row.distinct_count ?? 0),
      min: row.min_val == null ? undefined : Number(row.min_val),
      max: row.max_val == null ? undefined : Number(row.max_val),
      mean: row.mean_val == null ? undefined : Number(row.mean_val),
      median: row.median_val == null ? undefined : Number(row.median_val),
      mean_string_length:
        row.mean_len == null ? undefined : Number(row.mean_len),
    };
  } finally {
    await conn.close();
  }
}

export async function classifyDatasetColumns(
  table: string,
  columns: Pick<DatasetColumn, "name" | "sqlType">[],
  rowCount: number,
): Promise<DatasetColumn[]> {
  const enriched: DatasetColumn[] = [];

  for (const column of columns) {
    const stats = await profileColumnStats(table, column.name);
    const classification = classifyColumn({
      name: column.name,
      sqlType: column.sqlType,
      rowCount,
      distinctCount: stats.distinct_count,
      meanStringLength: stats.mean_string_length,
    });

    enriched.push({
      ...column,
      classification,
      stats,
    });
  }

  return enriched;
}

export async function histogramBuckets(
  table: string,
  column: string,
  buckets = 10,
): Promise<{ bucket: string; count: number }[]> {
  const conn = await connect();
  const col = quote(column);
  const tbl = quote(table);

  try {
    const result = await conn.query(`
      WITH bounds AS (
        SELECT min(TRY_CAST(${col} AS DOUBLE)) AS lo, max(TRY_CAST(${col} AS DOUBLE)) AS hi
        FROM ${tbl}
        WHERE ${col} IS NOT NULL
      ),
      bucketed AS (
        SELECT
          CASE
            WHEN b.hi = b.lo THEN 0
            ELSE floor((TRY_CAST(t.${col} AS DOUBLE) - b.lo) / ((b.hi - b.lo) / ${buckets}))
          END AS bucket_idx,
          count(*) AS cnt
        FROM ${tbl} t, bounds b
        WHERE t.${col} IS NOT NULL
        GROUP BY 1
      )
      SELECT bucket_idx, cnt FROM bucketed ORDER BY bucket_idx
    `);

    return result.toArray().map((row) => {
      const record = row.toJSON() as { bucket_idx: number; cnt: bigint | number };
      return {
        bucket: String(record.bucket_idx),
        count: Number(record.cnt),
      };
    });
  } finally {
    await conn.close();
  }
}

export async function topValueCounts(
  table: string,
  column: string,
  topK: number,
): Promise<{ value: string; count: number }[]> {
  const conn = await connect();
  const col = quote(column);
  const tbl = quote(table);

  try {
    const result = await conn.query(`
      SELECT CAST(${col} AS VARCHAR) AS value, count(*) AS cnt
      FROM ${tbl}
      WHERE ${col} IS NOT NULL
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT ${topK}
    `);

    return result.toArray().map((row) => {
      const record = row.toJSON() as { value: string; cnt: bigint | number };
      return { value: record.value, count: Number(record.cnt) };
    });
  } finally {
    await conn.close();
  }
}

export type { ColumnClassification };
