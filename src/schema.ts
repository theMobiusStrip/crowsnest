import { z } from "zod";

/**
 * Current event schema version. Bump on a breaking change; every event carries it
 * so a fleet of mixed coble versions stays parseable (multi-endpoint seam).
 */
export const SCHEMA_VERSION = 1;

export const DangerTier = z.enum(["safe", "confirm", "dangerous"]);
export const Decision = z.enum(["auto", "approved", "denied", "error"]);

/**
 * One coble tool decision — the wire contract shared with coble's HttpSink.
 * `detail` / summaries are redacted **at the edge (in coble)** before sending.
 */
export const EventSchema = z.object({
  schema_version: z.number().int().default(SCHEMA_VERSION),
  event_id: z.string().min(1), // dedup key (uuid) — enables at-least-once shipping
  ts: z.string().datetime({ offset: true }), // ISO-8601
  endpoint: z.object({ user: z.string(), host: z.string() }),
  repo: z.string().optional(),
  session_id: z.string().min(1),
  coble_version: z.string(),
  mode: z.string(), // plan | default | careful | auto | bypass
  sandbox_on: z.boolean(),
  tool: z.string(),
  tier: DangerTier,
  decision: Decision,
  detail: z.string().optional(),
});

export type Event = z.infer<typeof EventSchema>;

/** Batch envelope for `POST /v1/events`. */
export const EventBatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(1000),
});

export type EventBatch = z.infer<typeof EventBatchSchema>;
