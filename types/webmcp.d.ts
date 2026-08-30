// Ambient declarations for the WebMCP Imperative API.
//
// WebMCP is a W3C Web Machine Learning Community Group draft, not a shipped standard, so
// there are no official typings. The shape below follows the draft and Chrome's origin
// trial implementation as of August 2026.
//
// The entry point moved from `navigator.modelContext` to `document.modelContext` in
// Chrome 150. Both are declared because Chrome 146-149 only has the former, and the
// origin trial spans 149-156.

interface ModelContextToolAnnotations {
  /** True when the tool neither mutates state nor discloses data. Agents may reorder or
   * cache such calls, so setting it optimistically is a real bug. */
  readOnlyHint?: boolean;
}

interface ModelContextTool {
  /** Unique within the document. Spec regex: [A-Za-z0-9_\-.]{1,128} */
  name: string;
  description: string;
  /** JSON Schema. The browser does NOT validate against it before calling execute. */
  inputSchema?: Record<string, unknown>;
  annotations?: ModelContextToolAnnotations;
  execute(input: Record<string, unknown>): Promise<unknown> | unknown;
}

interface ModelContextRegisterOptions {
  /** Aborting deregisters the tool. This is the only portable path: there is no
   * cross-version unregisterTool. */
  signal?: AbortSignal;
}

interface ModelContext {
  registerTool(tool: ModelContextTool, options?: ModelContextRegisterOptions): void;
  /** Present in the draft for in-page discovery; not relied upon. */
  getTools?(): ModelContextTool[];
}

interface Document {
  readonly modelContext?: ModelContext;
}

interface Navigator {
  readonly modelContext?: ModelContext;
}
