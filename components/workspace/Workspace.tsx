"use client";

import { useMemo } from "react";

import { WebMcpStatusPill } from "@/components/system/WebMcpStatusPill";
import { AIRLOCK_TOOLS } from "@/lib/webmcp/registry";
import { useWebMcpTools } from "@/lib/webmcp/useWebMcpTools";
import { CLASSIFICATION_LABELS } from "@/lib/privacy/types";
import { useDatasetStore } from "@/lib/store/datasets";
import { usePolicyStore } from "@/lib/store/policy";
import { TIER_LABELS, type Tier } from "@/lib/webmcp/types";

export function Workspace() {
  const { datasets, loading, error } = useDatasetStore();
  const { cellsReleased, rawRequestsEnabled } = usePolicyStore();

  // The tier set is derived from application state, not configured. This is the whole
  // mechanism: load a dataset and the inspection tools appear; revoke raw-row access and
  // the airlock tool is unregistered rather than merely refusing.
  const activeTiers = useMemo(() => {
    const tiers = new Set<Tier>([0]);
    if (datasets.length > 0) {
      tiers.add(1);
      tiers.add(2);
    }
    if (rawRequestsEnabled) tiers.add(3);
    return tiers;
  }, [datasets.length, rawRequestsEnabled]);

  const { status, registered } = useWebMcpTools(activeTiers);

  const loadSample = async () => {
    const tool = AIRLOCK_TOOLS.find((t) => t.name === "load_sample_dataset");
    await tool?.execute({ id: "payroll_2026" });
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Airlock</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-400">
            An analytics workspace where an AI agent does the whole analysis without ever
            seeing your data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
            <span className="text-neutral-500">Released this session</span>
            <span className="ml-2 font-mono text-neutral-100">{cellsReleased}</span>
            <span className="ml-1 text-neutral-500">cells</span>
          </div>
          <WebMcpStatusPill status={status} toolCount={registered.length} />
        </div>
      </header>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <h2 className="text-sm font-medium text-neutral-300">Datasets</h2>

        {datasets.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <p className="text-sm text-neutral-500">
              Nothing loaded. The sample is a 4,000-row synthetic payroll export.
            </p>
            <button
              type="button"
              onClick={loadSample}
              disabled={loading !== null}
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 disabled:opacity-50"
            >
              {loading ? `Loading ${loading}…` : "Load sample payroll"}
            </button>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {datasets.map((dataset) => (
              <li key={dataset.id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium">{dataset.name}</span>
                  <span className="font-mono text-xs text-neutral-500">
                    {dataset.rowCount.toLocaleString()} rows ·{" "}
                    {dataset.columns.length} columns
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {dataset.columns.map((column) => (
                    <span
                      key={column.name}
                      className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 font-mono text-xs text-neutral-400"
                      title={`${column.sqlType} · ${CLASSIFICATION_LABELS[column.classification]}`}
                    >
                      {column.name}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <h2 className="text-sm font-medium text-neutral-300">Registered tools</h2>
        <p className="mt-1 text-xs text-neutral-500">
          The advertised set changes as you work. Each tier is owned by its own
          AbortController, so a withdrawn capability is unregistered rather than refused.
        </p>

        <ul className="mt-3 space-y-1.5">
          {AIRLOCK_TOOLS.map((tool) => {
            const active = registered.includes(tool.name);
            return (
              <li key={tool.name} className="flex items-center gap-2 text-sm">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-neutral-700"}`}
                />
                <span
                  className={`font-mono text-xs ${active ? "text-neutral-200" : "text-neutral-600"}`}
                >
                  {tool.name}
                </span>
                <span className="text-xs text-neutral-600">
                  tier {tool.tier} · {TIER_LABELS[tool.tier]}
                </span>
                {tool.readOnly && (
                  <span className="rounded border border-neutral-800 px-1 text-[10px] uppercase tracking-wide text-neutral-500">
                    read-only
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
