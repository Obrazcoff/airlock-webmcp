import { describe, expect, it } from "vitest";

import {
  columnsMatchResult,
  countCells,
  rawRequestFingerprint,
  rejectsSelectStar,
} from "@/lib/airlock/rawRequest";

describe("rawRequestFingerprint", () => {
  it("normalises whitespace in sql", () => {
    const a = rawRequestFingerprint({
      sql: "SELECT  a,\nb FROM t",
      columns: ["a", "b"],
      row_limit: 5,
    });
    const b = rawRequestFingerprint({
      sql: "SELECT a, b FROM t",
      columns: ["b", "a"],
      row_limit: 5,
    });
    expect(a).toBe(b);
  });
});

describe("rejectsSelectStar", () => {
  it("flags SELECT *", () => {
    expect(rejectsSelectStar("SELECT * FROM payroll")).toBe(true);
    expect(rejectsSelectStar("select  *  from payroll")).toBe(true);
    expect(rejectsSelectStar("SELECT employee_id FROM payroll")).toBe(false);
  });
});

describe("columnsMatchResult", () => {
  it("requires exact column sets", () => {
    expect(columnsMatchResult(["a", "b"], ["a", "b"]).ok).toBe(true);
    expect(columnsMatchResult(["a"], ["a", "b"]).ok).toBe(false);
    expect(columnsMatchResult(["a", "c"], ["a", "b"]).ok).toBe(false);
  });
});

describe("countCells", () => {
  it("multiplies rows by columns", () => {
    expect(countCells(5, 4)).toBe(20);
  });
});
