import type { ColumnClassification } from "@/lib/privacy/types";

export interface ClassifyInput {
  name: string;
  sqlType: string;
  rowCount: number;
  distinctCount: number;
  meanStringLength?: number;
}

const IDENTIFIER_NAME =
  /(?:^|_)(?:id|uuid|guid|email|ssn|sin|phone|mobile|employee_id|manager_id|user_id|account_id)(?:$|_)/i;

const QUASI_NAME =
  /(?:gender|sex|age|band|department|dept|location|city|postcode|zip|grade|level|team|division|country|region|manager)/i;

const SENSITIVE_NAME =
  /(?:salary|wage|pay|bonus|compensation|diagnosis|religion|performance|rating|ethnic|disability|health)/i;

const NUMERIC_TYPE = /(?:INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|BIGINT|SMALLINT|TINYINT|HUGEINT|REAL)/i;

/** Bias toward over-classification. See docs/04-privacy-model.md. */
export function classifyColumn(input: ClassifyInput): ColumnClassification {
  const { name, sqlType, rowCount, distinctCount, meanStringLength = 0 } = input;
  const distinctRatio = rowCount > 0 ? distinctCount / rowCount : 0;

  if (IDENTIFIER_NAME.test(name) || distinctRatio > 0.95) {
    return "identifier";
  }

  if (SENSITIVE_NAME.test(name)) {
    return "sensitive";
  }

  if (QUASI_NAME.test(name)) {
    return "quasi_identifier";
  }

  const isString = /CHAR|TEXT|STRING|VARCHAR|UUID/i.test(sqlType);
  if (isString && meanStringLength > 40 && distinctRatio > 0.2) {
    return "free_text";
  }

  if (NUMERIC_TYPE.test(sqlType)) {
    return "measure";
  }

  if (isString && distinctRatio <= 0.05) {
    return "quasi_identifier";
  }

  if (isString) {
    return "free_text";
  }

  return "measure";
}

/** Columns stripped from query output. Identifiers never leave; blocked columns never leave. */
export function isRedactedFromOutput(
  classification: ColumnClassification,
  blocked: boolean,
): boolean {
  return blocked || classification === "identifier" || classification === "free_text";
}

/** Grouping keys that trigger k-anonymity review on aggregated output. */
export function triggersKAnonymity(classification: ColumnClassification): boolean {
  return classification === "quasi_identifier";
}
