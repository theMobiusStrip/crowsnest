import { createClient, type ClickHouseClient } from "@clickhouse/client";
import type { Event, Detection, Triage } from "../schema.js";
import type { Store } from "./store.js";

export interface ClickHouseConfig {
  url: string;
  database: string;
}

/** ClickHouse-backed Store. Single-node locally → cluster later, same code. */
export function createClickHouseStore(cfg: ClickHouseConfig): Store {
  const client: ClickHouseClient = createClient({
    url: cfg.url,
    database: cfg.database,
    // accept ISO-8601 (with `T`/`Z`) for DateTime64 columns
    clickhouse_settings: { date_time_input_format: "best_effort" },
  });

  return {
    async append(events) {
      if (events.length === 0) return;
      const values = events.map((e) => ({
        schema_version: e.schema_version,
        event_id: e.event_id,
        ts: e.ts,
        endpoint_user: e.endpoint.user,
        endpoint_host: e.endpoint.host,
        repo: e.repo ?? "",
        session_id: e.session_id,
        coble_version: e.coble_version,
        mode: e.mode,
        sandbox_on: e.sandbox_on ? 1 : 0,
        tool: e.tool,
        tier: e.tier,
        decision: e.decision,
        detail: e.detail ?? "",
      }));
      await client.insert({ table: "events", values, format: "JSONEachRow" });
    },

    async appendDetections(detections: Detection[]) {
      if (detections.length === 0) return;
      const values = detections.map((d) => ({
        detection_id: d.detection_id,
        rule: d.rule,
        severity: d.severity,
        ts: d.ts,
        event_id: d.event_id ?? "",
        endpoint_user: d.endpoint_user ?? "",
        endpoint_host: d.endpoint_host ?? "",
        session_id: d.session_id ?? "",
        summary: d.summary,
        detail: d.detail ?? "",
      }));
      await client.insert({ table: "detections", values, format: "JSONEachRow" });
    },

    async appendTriage(triage: Triage[]) {
      if (triage.length === 0) return;
      const values = triage.map((t) => ({
        session_id: t.session_id,
        endpoint_host: t.endpoint_host,
        detections: t.detections,
        verdict: t.verdict,
        score: t.score,
        rationale: t.rationale,
        model: t.model,
      }));
      await client.insert({ table: "triage", values, format: "JSONEachRow" });
    },

    async setConfig(entries) {
      if (entries.length === 0) return;
      await client.insert({ table: "config", values: entries, format: "JSONEachRow" });
    },

    async query<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>) {
      const rs = await client.query({ query: sql, query_params: params, format: "JSONEachRow" });
      return (await rs.json()) as T[];
    },

    async ping() {
      const r = await client.ping();
      return r.success;
    },

    async close() {
      await client.close();
    },
  };
}
