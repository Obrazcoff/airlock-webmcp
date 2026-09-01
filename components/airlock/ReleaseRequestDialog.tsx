"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { countCells } from "@/lib/airlock/rawRequest";
import { useReleaseStore, type PendingRelease } from "@/lib/store/release";
import { CLASSIFICATION_LABELS, type ColumnClassification } from "@/lib/privacy/types";

const classificationStyles: Record<ColumnClassification, string> = {
  identifier: "bg-rose-500/20 text-rose-200",
  quasi_identifier: "bg-amber-500/20 text-amber-200",
  sensitive: "bg-orange-500/20 text-orange-200",
  measure: "bg-sky-500/20 text-sky-200",
  free_text: "bg-violet-500/20 text-violet-200",
};

function defaultIncluded(classification: ColumnClassification): boolean {
  return (
    classification !== "identifier" &&
    classification !== "free_text" &&
    classification !== "sensitive"
  );
}

function ReleaseRequestDialogInner({ pending }: { pending: PendingRelease }) {
  const resolvePending = useReleaseStore((state) => state.resolvePending);

  const [included, setIncluded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const column of pending.preview.columns) {
      const classification = pending.preview.classifications[column] ?? "measure";
      initial[column] = defaultIncluded(classification);
    }
    return initial;
  });

  const selectedColumns = pending.preview.columns.filter((column) => included[column]);
  const pendingCells = countCells(pending.preview.rows.length, selectedColumns.length);
  const sessionAfter = pending.session_cells_before + pendingCells;

  const toggleColumn = (column: string) => {
    setIncluded((state) => ({ ...state, [column]: !state[column] }));
  };

  const releaseColumns = (columns: string[]) => {
    resolvePending({ kind: "release", columns });
  };

  const deny = () => {
    resolvePending({ kind: "deny" });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-dialog-title"
    >
      <div className="demo-fade-in max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-amber-500/30 bg-neutral-950 shadow-2xl shadow-amber-500/10">
        <div className="border-b border-neutral-800 px-5 py-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-widest text-amber-400">
            Airlock — release request
          </p>
          <h2 id="release-dialog-title" className="mt-1 text-xl font-semibold text-white">
            The agent wants to release individual rows
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Nothing is sent until you choose. Closing the tab leaves the request pending —
            there is no timeout that defaults to allow.
          </p>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Agent justification
            </h3>
            <p className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm leading-relaxed text-neutral-200">
              {pending.justification}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">SQL</h3>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/80 p-3 font-mono text-xs text-emerald-200/90">
              {pending.sql}
            </pre>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Preview ({pending.preview.rows.length} rows)
              </h3>
              <p className="text-sm text-neutral-400">
                This release:{" "}
                <span className="font-mono text-white">{pendingCells}</span> cells → session
                total{" "}
                <span className="font-mono text-white">{sessionAfter}</span>
              </p>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-neutral-900/90">
                  <tr>
                    {pending.preview.columns.map((column) => {
                      const classification =
                        pending.preview.classifications[column] ?? "measure";
                      return (
                        <th key={column} className="px-3 py-2 align-top">
                          <label className="flex cursor-pointer flex-col gap-1">
                            <span className="font-mono text-neutral-200">{column}</span>
                            <span
                              className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] ${classificationStyles[classification]}`}
                            >
                              {CLASSIFICATION_LABELS[classification]}
                            </span>
                            <input
                              type="checkbox"
                              checked={included[column] ?? false}
                              onChange={() => toggleColumn(column)}
                              className="mt-1 accent-emerald-400"
                            />
                          </label>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pending.preview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-neutral-800/80">
                      {pending.preview.columns.map((column) => (
                        <td
                          key={column}
                          className={`px-3 py-2 font-mono text-neutral-300 ${
                            included[column] ? "" : "opacity-40 line-through"
                          }`}
                        >
                          {String(row[column] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-neutral-800 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => releaseColumns(pending.preview.columns)}
            className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-300"
          >
            Release all columns
          </button>
          <button
            type="button"
            onClick={() => releaseColumns(selectedColumns)}
            disabled={selectedColumns.length === 0}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
          >
            Release selected ({selectedColumns.length})
          </button>
          <button
            type="button"
            onClick={deny}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReleaseRequestDialog() {
  const pending = useReleaseStore((state) => state.pending);
  if (!pending || typeof document === "undefined") return null;
  return createPortal(
    <ReleaseRequestDialogInner key={pending.id} pending={pending} />,
    document.body,
  );
}
