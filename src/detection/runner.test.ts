import { describe, expect, it } from "vitest";
import type { Detection } from "../schema.js";
import type { Store } from "../store/store.js";
import { rules } from "./rules.js";
import { runDetections } from "./runner.js";

/** Store whose `query` returns canned rows for every rule — lets us test the
 *  runner's mapping/orchestration without ClickHouse (SQL correctness is E2E). */
function mockStore(rows: Record<string, unknown>[]): Store & { detections: Detection[] } {
  const detections: Detection[] = [];
  return {
    detections,
    async append() {},
    async appendDetections(d) {
      detections.push(...d);
    },
    async appendTriage() {},
    async query() {
      return rows as never;
    },
    async ping() {
      return true;
    },
    async close() {},
  };
}

const match = {
  event_id: "e1",
  ts: "2026-06-18T22:00:00.000Z",
  endpoint_user: "evan",
  endpoint_host: "mac",
  session_id: "s1",
  summary: "bash · dangerous · denied",
  detail: "rule:deny Bash(curl:*)",
};

describe("runDetections", () => {
  it("turns matched rows into detections tagged with rule id + severity", async () => {
    const store = mockStore([match]); // every rule matches the one row
    const results = await runDetections(store);

    expect(results).toHaveLength(rules.length);
    expect(store.detections).toHaveLength(rules.length); // one detection per rule

    const denied = store.detections.find((d) => d.rule === "denied-dangerous");
    expect(denied).toMatchObject({
      detection_id: "denied-dangerous:e1", // deterministic → dedup key
      severity: "high",
      event_id: "e1",
      endpoint_user: "evan",
    });
    expect(denied?.summary).toContain("Denied dangerous command");
  });

  it("writes nothing and reports zero when no events match", async () => {
    const store = mockStore([]);
    const results = await runDetections(store);
    expect(store.detections).toHaveLength(0);
    expect(results.every((r) => r.found === 0)).toBe(true);
  });
});
