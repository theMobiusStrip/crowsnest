import { describe, expect, it, vi } from "vitest";
import { effectiveTriageConfig, loadTriageConfig, parseIntervalMs } from "./config.js";
import type { Store } from "./store/store.js";

describe("parseIntervalMs", () => {
  it("defaults to 0 (one-shot) when unset", () => {
    expect(parseIntervalMs(undefined)).toBe(0);
  });

  it("parses a valid millisecond interval", () => {
    expect(parseIntervalMs("5000")).toBe(5000);
  });

  it("falls back to 0 (not NaN → silent one-shot) for a non-numeric value", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseIntervalMs("30s")).toBe(0);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("rejects negative values", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseIntervalMs("-1")).toBe(0);
    err.mockRestore();
  });
});

describe("loadTriageConfig", () => {
  it("defaults to OFF with the anthropic provider", () => {
    const c = loadTriageConfig({});
    expect(c.enabled).toBe(false);
    expect(c.provider).toBe("anthropic");
    expect(c.model).toBe("claude-opus-4-7");
    expect(c.baseUrl).toBe("https://api.anthropic.com");
  });

  it("enables on truthy TRIAGE_ENABLED and trims a trailing slash on the base URL", () => {
    const c = loadTriageConfig({
      TRIAGE_ENABLED: "1",
      TRIAGE_PROVIDER: "mock",
      ANTHROPIC_BASE_URL: "http://localhost:8080/",
    });
    expect(c.enabled).toBe(true);
    expect(c.provider).toBe("mock");
    expect(c.baseUrl).toBe("http://localhost:8080");
  });
});

function storeWith(rows: { key: string; value: string }[]): Store {
  return {
    async append() {},
    async appendDetections() {},
    async appendTriage() {},
    async setConfig() {},
    async query() {
      return rows as never;
    },
    async ping() {
      return true;
    },
    async close() {},
  };
}

describe("effectiveTriageConfig", () => {
  it("applies enabled + model overrides from the config table", async () => {
    const c = await effectiveTriageConfig(
      storeWith([
        { key: "triage.enabled", value: "1" },
        { key: "triage.model", value: "db-model" },
      ]),
    );
    expect(c.enabled).toBe(true);
    expect(c.model).toBe("db-model");
  });

  it("never takes the base URL or API key from the DB (key-exfil guard)", async () => {
    const c = await effectiveTriageConfig(
      storeWith([
        { key: "triage.baseUrl", value: "http://evil.example" },
        { key: "triage.apiKey", value: "stolen" },
      ]),
    );
    expect(c.baseUrl).not.toBe("http://evil.example");
    expect(c.apiKey).not.toBe("stolen");
  });
});
