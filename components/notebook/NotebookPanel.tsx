"use client";

import type { FindingBlockData, NotebookBlock } from "@/lib/store/notebook";
import { ChartBlockView } from "@/components/notebook/ChartBlockView";

const severityStyles = {
  info: "border-sky-500/30 bg-sky-500/5 text-sky-200",
  watch: "border-amber-500/30 bg-amber-500/5 text-amber-200",
  material: "border-rose-500/30 bg-rose-500/5 text-rose-100",
};

function FindingView({ finding }: { finding: FindingBlockData }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${severityStyles[finding.severity]}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{finding.severity}</p>
      <h3 className="mt-1 font-medium">{finding.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-300">{finding.body_markdown}</p>
    </div>
  );
}

export function NotebookPanel({ blocks }: { blocks: NotebookBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 px-6 text-center">
        <p className="text-sm font-medium text-neutral-300">The notebook is empty</p>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Run the pay gap story to watch an agent build charts and findings here — while the
          airlock counter stays at zero.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <article
          key={block.id}
          className="demo-fade-in rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
              agent
            </span>
            <span>{new Date(block.created_at).toLocaleTimeString()}</span>
          </div>

          {block.payload.type === "chart" && (
            <>
              <h3 className="font-medium text-neutral-100">{block.payload.title}</h3>
              {block.payload.caption && (
                <p className="mt-1 text-sm text-neutral-400">{block.payload.caption}</p>
              )}
              <div className="mt-3">
                <ChartBlockView chart={block.payload} />
              </div>
            </>
          )}

          {block.payload.type === "finding" && <FindingView finding={block.payload} />}
        </article>
      ))}
    </div>
  );
}
