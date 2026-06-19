import { describe, expect, it } from "vitest";
import { createServer } from "../ingest/server.js";
import type { Store } from "../store/store.js";

type QueryCall = { sql: string; params?: Record<string, unknown> };

/** Store whose `query` returns canned rows for any SQL — tests the read API
 *  wiring without ClickHouse (SQL correctness is covered E2E). `opts.calls`
 *  captures the bound params; `opts.throwOnQuery` simulates a store failure. */
function mockStore(
  rows: Record<string, unknown>[] = [],
  opts: { throwOnQuery?: boolean; calls?: QueryCall[] } = {},
): Store {
  return {
    async append() {},
    async appendDetections() {},
    async query(sql: string, params?: Record<string, unknown>) {
      opts.calls?.push({ sql, params });
      if (opts.throwOnQuery) throw new Error("clickhouse down");
      return rows as never;
    },
    async ping() {
      return true;
    },
    async close() {},
  };
}

const detection = {
  detection_id: "denied-dangerous:e1",
  rule: "denied-dangerous",
  severity: "high",
  ts: "2026-06-18T22:00:00.000Z",
  event_id: "e1",
  endpoint_user: "evan",
  endpoint_host: "mac",
  session_id: "s1",
  summary: "Denied dangerous command — bash · dangerous · denied",
  detail: "rule:deny",
};

describe("GET /v1/detections", () => {
  it("returns detections from the store", async () => {
    const res = await createServer(mockStore([detection])).request("/v1/detections");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { detections: unknown[] };
    expect(body.detections).toHaveLength(1);
    expect(body.detections[0]).toMatchObject({ rule: "denied-dangerous", severity: "high" });
  });
});

describe("GET /v1/detections ?limit handling", () => {
  it("falls back to the default (not NaN) for a non-numeric limit", async () => {
    const calls: QueryCall[] = [];
    const res = await createServer(mockStore([], { calls })).request("/v1/detections?limit=abc");
    expect(res.status).toBe(200);
    expect(calls[0]?.params?.limit).toBe(100);
  });

  it("clamps out-of-range limits into [1, 1000]", async () => {
    const high: QueryCall[] = [];
    await createServer(mockStore([], { calls: high })).request("/v1/detections?limit=99999");
    expect(high[0]?.params?.limit).toBe(1000);

    const low: QueryCall[] = [];
    await createServer(mockStore([], { calls: low })).request("/v1/detections?limit=-5");
    expect(low[0]?.params?.limit).toBe(1);
  });
});

describe("read API error handling", () => {
  it("returns JSON (not text/plain) when a store query fails", async () => {
    const res = await createServer(mockStore([], { throwOnQuery: true })).request("/v1/detections");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toMatchObject({ error: "internal error" });
  });
});

describe("GET /v1/stats", () => {
  it("returns totals + grouped stats", async () => {
    const res = await createServer(mockStore([{ detections: 3 }])).request("/v1/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const key of ["totals", "bySeverity", "byRule", "byDay"]) {
      expect(body).toHaveProperty(key);
    }
  });
});

describe("GET /v1/detections ?host filter", () => {
  it("binds the host param", async () => {
    const calls: QueryCall[] = [];
    await createServer(mockStore([], { calls })).request("/v1/detections?host=mac");
    expect(calls[0]?.params?.host).toBe("mac");
  });
});

describe("fleet-view endpoints", () => {
  it("GET /v1/fleet rolls up per host with stale + risk", async () => {
    const fleetRow = {
      endpoint_user: "evan",
      endpoint_host: "prod-1",
      events: "5",
      last_seen: "2026-06-18 00:00:00",
      age_seconds: "100000", // > 86400 → stale
      detections: "3",
      crit: "1",
      high: "0",
      medium: "2",
      low: "0",
    };
    const res = await createServer(mockStore([fleetRow])).request("/v1/fleet");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fleet: Array<Record<string, unknown>> };
    expect(body.fleet).toHaveLength(1);
    expect(body.fleet[0]).toMatchObject({ endpoint_host: "prod-1", detections: 3, stale: true, sensitivity: 3 });
    // risk = sensitivity(3) × (4·crit1 + 3·high0 + 2·med2 + low0) = 3 × 8 = 24
    expect(body.fleet[0].risk).toBe(24);
  });

  it("GET /v1/correlations returns the rows", async () => {
    const row = { rule: "x", hosts: "2", detections: "4", host_list: ["a", "b"] };
    const res = await createServer(mockStore([row])).request("/v1/correlations");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { correlations: unknown[] }).correlations).toHaveLength(1);
  });

  it("GET /v1/incidents scores and ranks", async () => {
    const inc = {
      session_id: "s1",
      endpoint_user: "evan",
      endpoint_host: "prod-1",
      detections: "4",
      distinct_rules: "2",
      rules: ["denied-dangerous", "bypass-mode"],
      worst_rank: "3",
      worst_severity: "high",
      started: "2026-06-18 00:00:00",
      ended: "2026-06-18 00:01:00",
      span_seconds: "60",
    };
    const res = await createServer(mockStore([inc])).request("/v1/incidents");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { incidents: Array<Record<string, unknown>> };
    // score = worst_rank(3) × distinct_rules(2) × sensitivity(3) × burst(4/min) = 72
    expect(body.incidents[0]).toMatchObject({ worst_severity: "high", sensitivity: 3, burst: 4, score: 72 });
  });
});

describe("GET /spyglass", () => {
  it("serves the dashboard HTML", async () => {
    const res = await createServer(mockStore()).request("/spyglass");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(await res.text()).toContain("spyglass");
  });
});
