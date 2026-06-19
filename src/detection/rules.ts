import type { Finding } from "../schema.js";

/** A detection rule: a SQL match over `events`, tagged with id + severity. */
export interface Rule {
  id: string;
  severity: Finding["severity"];
  title: string;
  sql: string;
}

/** Columns every rule SELECTs so the runner can shape a Finding from each match. */
const PROJECT = `event_id, ts, endpoint_user, endpoint_host, session_id,
  concat(tool, ' · ', tier, ' · ', decision) AS summary, detail`;

/**
 * Detections-as-code. Each rule SELECTs matching events; the runner wraps each
 * row into a Finding (`finding_id = rule:event_id`, so re-runs dedup). These ride
 * on signals coble already produces at the edge — crowsnest aggregates them.
 */
export const rules: Rule[] = [
  {
    id: "denied-dangerous",
    severity: "high",
    title: "Denied dangerous command",
    sql: `SELECT ${PROJECT} FROM events WHERE decision = 'denied' AND tier = 'dangerous'`,
  },
  {
    id: "bypass-mode",
    severity: "medium",
    title: "Bypass mode used",
    sql: `SELECT ${PROJECT} FROM events WHERE mode = 'bypass'`,
  },
  {
    id: "sandbox-off-dangerous",
    severity: "medium",
    title: "Dangerous call with the sandbox off",
    sql: `SELECT ${PROJECT} FROM events WHERE sandbox_on = 0 AND tier = 'dangerous'`,
  },
  {
    id: "denied-read",
    severity: "high",
    title: "Denied read (possible secret-path access)",
    sql: `SELECT ${PROJECT} FROM events WHERE decision = 'denied' AND tool = 'read_file'`,
  },
];
