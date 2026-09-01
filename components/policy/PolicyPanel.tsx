"use client";

import { useState } from "react";

import { usePolicyStore } from "@/lib/store/policy";
import { useReleaseStore } from "@/lib/store/release";
import { CLASSIFICATION_LABELS } from "@/lib/privacy/types";

export function PolicyPanel() {
  const {
    rawRequestsEnabled,
    kAnonymityThreshold,
    cellsReleased,
    suggestions,
    setRawRequestsEnabled,
    setKAnonymityThreshold,
  } = usePolicyStore();
  const history = useReleaseStore((state) => state.history);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-medium text-neutral-300">Privacy policy</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Agents cannot widen their own access. You control the airlock.
      </p>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-3">
        <input
          type="checkbox"
          checked={rawRequestsEnabled}
          onChange={(event) => setRawRequestsEnabled(event.target.checked)}
          className="mt-0.5 accent-emerald-400"
        />
        <span>
          <span className="block text-sm font-medium text-neutral-200">
            Allow raw row requests
          </span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            When off, <code className="text-neutral-400">request_raw_rows</code> disappears
            from the agent&apos;s tool list — it cannot refuse what it cannot call.
          </span>
        </span>
      </label>

      <label className="mt-3 block text-xs text-neutral-500">
        k-anonymity threshold
        <input
          type="range"
          min={2}
          max={20}
          value={kAnonymityThreshold}
          onChange={(event) => setKAnonymityThreshold(Number(event.target.value))}
          className="mt-2 w-full accent-emerald-400"
        />
        <span className="mt-1 block font-mono text-neutral-300">{kAnonymityThreshold}</span>
      </label>

      <button
        type="button"
        onClick={() => setShowHistory((open) => !open)}
        className="mt-4 w-full rounded-lg border border-neutral-800 px-3 py-2 text-left text-sm hover:bg-neutral-900"
      >
        <span className="text-neutral-400">Cells released</span>
        <span className="ml-2 font-mono text-lg text-white">{cellsReleased}</span>
        <span className="ml-1 text-xs text-neutral-600">
          {showHistory ? "▲ hide log" : "▼ show log"}
        </span>
      </button>

      {showHistory && (
        <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
          {history.length === 0 ? (
            <li className="text-neutral-600">No releases yet this session.</li>
          ) : (
            history.map((entry) => (
              <li key={entry.id} className="rounded border border-neutral-800/80 px-2 py-1.5">
                <p className="font-mono text-neutral-400">
                  {new Date(entry.at).toLocaleTimeString()} · {entry.decision} ·{" "}
                  {entry.cells} cells
                </p>
                <p className="truncate text-neutral-500">{entry.justification}</p>
              </li>
            ))
          )}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <p className="text-xs font-medium text-neutral-500">Agent suggestions</p>
          <ul className="mt-2 space-y-2">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                className="rounded border border-neutral-800/80 px-2 py-1.5 text-xs"
              >
                <p className="font-mono text-neutral-300">
                  {suggestion.column} →{" "}
                  {CLASSIFICATION_LABELS[suggestion.proposed_classification]}
                </p>
                <p className="text-neutral-500">{suggestion.rationale}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
