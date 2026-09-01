"use client";

import { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";

import { colorScaleForChannel, fillChannel } from "@/lib/charts/theme";
import type { ChartBlockData } from "@/lib/store/notebook";

function unwrapLabel(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "");
  const match = value.match(/«(.+)»/);
  return match?.[1] ?? value.replace(/^\[data(?:: flagged)?\]\s*/, "");
}

function plotRows(rows: Record<string, unknown>[], x: string, y: string, fill?: string) {
  return rows.map((row) => ({
    ...row,
    [x]: unwrapLabel(row[x]),
    ...(fill ? { [fill]: unwrapLabel(row[fill]) } : {}),
    [y]: Number(row[y]),
  }));
}

export function ChartBlockView({ chart }: { chart: ChartBlockData }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fill = fillChannel(chart);
    const data = plotRows(chart.rows, chart.x, chart.y, fill);
    node.replaceChildren();

    const fillValues = fill ? data.map((row) => String(row[fill] ?? "")) : [];

    const marks =
      chart.mark === "bar"
        ? [
            Plot.barY(data, {
              x: chart.x,
              y: chart.y,
              fill,
              tip: true,
            }),
          ]
        : [
            Plot.lineY(data, {
              x: chart.x,
              y: chart.y,
              stroke: fill,
              tip: true,
            }),
          ];

    const plot = Plot.plot({
      width: node.clientWidth || 480,
      height: 240,
      marginLeft: 56,
      marginTop: fill ? 28 : 16,
      color: fill ? (colorScaleForChannel(fill, fillValues) as Plot.ScaleOptions) : undefined,
      x: { label: chart.x, tickFormat: (value) => String(value) },
      y: { label: chart.y, grid: true, tickFormat: (value) => String(value) },
      style: {
        background: "transparent",
        color: "#d4d4d4",
        fontSize: "12px",
      },
      marks,
    });

    node.append(plot);
    return () => plot.remove();
  }, [chart]);

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/80 p-3 [&_.plot]:[--plot-axis:#737373] [&_.plot]:[--plot-grid:#262626]">
      <div ref={ref} className="min-h-[240px] w-full" />
    </div>
  );
}
