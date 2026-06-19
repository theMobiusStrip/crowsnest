import type { Event, Detection, Triage } from "../schema.js";

/**
 * Storage seam. The ingest server and detection runner depend on this interface,
 * not on ClickHouse — so the local single-node store swaps for a cluster (or a
 * different engine) without touching business logic.
 */
export interface Store {
  /** Append events. Idempotent at the storage layer (dedup by `event_id`). */
  append(events: Event[]): Promise<void>;
  /** Append detections. Idempotent (dedup by `detection_id`). */
  appendDetections(detections: Detection[]): Promise<void>;
  /** Append advisory LLM triage (append-only audit log; latest/manual derived at read time). */
  appendTriage(triage: Triage[]): Promise<void>;
  /** Upsert runtime config key/values (admin console). */
  setConfig(entries: { key: string; value: string }[]): Promise<void>;
  /** Run a read query (detection runner / read API). */
  query<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]>;
  /** Liveness check for `/healthz`. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
