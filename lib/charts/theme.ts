/** Dark-theme palette for Observable Plot. */

export const GENDER_COLORS = {
  Female: "#fb7185", // rose-400
  Male: "#34d399", // emerald-400 — matches site accent
} as const;

const DARK_CATEGORICAL = [
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#fbbf24", // amber
  "#c084fc", // purple
  "#fb7185", // rose
  "#a3e635", // lime
] as const;

const SUPPRESSED_COLOR = "#525252";

export type ChartColorScale = {
  legend?: boolean;
  domain?: readonly string[];
  range?: readonly string[];
  scheme?: string;
};

export function colorScaleForChannel(
  channel: string,
  values: string[],
): ChartColorScale | undefined {
  const unique = [...new Set(values.filter(Boolean))];

  if (channel === "gender") {
    return {
      legend: true,
      domain: ["Female", "Male"],
      range: [GENDER_COLORS.Female, GENDER_COLORS.Male],
    };
  }

  if (unique.some((value) => value.includes("suppressed"))) {
    return {
      legend: true,
      domain: unique,
      range: unique.map((value) =>
        value.includes("suppressed") ? SUPPRESSED_COLOR : pickCategorical(value, unique),
      ),
    };
  }

  if (unique.length > 1) {
    return {
      legend: true,
      domain: unique,
      range: unique.map((value, index) => DARK_CATEGORICAL[index % DARK_CATEGORICAL.length]!),
    };
  }

  return undefined;
}

function pickCategorical(value: string, domain: string[]): string {
  const index = domain.indexOf(value);
  return DARK_CATEGORICAL[index % DARK_CATEGORICAL.length]!;
}

export function fillChannel(chart: {
  mark: string;
  x: string;
  y: string;
  color?: string;
}): string | undefined {
  if (chart.color) return chart.color;
  // Single-series bar charts: colour bars by the category on x (e.g. gender).
  if (chart.mark === "bar") return chart.x;
  return undefined;
}
