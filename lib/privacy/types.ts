/** Column sensitivity class. Heuristics in classify.ts; the human can override in the UI. */
export type ColumnClassification =
  | "identifier"
  | "quasi_identifier"
  | "sensitive"
  | "measure"
  | "free_text";

export const CLASSIFICATION_LABELS: Record<ColumnClassification, string> = {
  identifier: "Identifier",
  quasi_identifier: "Quasi-identifier",
  sensitive: "Sensitive",
  measure: "Measure",
  free_text: "Free text",
};
