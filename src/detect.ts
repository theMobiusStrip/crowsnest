import { loadConfig, parseIntervalMs } from "./config.js";
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

const intervalMs = parseIntervalMs(process.env.DETECT_INTERVAL_MS);

if (intervalMs > 0) {
  // Self-rescheduling loop: the next run waits for the previous one (no overlapping
  // scans), and a single failed run logs and continues instead of killing the loop.
  let running = true;
  const shutdown = () => {
    running = false;
    void store.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  console.log(`scheduled every ${intervalMs}ms (Ctrl+C to stop)`);
  while (running) {
    await runOnce().catch((e) => console.error("detection error:", e));
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
} else {
  // One-shot: a failure exits non-zero cleanly (no raw unhandled rejection) and the
  // store is always closed.
  try {
    await runOnce();
  } catch (e) {
    console.error("detection error:", e);
    process.exitCode = 1;
  } finally {
    await store.close();
  }
}
