import { describe, expect, it } from "vitest";
import { rules } from "./rules.js";

describe("detection rules", () => {
  it("read events with FINAL so retried/duplicate rows dedup at read time", () => {
    for (const r of rules) {
      expect(r.sql).toContain("FROM events FINAL");
    }
  });

  it("denied-read matches coble's deny-read signal (decision='error', not just 'denied')", () => {
    const read = rules.find((r) => r.id === "denied-read");
    expect(read?.sql).toContain("decision IN ('denied', 'error')");
    expect(read?.sql).toContain("tool = 'read_file'");
  });
});
