import { invokeTool, sleep } from "@/lib/tools/invoke";
import { audit } from "@/lib/store/audit";
import { notebook } from "@/lib/store/notebook";
import { useDatasetStore } from "@/lib/store/datasets";

export type DemoStep = {
  title: string;
  subtitle: string;
};

export type DemoProgress = {
  step: number;
  total: number;
  label: string;
};

type ProgressCallback = (progress: DemoProgress) => void;

const STEPS: DemoStep[] = [
  {
    title: "Load the payroll",
    subtitle: "4,000 synthetic rows stay in your tab — nothing is uploaded.",
  },
  {
    title: "Headline gap looks alarming",
    subtitle: "Naive averages hide what's really going on.",
  },
  {
    title: "Control for grade",
    subtitle: "The within-grade gap is ~7%, not ~20%.",
  },
  {
    title: "Raw rows are blocked",
    subtitle: "run_query refuses SELECT * — by design, not settings.",
  },
  {
    title: "Verdict written into the notebook",
    subtitle: "Zero cells released. Full analysis complete.",
  },
];

export async function runPayGapDemo(onProgress?: ProgressCallback): Promise<void> {
  audit().clear();
  notebook().clear();

  const report = (index: number, label: string) => {
    onProgress?.({ step: index + 1, total: STEPS.length, label });
  };

  report(0, STEPS[0]!.title);
  if (useDatasetStore.getState().datasets.length === 0) {
    await invokeTool("load_sample_dataset", { id: "payroll_2026" });
  }
  await sleep(800);

  report(1, STEPS[1]!.title);
  await invokeTool("add_finding", {
    title: "Gender pay gap review — started",
    body_markdown:
      "We will compare **headline** average pay by gender, then control for **grade**. " +
      "The sample plants a Simpson's paradox: women are under-represented at senior grades, " +
      "so a naive gap overstates the within-grade effect.",
    severity: "info",
    evidence_block_ids: [],
  });

  const headline = await invokeTool("add_chart", {
    title: "Headline average base salary by gender",
    sql: `SELECT gender, avg(base_salary) AS avg_salary, count(*) AS n
          FROM payroll WHERE base_salary > 0 GROUP BY gender`,
    mark: "bar",
    x: "gender",
    y: "avg_salary",
    caption: "Looks like a ~20% gap — but grade mix differs.",
  });
  await sleep(1200);

  report(2, STEPS[2]!.title);
  const controlled = await invokeTool("add_chart", {
    title: "Within-grade average salary by gender",
    sql: `SELECT grade, gender, avg(base_salary) AS avg_salary, count(*) AS n
          FROM payroll WHERE base_salary > 0 GROUP BY grade, gender`,
    mark: "bar",
    x: "grade",
    y: "avg_salary",
    color: "gender",
    caption: "Controlling for grade, the gap shrinks to ~7%.",
  });

  const evidenceIds = [
    headline.ok && headline.data && typeof headline.data === "object" && "block_id" in headline.data
      ? String((headline.data as { block_id: string }).block_id)
      : "",
    controlled.ok && controlled.data && typeof controlled.data === "object" && "block_id" in controlled.data
      ? String((controlled.data as { block_id: string }).block_id)
      : "",
  ].filter(Boolean);

  await sleep(1000);

  report(3, STEPS[3]!.title);
  await invokeTool("run_query", { sql: "SELECT * FROM payroll LIMIT 5" });
  await sleep(900);

  report(4, STEPS[4]!.title);
  await invokeTool("add_finding", {
    title: "Material: headline gap is mostly composition, not within-grade bias",
    body_markdown:
      "After controlling for **grade**, the gender pay gap is about **7%**, not the ~20% " +
      "suggested by headline averages. **Zero individual values** were released to the agent " +
      "during this session — only aggregates passed the airlock.",
    severity: "material",
    evidence_block_ids: evidenceIds,
  });
}

export { STEPS as DEMO_STEPS };
