"use client";

import { useMemo, useState } from "react";

import { ToolLogPanel } from "@/components/audit/ToolLogPanel";
import { ReleaseRequestDialog } from "@/components/airlock/ReleaseRequestDialog";
import { NotebookPanel } from "@/components/notebook/NotebookPanel";
import { PolicyPanel } from "@/components/policy/PolicyPanel";
import { WebMcpStatusPill } from "@/components/system/WebMcpStatusPill";
import { DEMO_STEPS, runPayGapDemo, type DemoProgress } from "@/lib/demo/payGapStory";
import { invokeTool } from "@/lib/tools/invoke";
import { useAuditStore } from "@/lib/store/audit";
import { useDatasetStore } from "@/lib/store/datasets";
import { useNotebookStore } from "@/lib/store/notebook";
import { usePolicyStore } from "@/lib/store/policy";
import { AIRLOCK_TOOLS } from "@/lib/webmcp/registry";
import { useWebMcpTools } from "@/lib/webmcp/useWebMcpTools";
import { CLASSIFICATION_LABELS } from "@/lib/privacy/types";
import type { Tier } from "@/lib/webmcp/types";

export function Workspace() {
  const { datasets, error } = useDatasetStore();
  const blocks = useNotebookStore((state) => state.blocks);
  const auditEntries = useAuditStore((state) => state.entries);
  const { cellsReleased, rawRequestsEnabled } = usePolicyStore();

  const [demoRunning, setDemoRunning] = useState(false);
  const [demoProgress, setDemoProgress] = useState<DemoProgress | null>(null);

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

  const runDemo = async () => {
    setDemoRunning(true);
    try {
      await runPayGapDemo(setDemoProgress);
    } finally {
      setDemoRunning(false);
      setDemoProgress(null);
    }
  };

  const tryAirlock = async () => {
    if (datasets.length === 0) {
      await invokeTool("load_sample_dataset", { id: "payroll_2026" });
    }
    await invokeTool("request_raw_rows", {
      sql: "SELECT employee_id, gender, grade, base_salary FROM payroll WHERE base_salary > 120000 ORDER BY base_salary DESC",
      row_limit: 5,
      columns: ["employee_id", "gender", "grade", "base_salary"],
      justification:
        "Need to inspect the top five salary outliers individually to explain the grade-controlled gap in the notebook.",
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ReleaseRequestDialog />
      {/* Hero — the story, not the stack */}
      <header className="mb-8 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-neutral-900/80 to-neutral-900/40 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/80">
              WebMCP · local-first analytics
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Your data never leaves the tab.
              <span className="block text-neutral-400">The agent still does the work.</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-neutral-300 sm:text-base">
              Airlock is an analytics workspace where an AI agent profiles sensitive payroll
              data through <strong className="font-medium text-neutral-100">WebMCP tools</strong>,
              not raw rows. Aggregates pass; individual values need your approval. Watch a
              full gender pay-gap review complete with{" "}
              <strong className="font-medium text-emerald-300">zero cells released</strong>.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  cellsReleased === 0
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-amber-500/40 bg-amber-500/10"
                }`}
              >
                <span className="text-neutral-400">Released</span>
                <span className="ml-2 font-mono text-lg text-white">{cellsReleased}</span>
                <span className="ml-1 text-neutral-500">cells</span>
              </div>
              <WebMcpStatusPill status={status} toolCount={registered.length} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runDemo}
            disabled={demoRunning}
            className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 disabled:opacity-60"
          >
            {demoRunning ? "Running the story…" : "▶ Watch the pay gap story"}
          </button>
          <button
            type="button"
            onClick={tryAirlock}
            disabled={demoRunning || !rawRequestsEnabled}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
            title={
              rawRequestsEnabled
                ? "Opens the release dialog — approve or deny"
                : "Enable raw requests in the policy panel first"
            }
          >
            Try the airlock
          </button>
        </div>

        {demoProgress && (
          <div className="demo-fade-in mt-4 rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-3">
            <p className="text-xs text-neutral-500">
              Step {demoProgress.step} of {demoProgress.total}
            </p>
            <p className="font-medium text-neutral-100">{demoProgress.label}</p>
            <p className="text-sm text-neutral-400">
              {DEMO_STEPS[demoProgress.step - 1]?.subtitle}
            </p>
          </div>
        )}

        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Agent analyzes", "Tools return aggregates, not rows"],
            ["You stay in control", "Raw release needs explicit approval"],
            ["Proof in the meter", "Counter stays at zero in a normal review"],
          ].map(([title, detail]) => (
            <li
              key={title}
              className="rounded-lg border border-neutral-800/80 bg-neutral-950/50 px-3 py-2 text-sm"
            >
              <p className="font-medium text-neutral-200">{title}</p>
              <p className="text-neutral-500">{detail}</p>
            </li>
          ))}
        </ul>
      </header>

      {/* Three panes */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left — data */}
        <aside className="space-y-4 lg:col-span-3">
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300">Datasets</h2>
            {datasets.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">
                Run the story or try the airlock to load payroll.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {datasets.map((dataset) => (
                  <li key={dataset.id} className="text-sm">
                    <p className="font-medium">{dataset.name}</p>
                    <p className="font-mono text-xs text-neutral-500">
                      {dataset.rowCount.toLocaleString()} rows
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dataset.columns.slice(0, 6).map((column) => (
                        <span
                          key={column.name}
                          className="rounded bg-neutral-950 px-1 py-0.5 font-mono text-[10px] text-neutral-500"
                          title={CLASSIFICATION_LABELS[column.classification]}
                        >
                          {column.name}
                        </span>
                      ))}
                      {dataset.columns.length > 6 && (
                        <span className="text-[10px] text-neutral-600">
                          +{dataset.columns.length - 6}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </section>

          <PolicyPanel />

          <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300">Tools live</h2>
            <p className="mt-1 text-xs text-neutral-500">{registered.length} registered</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {AIRLOCK_TOOLS.map((tool) => {
                const active = registered.includes(tool.name);
                return (
                  <li key={tool.name} className="flex items-center gap-1.5 text-xs">
                    <span
                      className={`h-1 w-1 rounded-full ${active ? "bg-emerald-400" : "bg-neutral-700"}`}
                    />
                    <span className={active ? "text-neutral-300" : "text-neutral-600"}>
                      {tool.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>

        {/* Centre — notebook */}
        <main className="lg:col-span-6">
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="text-sm font-medium text-neutral-300">Shared notebook</h2>
            <p className="text-xs text-neutral-500">
              Where the agent writes charts and findings — the same surface you see.
            </p>
            <div className="mt-4">
              <NotebookPanel blocks={blocks} />
            </div>
          </section>
        </main>

        {/* Right — audit */}
        <aside className="lg:col-span-3">
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium text-neutral-300">Tool audit</h2>
            <p className="text-xs text-neutral-500">Every call, visible before it finishes.</p>
            <div className="mt-3">
              <ToolLogPanel entries={auditEntries} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
