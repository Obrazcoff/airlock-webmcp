import { z, type ZodType } from "zod";

/**
 * Generate the JSON Schema an agent sees from the Zod schema the handler enforces.
 *
 * Deriving one from the other is the point: the browser does not validate inputSchema
 * before calling execute, so the advertised contract and the enforced contract are two
 * different mechanisms. If they were written separately they would drift, and the drift
 * would show up as an agent confidently sending input that gets rejected.
 */
export function toJsonSchema(schema: ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
}
