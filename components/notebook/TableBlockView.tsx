"use client";

import type { TableBlockData } from "@/lib/store/notebook";

export function TableBlockView({ table }: { table: TableBlockData }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-neutral-100">{table.title}</h3>
        {table.mode && (
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
            {table.mode}
          </span>
        )}
        {typeof table.cells_released === "number" && (
          <span className="font-mono text-xs text-neutral-500">
            +{table.cells_released} cells
          </span>
        )}
      </div>

      {table.justification && (
        <p className="mt-2 text-sm text-neutral-400">{table.justification}</p>
      )}

      {table.sql && (
        <pre className="mt-2 overflow-x-auto rounded border border-neutral-800 bg-neutral-950/80 p-2 font-mono text-[10px] text-neutral-500">
          {table.sql}
        </pre>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-neutral-900/90">
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="px-3 py-2 font-mono text-neutral-400">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-neutral-800/80">
                {table.columns.map((column) => (
                  <td key={column} className="px-3 py-2 font-mono text-neutral-200">
                    {String(row[column] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
