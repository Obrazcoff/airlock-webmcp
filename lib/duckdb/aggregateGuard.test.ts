import { describe, expect, it } from "vitest";

import { isAggregateQuery } from "./aggregateGuard";

describe("isAggregateQuery", () => {
  it.each([
    "SELECT count(*) FROM payroll",
    "SELECT department, avg(base_salary) FROM payroll GROUP BY department",
    "WITH x AS (SELECT 1) SELECT sum(n) FROM x",
  ])("detects aggregate %s", (sql) => {
    expect(isAggregateQuery(sql)).toBe(true);
  });

  it.each([
    "SELECT * FROM payroll",
    "SELECT employee_id, base_salary FROM payroll",
    "SELECT DISTINCT department FROM payroll",
  ])("rejects row-level %s", (sql) => {
    expect(isAggregateQuery(sql)).toBe(false);
  });
});
