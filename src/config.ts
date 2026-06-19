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
