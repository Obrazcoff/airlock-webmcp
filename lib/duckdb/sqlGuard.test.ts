import { describe, expect, it } from "vitest";

import { checkSql } from "./sqlGuard";

const allowed = (sql: string) => checkSql(sql).allowed;

const denial = (sql: string) => {
  const verdict = checkSql(sql);
  if (verdict.allowed) throw new Error(`Expected a denial for: ${sql}`);
  return verdict;
};

describe("checkSql — read-only queries pass", () => {
  it.each([
    "SELECT count(*) FROM payroll",
    "select department, avg(base_salary) from payroll group by department",
    "WITH banded AS (SELECT grade FROM payroll) SELECT count(*) FROM banded",
    "FROM payroll SELECT count(*)",
    "TABLE payroll",
    "(SELECT 1) UNION ALL (SELECT 2)",
    "SELECT * FROM payroll",
    "sELeCt COUNT(*) FrOm payroll",
    "SELECT avg(base_salary) FILTER (WHERE base_salary > 0) FROM payroll",
    "SELECT department, gender, count(*) FROM payroll GROUP BY GROUPING SETS ((department), (gender))",
    "SELECT employee_id FROM payroll ORDER BY base_salary DESC OFFSET 10 LIMIT 5",
  ])("allows %s", (sql) => {
    expect(allowed(sql)).toBe(true);
  });

  // SELECT * is the aggregate guard's problem, not the statement guard's. Rejecting it
  // here would put the same rule in two places and make the second one dead code.
  it("allows per-row output, leaving row limits to the aggregate guard", () => {
    expect(allowed("SELECT * FROM payroll")).toBe(true);
  });
});

describe("checkSql — literals cannot pose as syntax", () => {
  it("does not treat a semicolon inside a string as a statement separator", () => {
    expect(allowed("SELECT 'one; two' AS label")).toBe(true);
  });

  it("does not read keywords inside string literals", () => {
    expect(allowed("SELECT count(*) FROM payroll WHERE notes = 'please attach the file'")).toBe(
      true,
    );
  });

  it("handles doubled single quotes", () => {
    expect(allowed("SELECT 'it''s fine; really' AS label")).toBe(true);
  });

  it("does not read keywords inside quoted identifiers", () => {
    expect(allowed('SELECT "drop table" FROM payroll')).toBe(true);
  });

  it("handles dollar-quoted strings", () => {
    expect(allowed("SELECT $$; DROP TABLE payroll$$ AS label")).toBe(true);
  });

  it("handles tagged dollar quoting", () => {
    expect(allowed("SELECT $note$ ATTACH 'evil.db' $note$ AS label")).toBe(true);
  });

  it("ignores keywords inside line comments", () => {
    expect(allowed("SELECT count(*) FROM payroll -- DROP TABLE payroll\n")).toBe(true);
  });

  it("ignores keywords inside nested block comments", () => {
    expect(allowed("/* outer /* ATTACH */ still comment */ SELECT 1")).toBe(true);
  });

  // A comment that swallows the newline must not let the next line through as data.
  it("still sees a statement hidden after a line comment", () => {
    expect(denial("SELECT 1 --\nDROP TABLE payroll").reason).toContain("DROP");
  });
});

describe("checkSql — statement shape", () => {
  it.each(["", "   ", "\n\t"])("rejects the empty query %j", (sql) => {
    expect(denial(sql).reason).toContain("empty");
  });

  it("rejects more than one statement", () => {
    expect(denial("SELECT 1; SELECT 2").reason).toContain("2 statements");
  });

  it("rejects a piggybacked mutation", () => {
    expect(denial("SELECT 1; DROP TABLE payroll").allowed).toBe(false);
  });

  it("tolerates a single trailing semicolon", () => {
    expect(allowed("SELECT count(*) FROM payroll;")).toBe(true);
  });

  it.each([
    "INSERT INTO payroll VALUES (1)",
    "UPDATE payroll SET base_salary = 0",
    "DELETE FROM payroll",
    "CREATE TABLE leak AS SELECT * FROM payroll",
    "DROP TABLE payroll",
  ])("rejects the mutation %s", (sql) => {
    expect(denial(sql).allowed).toBe(false);
  });

  it("rejects an unterminated string literal", () => {
    expect(denial("SELECT 'unclosed FROM payroll").reason).toContain("unterminated");
  });

  it("rejects an unterminated block comment", () => {
    expect(denial("SELECT 1 /* unclosed").reason).toContain("unterminated");
  });
});

