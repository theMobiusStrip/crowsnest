import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSecrets, writeSecrets } from "./secrets.js";

describe("secrets file", () => {
  it("returns {} when the file is missing", () => {
    expect(readSecrets(join(tmpdir(), `cn-missing-${Date.now()}.json`))).toEqual({});
  });

  it("writes then reads back base URL + key, merging on partial update", () => {
    const dir = mkdtempSync(join(tmpdir(), "cn-secrets-"));
    const path = join(dir, "secrets.json");
    try {
      writeSecrets({ baseUrl: "http://gw", apiKey: "k1" }, path);
      expect(readSecrets(path)).toEqual({ baseUrl: "http://gw", apiKey: "k1" });
      writeSecrets({ apiKey: "k2" }, path); // partial update must keep baseUrl
      expect(readSecrets(path)).toEqual({ baseUrl: "http://gw", apiKey: "k2" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
