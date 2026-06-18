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
