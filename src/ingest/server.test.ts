import { describe, expect, it } from "vitest";
import type { Event } from "../schema.js";
import type { Store } from "../store/store.js";
import { createServer } from "./server.js";

/** In-memory Store — lets the server be tested without ClickHouse. */
function memoryStore(opts: { failAppend?: boolean; pingOk?: boolean } = {}): Store & { rows: Event[] } {
  const rows: Event[] = [];
  return {
    rows,
    async append(events) {
      if (opts.failAppend) throw new Error("boom");
      rows.push(...events);
    },
    async query() {
      return [];
    },
    async ping() {
      return opts.pingOk ?? true;
    },
    async close() {},
  };
}

const validEvent = (over: Partial<Event> = {}): Event => ({
  schema_version: 1,
  event_id: "e1",
  ts: "2026-06-18T22:00:00.000Z",
  endpoint: { user: "evan", host: "mac" },
  session_id: "s1",
  coble_version: "0.4.1",
  mode: "default",
  sandbox_on: false,
  tool: "bash",
  tier: "safe",
  decision: "auto",
  ...over,
});

const post = (app: ReturnType<typeof createServer>, body: unknown) =>
  app.request("/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /v1/events", () => {
  it("accepts a valid batch and writes every event to the store", async () => {
    const store = memoryStore();
    const res = await post(createServer(store), { events: [validEvent(), validEvent({ event_id: "e2" })] });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: 2 });
    expect(store.rows.map((r) => r.event_id)).toEqual(["e1", "e2"]);
  });

  it("rejects an invalid batch with 400 and writes nothing", async () => {
    const store = memoryStore();
    const res = await post(createServer(store), { events: [{ event_id: "" }] });
    expect(res.status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });

  it("rejects a non-JSON body with 400", async () => {
    const res = await post(createServer(memoryStore()), "not json");
    expect(res.status).toBe(400);
  });

  it("returns 502 (retryable) when the store write fails", async () => {
    const res = await post(createServer(memoryStore({ failAppend: true })), { events: [validEvent()] });
    expect(res.status).toBe(502);
  });
});

describe("GET /healthz", () => {
  it("reports ok when the store pings", async () => {
    const res = await createServer(memoryStore({ pingOk: true })).request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("reports degraded (503) when the store ping fails", async () => {
    const res = await createServer(memoryStore({ pingOk: false })).request("/healthz");
    expect(res.status).toBe(503);
  });
});

describe("GET /", () => {
  it("serves the HTML landing page", async () => {
    const res = await createServer(memoryStore()).request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("crowsnest");
    expect(body).toContain("/v1/events");
  });
});
