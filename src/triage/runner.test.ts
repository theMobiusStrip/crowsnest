import { describe, expect, it, vi } from "vitest";
import type { Triage } from "../schema.js";
import type { Store } from "../store/store.js";
import { mockProvider } from "./llm.js";
import { runTriage } from "./runner.js";

const inc = { session_id: "s1", endpoint_host: "prod-1", worst_severity: "high", rules: ["denied-dangerous"], detections: "1" };
const det = { rule: "denied-dangerous", severity: "high", summary: "bash denied", detail: "rm -rf" };

function mockStore(incidents: unknown[], existingTriage: unknown[] = [], detections: unknown[] = [det]) {
  const written: Triage[] = [];
  const appendDetections = vi.fn(async () => {});
  const store: Store = {
    async append() {},
    appendDetections,
    async appendTriage(t) {
      written.push(...t);
    },
    async query(sql: string) {
      if (sql.includes("FROM incidents")) return incidents as never;
      if (sql.includes("FROM triage")) return existingTriage as never;
      if (sql.includes("FROM detections")) return detections as never;
      return [] as never;
    },
    async ping() {
      return true;
    },
    async close() {},
  };
  return { store, written, appendDetections };
}

describe("runTriage", () => {
  it("triages incidents that have no triage yet", async () => {
    const { store, written } = mockStore([inc]);
    const res = await runTriage(store, mockProvider());
    expect(res).toEqual({ candidates: 1, triaged: 1 });
    expect(written[0]).toMatchObject({
      session_id: "s1",
      endpoint_host: "prod-1",
      verdict: "likely_malicious",
      model: "mock",
    });
  });

  it("skips incidents already triaged", async () => {
    const { store, written } = mockStore([inc], [{ session_id: "s1", endpoint_host: "prod-1", detections: "1" }]);
    const res = await runTriage(store, mockProvider());
    expect(res).toEqual({ candidates: 0, triaged: 0 });
    expect(written).toHaveLength(0);
  });

  it("re-triages when the detection count changed since last triage", async () => {
    const grown = { ...inc, detections: "3" }; // incident now has more detections than when triaged
    const { store } = mockStore([grown], [{ session_id: "s1", endpoint_host: "prod-1", detections: "1" }]);
    expect(await runTriage(store, mockProvider())).toEqual({ candidates: 1, triaged: 1 });
  });

  it("never writes detections — advisory, augment-never-override", async () => {
    const { store, appendDetections } = mockStore([inc]);
    await runTriage(store, mockProvider());
    expect(appendDetections).not.toHaveBeenCalled();
  });
});
