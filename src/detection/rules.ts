import type { Detection } from "../schema.js";

/** A detection rule: a SQL match over `events`, tagged with id + severity. */
export interface Rule {
  id: string;
  severity: Detection["severity"];
  title: string;
  sql: string;
}

/** Columns every rule SELECTs so the runner can shape a Detection from each match. */
const PROJECT = `event_id, ts, endpoint_user, endpoint_host, session_id,
  concat(tool, ' · ', tier, ' · ', decision) AS summary, detail`;

/**
 * Detections-as-code. Each rule SELECTs matching events; the runner wraps each
 * row into a Detection (`detection_id = rule:event_id`, so re-runs dedup). These ride
 * on signals coble already produces at the edge — crowsnest aggregates them.
 */
export const rules: Rule[] = [
  {
    id: "denied-dangerous",
    severity: "high",
    title: "Denied dangerous command",
    sql: `SELECT ${PROJECT} FROM events FINAL WHERE decision = 'denied' AND tier = 'dangerous'`,
  },
  {
    id: "bypass-mode",
    severity: "medium",
    title: "Bypass mode used",
    sql: `SELECT ${PROJECT} FROM events FINAL WHERE mode = 'bypass'`,
  },
  {
    id: "sandbox-off-dangerous",
    severity: "medium",
    title: "Dangerous call with the sandbox off",
    sql: `SELECT ${PROJECT} FROM events FINAL WHERE sandbox_on = 0 AND tier = 'dangerous'`,
  },
  {
    id: "denied-read",
    severity: "medium",
    title: "Blocked read (possible secret-path access)",
    // coble blocks secret-path reads INSIDE the tool (the deny-read policy throws),
    // which it audits as decision='error' — not 'denied' (that's only a pre-invoke
    // rule/mode deny). Match both so the built-in protection's signal isn't missed.
    sql: `SELECT ${PROJECT} FROM events FINAL WHERE decision IN ('denied', 'error') AND tool = 'read_file'`,
  },
  {
    id: "remote-egress",
    severity: "low",
    title: "Remote egress (push / PR)",
    // Code/PR leaving the machine. coble's git_push targets origin and create_pull_request
    // opens a PR; "non-origin" isn't structurally distinguishable (a raw `git push <remote>`
    // rides inside bash detail), so this surfaces push/PR egress that actually executed.
    sql: `SELECT ${PROJECT} FROM events FINAL WHERE tool IN ('git_push', 'create_pull_request') AND decision IN ('approved', 'auto')`,
  },
];
