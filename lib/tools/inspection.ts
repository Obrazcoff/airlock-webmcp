import { z } from "zod";

import { explainGuards, runGuardedQuery } from "@/lib/duckdb/runQuery";
import {
  histogramBuckets,
  topValueCounts,
} from "@/lib/duckdb/profile";
import { CLASSIFICATION_LABELS, type ColumnClassification } from "@/lib/privacy/types";
import {
  blockedColumns,
  columnClassifications,
  datasets as datasetState,
  getDataset,
} from "@/lib/store/datasets";
import { policy, usePolicyStore } from "@/lib/store/policy";
import { fail, ok } from "@/lib/tools/result";
import type { AnyAirlockTool } from "@/lib/webmcp/types";

const DatasetId = z.strictObject({
  dataset_id: z.string().min(1).describe("Id of the loaded dataset (same as the table name)."),
});

const ProfileColumnInput = z.strictObject({
  dataset_id: z.string().min(1),
  column: z.string().min(1),
  top_k: z.number().int().min(1).max(25).optional(),
});

const RunQueryInput = z.strictObject({
  sql: z.string().min(1).describe("A single read-only SELECT or WITH statement."),
  max_rows: z.number().int().min(1).max(1000).optional(),
});

const ExplainQueryInput = z.strictObject({
  sql: z.string().min(1),
});

const ProposePolicyInput = z.strictObject({
  dataset_id: z.string().min(1),
  column: z.string().min(1),
  proposed_classification: z.enum([
    "identifier",
    "quasi_identifier",
    "sensitive",
    "measure",
    "free_text",
  ]),
  rationale: z.string().min(10),
});

function requireDataset(id: string) {
  const dataset = getDataset(id);
  if (!dataset) {
    return fail(
      "not_found",
      `Unknown dataset: ${id}`,
      "Call list_datasets to see what is loaded.",
    );
  }
  return dataset;
}

const describeDataset: AnyAirlockTool = {
  tier: 1,
  name: "describe_dataset",
  description:
    "Return the schema for one loaded dataset: column names, SQL types, privacy " +
    "classifications, null fractions and distinct counts. Identifier columns are listed " +
    "but their statistics are withheld. Sample values are not returned — use " +
    "profile_column for distributions.",
  input: DatasetId,
  readOnly: true,
  async execute({ dataset_id }) {
    const datasetOrError = requireDataset(dataset_id);
    if (!("columns" in datasetOrError)) return datasetOrError;
    const dataset = datasetOrError;

    const columns = dataset.columns.map((column) => {
      if (column.blocked) {
        return { name: column.name, blocked: true as const };
      }

      const base = {
        name: column.name,
        sql_type: column.sqlType,
        classification: column.classification,
        classification_label: CLASSIFICATION_LABELS[column.classification],
      };

      if (column.classification === "identifier") {
        return { ...base, statistics_withheld: true as const };
      }

      const stats = column.stats;
      return {
        ...base,
        null_fraction: stats?.null_fraction,
        distinct_count: stats?.distinct_count,
        min: stats?.min,
        max: stats?.max,
        mean: stats?.mean,
        median: stats?.median,
      };
    });

    return ok(
      `${dataset.name}: ${dataset.columns.length} columns described.`,
      { dataset_id: dataset.id, row_count: dataset.rowCount, columns },
    );
  },
};

