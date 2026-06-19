import type { Finding } from "../schema.js";
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
 * Run every detection rule against the store and write findings. Idempotent:
 * `finding_id = rule:event_id`, so re-running over the same events is deduped by
 * the findings table (ReplacingMergeTree) — a simple scan-all is fine at MVP scale.
 */
export async function runDetections(store: Store): Promise<RuleResult[]> {
  const results: RuleResult[] = [];
  for (const r of rules) {
    const rows = await store.query<MatchRow>(r.sql);
    const findings: Finding[] = rows.map((row) => ({
      finding_id: `${r.id}:${row.event_id}`,
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
    if (findings.length > 0) await store.appendFindings(findings);
    results.push({ rule: r.id, found: findings.length });
  }
  return results;
}
