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
