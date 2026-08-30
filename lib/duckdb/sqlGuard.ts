/**
 * Lexical guard for every SQL string that reaches DuckDB, whatever its source: an agent,
 * the in-page agent, or the human typing into the query box.
 *
 * This is the first of two layers. It is a tokenizer, not a parser, and a tokenizer will
 * always differ from the real grammar somewhere — so `run_query` also asks DuckDB to
 * serialise the statement's own AST before running it, and checks that. The two layers
 * exist because a single hand-written check on the load-bearing control is exactly the
 * kind of thing that has a bypass nobody found.
 *
 * The guard is deliberately biased toward rejection. A wrongly refused query costs the
 * agent one retry against an error that says what to do instead; a wrongly accepted one
 * costs the guarantee the whole product rests on.
 *
 * See docs/04-privacy-model.md, "The five enforcement points".
 */

export type SqlGuardVerdict =
  | { allowed: true }
  | { allowed: false; reason: string; hint: string };

/**
 * Statement forms with no read-only reading. `SET` and `PRAGMA` are here because DuckDB
 * settings include ones that re-enable filesystem access, so they are not the harmless
 * configuration they look like.
 */
const FORBIDDEN_KEYWORDS = [
  "attach",
  "detach",
  "copy",
  "export",
  "import",
  "install",
  "load",
  "pragma",
  "set",
  "reset",
  "call",
  "insert",
  "update",
  "delete",
  "merge",
  "create",
  "alter",
  "drop",
  "truncate",
  "grant",
  "revoke",
  "vacuum",
  "checkpoint",
  "begin",
  "start",
  "commit",
  "rollback",
  "prepare",
  "execute",
  "deallocate",
  "analyze",
  "explain",
  "describe",
  "show",
  "use",
  "into",
] as const;

/**
 * Table functions that reach outside the registered datasets, matched as families rather
 * than as a list of names.
 *
 * An enumerated list is wrong by construction here: `read_xlsx` and `read_avro` arrived
 * after `read_csv`, and whatever DuckDB adds next would walk straight through a list
 * written today. `read_*` and `*_scan` cover every reader DuckDB has shipped and every
 * one it is likely to ship, and no legitimate query against a loaded dataset calls
 * either.
 *
 * `glob` is included because enumerating the filesystem is a disclosure even when
 * nothing is read.
 */
const FORBIDDEN_FUNCTION_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bread_[a-z0-9_]*\s*\(/, label: "a read_* file reader" },
  { pattern: /\b[a-z0-9_]*_scan\s*\(/, label: "a *_scan external reader" },
  { pattern: /\bsniff_csv\s*\(/, label: "sniff_csv()" },
  { pattern: /\bglob\s*\(/, label: "glob()" },
  { pattern: /\bsqlite_attach\s*\(/, label: "sqlite_attach()" },
  { pattern: /\bst_read[a-z0-9_]*\s*\(/, label: "a spatial file reader" },
  { pattern: /\bshapefile_meta\s*\(/, label: "shapefile_meta()" },
  { pattern: /\bload_aws_credentials\s*\(/, label: "load_aws_credentials()" },
];

/** Marks where a string literal stood, so `FROM 'file.parquet'` stays detectable. */
const STRING = "\u0000s\u0000";
/** Marks where a quoted identifier stood, so its contents are never scanned. */
const IDENT = "\u0000i\u0000";

type Normalised = {
  /** Comments removed, literals replaced by markers, whitespace collapsed. */
  text: string;
  unterminated: string | null;
};

/**
 * Remove comments and blank out literals.
 *
 * Doing this first is what makes the rest of the guard trustworthy. A semicolon or the
 * word `attach` inside a string literal must not be read as syntax, and the contents of a
 * quoted identifier must not be read as a keyword. Every check below runs on text where
 * literals cannot lie about structure.
 */
function normalise(sql: string): Normalised {
  let out = "";
  let i = 0;

  while (i < sql.length) {
    const char = sql[i]!;
    const next = sql[i + 1];

    if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      out += " ";
      continue;
    }

    // DuckDB nests block comments, so depth has to be tracked rather than searching for
    // the first closing pair.
    if (char === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth += 1;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth -= 1;
          i += 2;
        } else {
          i += 1;
        }
      }
      if (depth > 0) return { text: out, unterminated: "block comment" };
      out += " ";
      continue;
    }

    if (char === "'") {
      i += 1;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        // E'...' allows backslash escapes; treating them uniformly is safe because we
        // only need to find the end, never the value.
        if (sql[i] === "\\" && i + 1 < sql.length) {
          i += 2;
          continue;
        }
        i += 1;
      }
      if (!closed) return { text: out, unterminated: "string literal" };
      out += STRING;
      continue;
    }

    if (char === '"') {
      i += 1;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        i += 1;
      }
      if (!closed) return { text: out, unterminated: "quoted identifier" };
      out += IDENT;
      continue;
    }

    // Dollar quoting: $$...$$ or $tag$...$tag$. Without this, everything between the
    // dollars would be scanned as if it were syntax.
    if (char === "$") {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tag) {
        const delimiter = tag[0];
        const end = sql.indexOf(delimiter, i + delimiter.length);
        if (end === -1) return { text: out, unterminated: "dollar-quoted string" };
        i = end + delimiter.length;
        out += STRING;
        continue;
      }
    }

    out += char;
    i += 1;
  }

  return { text: out, unterminated: null };
}

