import type { Context, Hono } from "hono";
import type { Store } from "../store/store.js";

/** prod/ci/dev weighting from a host-naming convention (no infra lookup table needed).
 *  Anchored to `prod-*` / `ci-*` / `stg-*` / `staging-*` (or the bare word) so unrelated
 *  hosts like `cinder` or `prodigy` aren't inflated to ci/prod weight. */
function hostSensitivity(host: string): number {
  if (/^prod(-|$)/i.test(host)) return 3;
  if (/^(ci|stg|staging)(-|$)/i.test(host)) return 2;
  return 1;
}

/** Shared severity/rule/host filter for the detection list + stats. Parameterised — never
 *  interpolates user input into SQL. */
function detectionFilter(c: Context): { clause: string; params: Record<string, unknown> } {
  const cols: [string, string][] = [
    ["severity", "severity"],
    ["rule", "rule"],
    ["host", "endpoint_host"],
  ];
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  for (const [key, col] of cols) {
    const v = c.req.query(key);
    if (v) {
      where.push(`${col} = {${key}:String}`);
      params[key] = v;
    }
  }
  return { clause: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

interface FleetRow {
  endpoint_host: string;
  events: number;
  last_seen: string | null;
  stale: boolean;
  sensitivity: number;
  detections: number;
  crit: number;
  high: number;
  medium: number;
  low: number;
  risk: number;
}

/**
 * Read API the spyglass dashboard consumes. All queries hit `detections`/`events` with `FINAL`
 * so ReplacingMergeTree dedup is applied at read time.
 */
export function registerReadApi(app: Hono, store: Store): void {
  // Recent detections, newest first. ?severity= &rule= &host= &limit=
  app.get("/v1/detections", async (c) => {
    // ?? only guards a *missing* param; a present-but-non-numeric value (?limit=abc)
    // would be NaN and serialize to an invalid UInt32. Coerce to a finite default.
    const raw = Number(c.req.query("limit") ?? 100);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 1000) : 100;
    const { clause, params } = detectionFilter(c);
    const detections = await store.query(
      `SELECT detection_id, rule, severity, ts, event_id, endpoint_user, endpoint_host, session_id, summary, detail
       FROM detections FINAL ${clause} ORDER BY ts DESC LIMIT {limit:UInt32}`,
      { ...params, limit },
    );
    return c.json({ detections });
  });

  // Summary stats for the dashboard. ?severity= &rule= &host=
  app.get("/v1/stats", async (c) => {
    const { clause, params } = detectionFilter(c);
    const [totals, bySeverity, byRule, byDay] = await Promise.all([
      store.query(`SELECT count() AS detections FROM detections FINAL ${clause}`, params),
      store.query(`SELECT severity, count() AS n FROM detections FINAL ${clause} GROUP BY severity`, params),
      store.query(`SELECT rule, count() AS n FROM detections FINAL ${clause} GROUP BY rule ORDER BY n DESC`, params),
      store.query(
        `SELECT toDate(ts) AS day, count() AS n FROM detections FINAL ${clause} GROUP BY day ORDER BY day DESC LIMIT 14`,
        params,
      ),
    ]);
    return c.json({ totals: totals[0] ?? { detections: 0 }, bySeverity, byRule, byDay });
  });

  // Fleet rollup — one row per host: activity (from events, so quiet hosts still show) +
  // detection counts, with a stale flag and a naming-convention risk weight. Grouped by host
  // alone to match the host dimension the rest of the API filters on. This is the all-hosts
  // navigator — it is intentionally NOT host-scoped.
  app.get("/v1/fleet", async (c) => {
    const [activity, perHost] = await Promise.all([
      store.query<{ endpoint_host: string; events: string; last_seen: string; age_seconds: string }>(
        `SELECT endpoint_host, count() AS events, max(ts) AS last_seen,
                dateDiff('second', max(ts), now()) AS age_seconds
         FROM events FINAL GROUP BY endpoint_host`,
      ),
      store.query<{ endpoint_host: string; detections: string; crit: string; high: string; medium: string; low: string }>(
        `SELECT endpoint_host, count() AS detections,
                countIf(severity = 'critical') AS crit, countIf(severity = 'high') AS high,
                countIf(severity = 'medium') AS medium, countIf(severity = 'low') AS low
         FROM detections FINAL GROUP BY endpoint_host`,
      ),
    ]);

    const byHost = new Map<string, FleetRow>();
    for (const a of activity) {
      byHost.set(a.endpoint_host, {
        endpoint_host: a.endpoint_host,
        events: Number(a.events),
        last_seen: a.last_seen,
        stale: Number(a.age_seconds) > 86400, // no events in >24h
        sensitivity: hostSensitivity(a.endpoint_host),
        detections: 0,
        crit: 0,
        high: 0,
        medium: 0,
        low: 0,
        risk: 0,
      });
    }
    for (const d of perHost) {
      const row =
        byHost.get(d.endpoint_host) ??
        ({
          endpoint_host: d.endpoint_host,
          events: 0,
          last_seen: null,
          stale: false,
          sensitivity: hostSensitivity(d.endpoint_host),
          detections: 0,
          crit: 0,
          high: 0,
          medium: 0,
          low: 0,
          risk: 0,
        } satisfies FleetRow);
      row.detections = Number(d.detections);
      row.crit = Number(d.crit);
      row.high = Number(d.high);
      row.medium = Number(d.medium);
      row.low = Number(d.low);
      row.risk = row.sensitivity * (4 * row.crit + 3 * row.high + 2 * row.medium + row.low);
      byHost.set(d.endpoint_host, row);
    }
    const fleet = [...byHost.values()].sort(
      (a, b) => b.risk - a.risk || (b.last_seen ?? "").localeCompare(a.last_seen ?? ""),
    );
    return c.json({ fleet });
  });

  // Cross-host correlation — the same rule firing across >1 host in 24h (by event time) = a
  // fleet-wide event.
  app.get("/v1/correlations", async (c) => {
    const correlations = await store.query(
      `SELECT rule, uniqExact(endpoint_host) AS hosts, count() AS detections,
              groupUniqArray(endpoint_host) AS host_list
       FROM detections FINAL WHERE ts > now() - INTERVAL 24 HOUR
       GROUP BY rule HAVING hosts > 1 ORDER BY hosts DESC, detections DESC`,
    );
    return c.json({ correlations });
  });

  // Incidents — detections collapsed by session (the `incidents` view), bounded to a 7-day
  // window, ranked by worst_severity × distinct_rules × host_sensitivity × burst_rate. ?host=
  app.get("/v1/incidents", async (c) => {
    const host = c.req.query("host");
    const [rows, triageRows] = await Promise.all([
      store.query<{
        session_id: string;
        endpoint_user: string;
        endpoint_host: string;
        detections: string;
        distinct_rules: string;
        rules: string[];
        worst_rank: string;
        worst_severity: string;
        started: string;
        ended: string;
        span_seconds: string;
      }>(
        // Time-bound + severity-first ORDER so the LIMIT keeps the most relevant rows before the
        // JS score sort (the score isn't expressible as a single SQL key).
        `SELECT session_id, endpoint_user, endpoint_host, detections, distinct_rules, rules,
                worst_rank, worst_severity, started, ended,
                dateDiff('second', started, ended) AS span_seconds
         FROM incidents
         WHERE ended >= now() - INTERVAL 7 DAY ${host ? "AND endpoint_host = {host:String}" : ""}
         ORDER BY worst_rank DESC, detections DESC LIMIT 500`,
        host ? { host } : undefined,
      ),
      // Advisory triage, joined for display only — never changes the rule score or the sort.
      store.query<{ session_id: string; endpoint_host: string; verdict: string; score: string; rationale: string; model: string }>(
        `SELECT session_id, endpoint_host, verdict, score, rationale, model FROM triage FINAL`,
      ),
    ]);
    const triageByKey = new Map(
      triageRows.map((t) => [
        `${t.session_id} ${t.endpoint_host}`,
        { verdict: t.verdict, score: Number(t.score), rationale: t.rationale, model: t.model },
      ]),
    );
    const incidents = rows
      .map((r) => {
        const sensitivity = hostSensitivity(r.endpoint_host);
        // detections per minute; spans under a minute count as one minute so same-timestamp
        // batches aren't amplified into a fake burst.
        const burst = Number(r.detections) / Math.max(1, Number(r.span_seconds) / 60);
        const score = Number(r.worst_rank) * Number(r.distinct_rules) * sensitivity * Math.max(1, burst);
        return {
          ...r,
          sensitivity,
          burst: Math.round(burst * 100) / 100,
          score: Math.round(score * 100) / 100,
          triage: triageByKey.get(`${r.session_id} ${r.endpoint_host}`) ?? null,
        };
      })
      .sort((a, b) => b.score - a.score);
    return c.json({ incidents });
  });
}
