import type { Triage } from "../schema.js";
import type { Store } from "../store/store.js";
import type { IncidentInput, TriageProvider } from "./llm.js";

interface IncidentRow {
  session_id: string;
  endpoint_host: string;
  worst_severity: string;
  rules: string[];
  detections: string;
}
interface DetRow {
  rule: string;
  severity: string;
  summary: string;
  detail: string;
}

export interface TriageResult {
  candidates: number;
  triaged: number;
}

const key = (s: string, h: string) => `${s}\u0000${h}`;

/**
 * Triage incidents from the last 7 days that have no triage yet. ADVISORY: this writes ONLY the
 * `triage` table — it never calls appendDetections or touches rule severities, so a prompt-injected
 * model verdict can at worst mislabel an advisory note, never suppress a deterministic detection.
 */
export async function runTriage(store: Store, provider: TriageProvider): Promise<TriageResult> {
  const [incidents, existing] = await Promise.all([
    store.query<IncidentRow>(
      `SELECT session_id, endpoint_host, worst_severity, rules, detections
       FROM incidents WHERE ended >= now() - INTERVAL 7 DAY`,
    ),
    store.query<{ session_id: string; endpoint_host: string; detections: string }>(
      `SELECT session_id, endpoint_host, detections FROM triage FINAL`,
    ),
  ]);
  // Re-triage when the incident's detection count changed since its last triage (new tool
  // activity in the same session), not just on first sighting.
  const triagedCount = new Map(existing.map((t) => [key(t.session_id, t.endpoint_host), Number(t.detections)]));
  const pending = incidents.filter((i) => {
    const prev = triagedCount.get(key(i.session_id, i.endpoint_host));
    return prev === undefined || prev !== Number(i.detections);
  });

  const out: Triage[] = [];
  for (const inc of pending) {
    const detections = await store.query<DetRow>(
      `SELECT rule, severity, summary, detail FROM detections FINAL
       WHERE session_id = {s:String} AND endpoint_host = {h:String} ORDER BY ts`,
      { s: inc.session_id, h: inc.endpoint_host },
    );
    const input: IncidentInput = {
      session_id: inc.session_id,
      endpoint_host: inc.endpoint_host,
      worst_severity: inc.worst_severity,
      rules: inc.rules ?? [],
      detections,
    };
    const verdict = await provider.triage(input);
    out.push({
      ...verdict,
      session_id: inc.session_id,
      endpoint_host: inc.endpoint_host,
      detections: detections.length,
      model: provider.model,
    });
  }
  if (out.length > 0) await store.appendTriage(out);
  return { candidates: pending.length, triaged: out.length };
}
