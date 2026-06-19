import { describe, expect, it } from "vitest";
import { createServer } from "../ingest/server.js";
import type { Store } from "../store/store.js";

/** Store whose `query` returns canned rows for any SQL — tests the read API
 *  wiring without ClickHouse (SQL correctness is covered E2E). */
function mockStore(rows: Record<string, unknown>[] = []): Store {
  return {
    async append() {},
    async appendFindings() {},
    async query() {
      return rows as never;
    },
    async ping() {
      return true;
    },
    async close() {},
  };
}

const finding = {
  finding_id: "denied-dangerous:e1",
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

describe("GET /v1/findings", () => {
  it("returns findings from the store", async () => {
    const res = await createServer(mockStore([finding])).request("/v1/findings");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { findings: unknown[] };
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0]).toMatchObject({ rule: "denied-dangerous", severity: "high" });
  });
});

describe("GET /v1/stats", () => {
  it("returns totals + grouped stats", async () => {
    const res = await createServer(mockStore([{ findings: 3 }])).request("/v1/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const key of ["totals", "bySeverity", "byRule", "byDay"]) {
      expect(body).toHaveProperty(key);
    }
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
