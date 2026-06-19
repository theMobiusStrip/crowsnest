import { loadConfig } from "./config.js";
import { runDetections } from "./detection/runner.js";
import { createClickHouseStore } from "./store/clickhouse.js";

// One-shot detection run (CLI: `npm run detect`). Set DETECT_INTERVAL_MS to loop.
const cfg = loadConfig();
const store = createClickHouseStore({ url: cfg.clickhouseUrl, database: cfg.clickhouseDb });

async function runOnce(): Promise<void> {
  const results = await runDetections(store);
  const total = results.reduce((n, r) => n + r.found, 0);
  console.log(`[${new Date().toISOString()}] detections: ${total} finding(s)`);
  for (const r of results) if (r.found > 0) console.log(`  ${r.rule.padEnd(24)} ${r.found}`);
}

const intervalMs = Number(process.env.DETECT_INTERVAL_MS ?? 0);
await runOnce();
if (intervalMs > 0) {
  console.log(`scheduled every ${intervalMs}ms (Ctrl+C to stop)`);
  setInterval(() => void runOnce().catch((e) => console.error("detection error:", e)), intervalMs);
} else {
  await store.close();
}
