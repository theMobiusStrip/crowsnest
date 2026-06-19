import type { Hono } from "hono";
import type { Store } from "../store/store.js";

/**
 * Read API that the spyglass dashboard consumes. Queries the `findings` table
 * with `FINAL` so ReplacingMergeTree dedup is applied at read time.
 */
export function registerReadApi(app: Hono, store: Store): void {
  // Recent findings, newest first. Optional ?severity= &rule= &limit=
  app.get("/v1/findings", async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 100), 1), 1000);
    const severity = c.req.query("severity");
    const rule = c.req.query("rule");
    const where: string[] = [];
    const params: Record<string, unknown> = { limit };
    if (severity) {
      where.push("severity = {severity:String}");
      params.severity = severity;
    }
    if (rule) {
      where.push("rule = {rule:String}");
      params.rule = rule;
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const findings = await store.query(
      `SELECT finding_id, rule, severity, ts, event_id, endpoint_user, endpoint_host, session_id, summary, detail
       FROM findings FINAL ${clause} ORDER BY ts DESC LIMIT {limit:UInt32}`,
      params,
    );
    return c.json({ findings });
  });

  // Summary stats for the dashboard.
  app.get("/v1/stats", async (c) => {
    const [totals, bySeverity, byRule, byDay] = await Promise.all([
      store.query(`SELECT count() AS findings FROM findings FINAL`),
      store.query(`SELECT severity, count() AS n FROM findings FINAL GROUP BY severity`),
      store.query(`SELECT rule, count() AS n FROM findings FINAL GROUP BY rule ORDER BY n DESC`),
      store.query(`SELECT toDate(ts) AS day, count() AS n FROM findings FINAL GROUP BY day ORDER BY day DESC LIMIT 14`),
    ]);
    return c.json({ totals: totals[0] ?? { findings: 0 }, bySeverity, byRule, byDay });
  });
}
