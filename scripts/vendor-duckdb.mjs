#!/usr/bin/env node
// Copies the DuckDB-Wasm browser bundle out of node_modules into public/duckdb.
//
// Self-hosting rather than loading from a CDN does two things. It sidesteps the
// cross-origin Worker restriction, so no Blob-URL importScripts shim is needed. And it
// keeps a third party off the critical path of a product whose whole pitch is that
// nothing leaves the machine: a reviewer watching the network tab should see requests to
// our origin and nowhere else.
//
// Only the exception-handling bundle ships. Chrome 149+ and ChatGPT's in-app browser
// both support Wasm exception handling, and adding the mvp fallback would put another
// 37 MB into every deploy. See docs/adr/0004-self-hosted-eh-bundle.md.

import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@duckdb", "duckdb-wasm", "dist");
const target = join(root, "public", "duckdb");

const FILES = ["duckdb-eh.wasm", "duckdb-browser-eh.worker.js"];

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

await mkdir(target, { recursive: true });

for (const file of FILES) {
  const from = join(source, file);
  const to = join(target, file);

  const { size } = await stat(from).catch(() => {
    throw new Error(
      `${file} is missing from ${source}. Run \`npm ci\` before building.`,
    );
  });

  await copyFile(from, to);
  console.log(`vendor:duckdb  ${file.padEnd(30)} ${mb(size)}`);
}

console.log(`vendor:duckdb  → public/duckdb`);
