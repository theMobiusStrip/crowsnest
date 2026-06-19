import { describe, expect, it, vi } from "vitest";
import { loadTriageConfig, parseIntervalMs } from "./config.js";

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
    expect(c.model).toBeTruthy();
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
