import { describe, expect, it, vi } from "vitest";
import { parseIntervalMs } from "./config.js";

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