const deny = (reason: string, hint: string): SqlGuardVerdict => ({
  allowed: false,
  reason,
  hint,
});

const ALLOWED_TABLES_HINT =
  "Query the loaded datasets by name. Use describe_dataset to see what is available.";

export function checkSql(sql: string): SqlGuardVerdict {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    return deny("The query is empty.", "Send a single SELECT statement.");
  }

  const { text, unterminated } = normalise(sql);

  if (unterminated) {
    return deny(
      `The query ends inside an unterminated ${unterminated}.`,
      "Close the quote or comment and try again.",
    );
  }

  const collapsed = text.replace(/\s+/g, " ").trim();

  const statements = collapsed
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  if (statements.length === 0) {
    return deny("The query contains no statement.", "Send a single SELECT statement.");
  }

  if (statements.length > 1) {
    return deny(
      `The query contains ${statements.length} statements. Exactly one is allowed.`,
      "Split the work across separate run_query calls.",
    );
  }

  const statement = statements[0]!;
  const lower = statement.toLowerCase();

  // Leading parens are legal — `(SELECT 1) UNION (SELECT 2)` — so they are skipped
  // rather than treated as an unknown root.
  const root = /^[(\s]*([a-z_]+)/.exec(lower)?.[1];

  if (root !== "select" && root !== "with" && root !== "table" && root !== "from") {
    return deny(
      `Only SELECT and WITH statements are allowed. This one starts with "${root ?? statement.slice(0, 12)}".`,
      "Rewrite it as a read-only SELECT.",
    );
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`).test(lower)) {
      return deny(
        `The query uses "${keyword.toUpperCase()}", which is not permitted. Only read-only SELECT statements run here.`,
        keyword === "load" || keyword === "set"
          ? "If that was a column name, quote it as an identifier."
          : "Rewrite it as a read-only SELECT.",
      );
    }
  }

  for (const { pattern, label } of FORBIDDEN_FUNCTION_PATTERNS) {
    if (pattern.test(lower)) {
      return deny(
        `The query calls ${label}, which reads outside the loaded datasets.`,
        ALLOWED_TABLES_HINT,
      );
    }
  }

  // A quoted identifier followed by an open paren is a function call whose name the
  // checks above cannot see, because quoting hid it behind a marker. DuckDB resolves
  // "read_csv"('/etc/passwd') exactly like the unquoted form, and no query worth running
  // needs a quoted function name.
  if (new RegExp(`${IDENT}\\s*\\(`).test(lower)) {
    return deny(
      "The query calls a function through a quoted identifier, which hides its name.",
      "Write the function name unquoted so it can be checked.",
    );
  }

  // DuckDB will happily treat a bare string in FROM position as a file path -
  // `SELECT * FROM 'payroll.parquet'` needs no function name at all. Blocking the
  // read_* functions without this leaves the front door open.
  if (new RegExp(`\\b(from|join)\\s*${STRING}`).test(lower)) {
    return deny(
      "The query reads from a file path. DuckDB treats a bare string in FROM position as a file.",
      ALLOWED_TABLES_HINT,
    );
  }

  return { allowed: true };
}
