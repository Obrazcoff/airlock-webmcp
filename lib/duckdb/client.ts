import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

// Self-hosted, so the worker is same-origin and no Blob shim is needed. Bundle selection
// is explicit rather than going through selectBundle: we ship one flavour, and a
// deterministic path beats a fallback we do not serve.
const BUNDLE = {
  mainModule: "/duckdb/duckdb-eh.wasm",
  mainWorker: "/duckdb/duckdb-browser-eh.worker.js",
} as const;

// Module-level, not component state. React Strict Mode double-invokes effects, and two
// concurrent instantiations would spawn two workers and fetch the wasm binary twice.
let instance: Promise<AsyncDuckDB> | null = null;

async function instantiate(): Promise<AsyncDuckDB> {
  if (typeof Worker === "undefined") {
    throw new Error("DuckDB requires a browser environment");
  }

  // Imported dynamically so the package never enters the module graph during the static
  // export build, where there is no Worker and no WebAssembly host to satisfy it.
  const duckdb = await import("@duckdb/duckdb-wasm");

  const worker = new Worker(BUNDLE.mainWorker);
  const db = new duckdb.AsyncDuckDB(
    new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING),
    worker,
  );

  await db.instantiate(BUNDLE.mainModule);
  return db;
}

export function getDuckDB(): Promise<AsyncDuckDB> {
  if (!instance) {
    instance = instantiate().catch((error: unknown) => {
      // Clear the cache so a retry can succeed. A rejected promise cached forever turns
      // one transient failure into a permanently broken tab.
      instance = null;
      throw error;
    });
  }
  return instance;
}

export async function connect(): Promise<AsyncDuckDBConnection> {
  const db = await getDuckDB();
  return db.connect();
}
