import { readSecrets } from "./secrets.js";
import type { Store } from "./store/store.js";

export interface Config {
  port: number;
  clickhouseUrl: string;
  clickhouseDb: string;
}

/** Read config from the environment (12-factor). Sensible local defaults. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8787),
    clickhouseUrl: env.CLICKHOUSE_URL ?? "http://localhost:8123",
    clickhouseDb: env.CLICKHOUSE_DB ?? "crowsnest",
  };
}

/**
 * Parse the detector's loop interval (DETECT_INTERVAL_MS). Unset → 0 (one-shot);
 * a non-numeric or negative value warns and falls back to 0 rather than silently
 * degrading a `30s`-style typo into a single run.
 */
export function parseIntervalMs(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`crowsnest: ignoring invalid DETECT_INTERVAL_MS=${raw}`);
    return 0;
  }
  return n;
}

export interface TriageConfig {
  enabled: boolean;
  provider: "anthropic" | "mock";
  model: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * LLM triage config. Default OFF — the service makes NO external model calls unless
 * TRIAGE_ENABLED is truthy. `provider=mock` runs the deterministic stub (no key needed).
 * ANTHROPIC_BASE_URL is customizable (proxy / Anthropic-compatible gateway / self-host).
 */
export function loadTriageConfig(env: NodeJS.ProcessEnv = process.env): TriageConfig {
  return {
    enabled: /^(1|true|yes|on)$/i.test(env.TRIAGE_ENABLED ?? ""),
    provider: env.TRIAGE_PROVIDER === "mock" ? "mock" : "anthropic",
    model: env.TRIAGE_MODEL ?? "claude-opus-4-7",
    apiKey: env.ANTHROPIC_API_KEY ?? "",
    baseUrl: (env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/+$/, ""),
  };
}

/**
 * Effective triage config = env defaults ⊕ `config` table (enabled/model) ⊕ local secrets file
 * (base URL + API key, set via the admin console). The key/base URL are NEVER read from the DB —
 * only the gitignored 0600 secrets file or env. (Editing them over the unauthenticated console is a
 * deliberate local-only trade-off — a mutable base URL sends the key wherever it points; see SECURITY.md.)
 */
export async function effectiveTriageConfig(store: Store): Promise<TriageConfig> {
  const base = loadTriageConfig();
  const overrides: Record<string, string> = {};
  try {
    const rows = await store.query<{ key: string; value: string }>(
      `SELECT key, value FROM config FINAL WHERE key LIKE 'triage.%'`,
    );
    for (const r of rows) overrides[r.key] = r.value;
  } catch (e) {
    // An absent config table (code deployed before migration 006) → fall back to env defaults.
    // Any OTHER error (DB outage) must NOT silently fail-open the toggle — re-throw so the caller
    // fails safe (the runner aborts rather than running triage the admin may have turned off).
    if (/unknown_table|does\s?n'?t exist|not found/i.test(String(e))) return base;
    throw e;
  }
  const secrets = readSecrets();
  return {
    ...base,
    enabled: "triage.enabled" in overrides ? /^(1|true|yes|on)$/i.test(overrides["triage.enabled"]) : base.enabled,
    model: overrides["triage.model"] || base.model,
    // baseUrl + apiKey come from the local secrets file (admin console) or env — NEVER the DB.
    baseUrl: (secrets.baseUrl || base.baseUrl).replace(/\/+$/, ""),
    apiKey: secrets.apiKey || base.apiKey,
  };
}
