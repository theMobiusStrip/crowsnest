import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { createServer } from "./ingest/server.js";
import { createClickHouseStore } from "./store/clickhouse.js";

const cfg = loadConfig();
const store = createClickHouseStore({ url: cfg.clickhouseUrl, database: cfg.clickhouseDb });
const app = createServer(store);

serve({ fetch: app.fetch, port: cfg.port }, (info) => {
  console.log(`crowsnest ingest listening on :${info.port} → ClickHouse ${cfg.clickhouseUrl}/${cfg.clickhouseDb}`);
});

const shutdown = async () => {
  await store.close().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