const profileColumn: AnyAirlockTool = {
  tier: 1,
  name: "profile_column",
  description:
    "Return the distribution of one column. Numeric columns get histogram buckets; " +
    "low-cardinality columns get top-k value counts with k-anonymity suppression. " +
    "Free-text columns return length statistics only, never verbatim values. Prefer this " +
    "over request_raw_rows when you only need a distribution.",
  input: ProfileColumnInput,
  readOnly: true,
  async execute({ dataset_id, column, top_k = 10 }) {
    const datasetOrError = requireDataset(dataset_id);
    if (!("columns" in datasetOrError)) return datasetOrError;
    const dataset = datasetOrError;

    const meta = dataset.columns.find((entry) => entry.name === column);
    if (!meta) {
      return fail("not_found", `Unknown column: ${column}`, "Call describe_dataset for the schema.");
    }

    if (meta.blocked || meta.classification === "identifier") {
      return fail(
        "policy_blocked",
        `Column ${column} cannot be profiled under its current classification.`,
        "Use aggregates on other columns, or propose_policy_change if the classification looks wrong.",
      );
    }

    const k = policy().kAnonymityThreshold;

    if (meta.classification === "free_text") {
      return ok(`Length statistics for ${column}.`, {
        column,
        kind: "free_text",
        mean_string_length: meta.stats?.mean_string_length,
        distinct_count: meta.stats?.distinct_count,
        note: "Verbatim text is never returned.",
      });
    }

    const numeric = /INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL/i.test(meta.sqlType);
    if (numeric) {
      const buckets = await histogramBuckets(dataset.id, column);
      const merged = buckets.map((bucket) =>
        bucket.count < k ? { bucket: bucket.bucket, count: "« suppressed »" as const } : bucket,
      );
      return ok(`Histogram for ${column}.`, {
        column,
        kind: "numeric",
        buckets: merged,
        k_threshold: k,
      });
    }

    const counts = await topValueCounts(dataset.id, column, top_k);
    const visible = counts.filter((entry) => entry.count >= k);
    const suppressed = counts.length - visible.length;

    if (visible.length === 0 && counts.length > 0) {
      return fail(
        "k_suppressed",
        `Every category in ${column} is below the k-anonymity threshold of ${k}.`,
        "Aggregate at a coarser level or widen the grouping.",
      );
    }

    return ok(`Top values for ${column}; ${suppressed} small bucket(s) suppressed.`, {
      column,
      kind: "categorical",
      values: visible,
      suppressed_buckets: suppressed,
      k_threshold: k,
    });
  },
};

const runQuery: AnyAirlockTool = {
  tier: 1,
  name: "run_query",
  description:
    "Run a read-only SQL query against the loaded datasets and return the result. " +
    "Only SELECT/WITH statements are accepted. Identifier and free-text columns are " +
    "redacted from the projection. Non-aggregate queries are rejected while " +
    "max_preview_rows is 0 — this is structural, not a setting you can talk the tool " +
    "into bypassing. Use GROUP BY with aggregates instead.",
  input: RunQueryInput,
  readOnly: true,
  async execute({ sql, max_rows }) {
    const loaded = datasetState().datasets;
    const primary = loaded[0];
    if (!primary) {
      return fail("not_found", "No dataset is loaded.", "Call load_sample_dataset first.");
    }

    const { maxPreviewRows, kAnonymityThreshold } = policy();

    return runGuardedQuery(sql, {
      maxPreviewRows,
      kThreshold: kAnonymityThreshold,
      classifications: columnClassifications(primary),
      blockedColumns: blockedColumns(primary),
      maxRows: max_rows,
    });
  },
};

const explainQuery: AnyAirlockTool = {
  tier: 1,
  name: "explain_query",
  description:
    "Check whether a SQL query would pass the statement and aggregate guards without " +
    "running it. Use this before run_query when you are unsure whether a rewrite is needed.",
  input: ExplainQueryInput,
  readOnly: true,
  async execute({ sql }) {
    const guards = explainGuards(sql, policy().maxPreviewRows);
    const passes = guards.statement_guard === "pass" && guards.aggregate_guard === "pass";

    return ok(
      passes ? "The query would pass the pre-execution guards." : "The query would be rejected.",
      guards,
    );
  },
};

const proposePolicyChange: AnyAirlockTool = {
  tier: 1,
  name: "propose_policy_change",
  description:
    "Suggest that a column's privacy classification may be wrong. Queues a suggestion " +
    "for the human in the policy editor; changes nothing by itself. An agent can ask " +
    "for more access but can never grant itself more access.",
  input: ProposePolicyInput,
  readOnly: false,
  async execute(input) {
    const datasetOrError = requireDataset(input.dataset_id);
    if (!("columns" in datasetOrError)) return datasetOrError;
    const dataset = datasetOrError;

    if (!dataset.columns.some((column) => column.name === input.column)) {
      return fail("not_found", `Unknown column: ${input.column}`);
    }

    const suggestion = usePolicyStore.getState().addSuggestion({
      dataset_id: input.dataset_id,
      column: input.column,
      proposed_classification: input.proposed_classification as ColumnClassification,
      rationale: input.rationale,
    });

    return ok(
      `Queued a policy suggestion for ${input.column} → ${input.proposed_classification}.`,
      { suggestion_id: suggestion.id },
    );
  },
};

export const INSPECTION_TOOLS: AnyAirlockTool[] = [
  describeDataset,
  profileColumn,
  runQuery,
  explainQuery,
  proposePolicyChange,
];
