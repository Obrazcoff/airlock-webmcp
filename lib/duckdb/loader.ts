import { getDuckDB } from "@/lib/duckdb/client";
import type { Dataset, DatasetColumn } from "@/lib/store/datasets";

async function describe(table: string): Promise<DatasetColumn[]> {
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const result = await conn.query(`DESCRIBE "${table}"`);
    return result.toArray().map((row) => {
      const record = row.toJSON() as Record<string, unknown>;
      return {
        name: String(record.column_name),
        sqlType: String(record.column_type),
      };
    });
  } finally {
    await conn.close();
  }
}

async function countRows(table: string): Promise<number> {
  const db = await getDuckDB();
  const conn = await db.connect();
  try {
    const result = await conn.query(`SELECT count(*) AS n FROM "${table}"`);
    const first = result.toArray()[0]?.toJSON() as { n?: bigint | number };
    return Number(first?.n ?? 0);
  } finally {
    await conn.close();
  }
}

/**
 * Fetch a CSV that ships with the app and register it as a table.
 *
 * The fetch is same-origin and hits a static asset, so it does not weaken the "no data
 * leaves the device" claim: nothing user-supplied is being sent anywhere. User files go
 * through loadCsvFromFile, which never touches the network at all.
 */
export async function loadCsvFromUrl(
  url: string,
  table: string,
  displayName: string,
): Promise<Dataset> {
  const db = await getDuckDB();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status}`);
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  const virtualPath = `${table}.csv`;

  await db.registerFileBuffer(virtualPath, buffer);

  const conn = await db.connect();
  try {
    await conn.query(`DROP TABLE IF EXISTS "${table}"`);
    await conn.insertCSVFromPath(virtualPath, {
      name: table,
      schema: "main",
      detect: true,
      header: true,
    });
  } finally {
    await conn.close();
  }

  return {
    id: table,
    name: displayName,
    source: url.split("/").pop() ?? url,
    rowCount: await countRows(table),
    columns: await describe(table),
    loadedAt: new Date().toISOString(),
  };
}
