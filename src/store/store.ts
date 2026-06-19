import type { Event, Finding } from "../schema.js";

/**
 * Storage seam. The ingest server and detection runner depend on this interface,
 * not on ClickHouse — so the local single-node store swaps for a cluster (or a
 * different engine) without touching business logic.
 */
export interface Store {
  /** Append events. Idempotent at the storage layer (dedup by `event_id`). */
  append(events: Event[]): Promise<void>;
  /** Append detection findings. Idempotent (dedup by `finding_id`). */
  appendFindings(findings: Finding[]): Promise<void>;
  /** Run a read query (detection runner / read API). */
  query<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]>;
  /** Liveness check for `/healthz`. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
