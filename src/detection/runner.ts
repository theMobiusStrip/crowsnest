import type { Detection } from "../schema.js";
import type { Store } from "../store/store.js";
import { rules } from "./rules.js";

interface MatchRow {
  event_id: string;
  ts: string;
  endpoint_user: string;
  endpoint_host: string;
  session_id: string;
  summary: string;
  detail: string;
}

export interface RuleResult {
  rule: string;
  found: number;
}

/**
 * Run every detection rule against the store and write detections. Idempotent:
 * `detection_id = rule:event_id`, so re-running over the same events is deduped by
 * the detections table (ReplacingMergeTree) — a simple scan-all is fine at MVP scale.
 */
export async function runDetections(store: Store): Promise<RuleResult[]> {
  const results: RuleResult[] = [];
  for (const r of rules) {
    const rows = await store.query<MatchRow>(r.sql);
    const detections: Detection[] = rows.map((row) => ({
      detection_id: `${r.id}:${row.event_id}`,
      rule: r.id,
      severity: r.severity,
      ts: row.ts,
      event_id: row.event_id,
      endpoint_user: row.endpoint_user,
      endpoint_host: row.endpoint_host,
      session_id: row.session_id,
      summary: `${r.title} — ${row.summary}`,
      detail: row.detail,
    }));
    if (detections.length > 0) await store.appendDetections(detections);
    results.push({ rule: r.id, found: detections.length });
  }
  return results;
}
