import { describe, expect, it } from "vitest";

import { classifyColumn } from "./classify";

describe("classifyColumn", () => {
  it("marks employee_id as identifier", () => {
    expect(
      classifyColumn({
        name: "employee_id",
        sqlType: "VARCHAR",
        rowCount: 4000,
        distinctCount: 4000,
      }),
    ).toBe("identifier");
  });

  it("marks near-unique columns as identifier", () => {
    expect(
      classifyColumn({
        name: "record_key",
        sqlType: "BIGINT",
        rowCount: 100,
        distinctCount: 98,
      }),
    ).toBe("identifier");
  });

  it("marks gender as quasi_identifier", () => {
    expect(
      classifyColumn({
        name: "gender",
        sqlType: "VARCHAR",
        rowCount: 4000,
        distinctCount: 3,
      }),
    ).toBe("quasi_identifier");
  });

  it("marks base_salary as sensitive", () => {
    expect(
      classifyColumn({
        name: "base_salary",
        sqlType: "BIGINT",
        rowCount: 4000,
        distinctCount: 800,
      }),
    ).toBe("sensitive");
  });

  it("marks long free-text notes as free_text", () => {
    expect(
      classifyColumn({
        name: "notes",
        sqlType: "VARCHAR",
        rowCount: 4000,
        distinctCount: 3200,
        meanStringLength: 62,
      }),
    ).toBe("free_text");
  });

  it("marks tenure_years as measure", () => {
    expect(
      classifyColumn({
        name: "tenure_years",
        sqlType: "DOUBLE",
        rowCount: 4000,
        distinctCount: 120,
      }),
    ).toBe("measure");
  });
});
