"use client";

import { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";

import type { ChartBlockData } from "@/lib/store/notebook";

function unwrapLabel(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "");
  const match = value.match(/«(.+)»/);
  return match?.[1] ?? value.replace(/^\[data(?:: flagged)?\]\s*/, "");
}

function plotRows(rows: Record<string, unknown>[], x: string, y: string, color?: string) {
  return rows.map((row) => ({
    ...row,
    [x]: unwrapLabel(row[x]),
    ...(color ? { [color]: unwrapLabel(row[color]) } : {}),
    [y]: Number(row[y]),
  }));
}

export function ChartBlockView({ chart }: { chart: ChartBlockData }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const data = plotRows(chart.rows, chart.x, chart.y, chart.color);
    node.replaceChildren();

    const marks =
      chart.mark === "bar"
        ? [
            Plot.barY(data, {
              x: chart.x,
              y: chart.y,
              fill: chart.color,
              tip: true,
            }),
          ]
        : [
            Plot.lineY(data, {
              x: chart.x,
              y: chart.y,
              stroke: chart.color,
              tip: true,
            }),
          ];

    const plot = Plot.plot({
      width: node.clientWidth || 480,
      height: 240,
      marginLeft: 56,
      color: chart.color ? { legend: true } : undefined,
      x: { label: chart.x },
      y: { label: chart.y, grid: true },
      style: {
        background: "transparent",
        color: "#f5f5f5",
        fontSize: "12px",
      },
      marks,
    });

    node.append(plot);
    return () => plot.remove();
  }, [chart]);

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/80 p-3">
      <div ref={ref} className="min-h-[240px] w-full" />
    </div>
  );
}