describe("checkSql — the filesystem stays closed", () => {
  it.each([
    "SELECT * FROM read_csv('/etc/passwd')",
    "SELECT * FROM read_csv_auto('~/Documents/salaries.csv')",
    "SELECT * FROM read_parquet('s3://bucket/all.parquet')",
    "SELECT * FROM read_json('/tmp/x.json')",
    "SELECT * FROM read_text('/etc/hosts')",
    "SELECT * FROM glob('/Users/**')",
    "SELECT * FROM parquet_scan('x.parquet')",
    "SELECT * FROM sqlite_scan('notes.db', 'notes')",
  ])("rejects %s", (sql) => {
    expect(denial(sql).reason).toContain("outside the loaded datasets");
  });

  it("rejects a table function called with odd spacing", () => {
    expect(denial("SELECT * FROM read_csv   ('/etc/passwd')").allowed).toBe(false);
  });

  it("rejects a table function with a comment between name and arguments", () => {
    expect(denial("SELECT * FROM read_csv/**/('/etc/passwd')").allowed).toBe(false);
  });

  // Quoting hides the name from every name-based check, and DuckDB resolves it anyway.
  it("rejects a function called through a quoted identifier", () => {
    expect(denial(`SELECT * FROM "read_csv"('/etc/passwd')`).reason).toContain(
      "quoted identifier",
    );
  });

  // Readers DuckDB shipped after the first version of this guard was written. They pass
  // only because the check matches families rather than a list of names.
  it.each([
    "SELECT * FROM read_xlsx('salaries.xlsx')",
    "SELECT * FROM read_avro('events.avro')",
    "SELECT * FROM read_blob('/etc/shadow')",
    "SELECT * FROM iceberg_scan('warehouse/table')",
    "SELECT * FROM delta_scan('s3://bucket/delta')",
  ])("rejects the newer reader %s", (sql) => {
    expect(denial(sql).allowed).toBe(false);
  });

  // DuckDB needs no function name: a bare string in FROM position is a file path. This
  // is the case that blocking read_* alone would miss entirely.
  it("rejects a bare file path in FROM position", () => {
    expect(denial("SELECT * FROM 'payroll.parquet'").reason).toContain("file path");
  });

  it("rejects a bare file path in JOIN position", () => {
    expect(
      denial("SELECT * FROM payroll JOIN 'extra.csv' USING (employee_id)").reason,
    ).toContain("file path");
  });

  it.each([
    "ATTACH 'other.db' AS other",
    "COPY payroll TO '/tmp/leak.csv'",
    "EXPORT DATABASE '/tmp/dump'",
    "INSTALL httpfs",
    "LOAD httpfs",
    "PRAGMA database_list",
    "SET enable_external_access = true",
  ])("rejects the escape hatch %s", (sql) => {
    expect(denial(sql).allowed).toBe(false);
  });

  // COPY … TO is a write, and it is the one that turns a read-only-looking session into
  // data leaving the machine.
  it("rejects COPY even when wrapped in a SELECT-looking statement", () => {
    expect(denial("SELECT 1; COPY payroll TO '/tmp/leak.csv'").allowed).toBe(false);
  });
});

describe("checkSql — denials are actionable", () => {
  it("always supplies a hint", () => {
    const cases = [
      "",
      "SELECT 1; SELECT 2",
      "DROP TABLE payroll",
      "SELECT * FROM read_csv('/etc/passwd')",
      "SELECT * FROM 'x.parquet'",
      "SELECT 'unclosed",
    ];

    for (const sql of cases) {
      expect(denial(sql).hint.length).toBeGreaterThan(0);
    }
  });
});
