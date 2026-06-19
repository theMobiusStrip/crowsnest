import { loadConfig, loadTriageConfig } from "./config.js";
import { createClickHouseStore } from "./store/clickhouse.js";
import { makeProvider } from "./triage/llm.js";
import { runTriage } from "./triage/runner.js";

// Advisory LLM triage (CLI: `npm run triage`). OFF unless TRIAGE_ENABLED is set.
const cfg = loadConfig();
const triageCfg = loadTriageConfig();
const store = createClickHouseStore({ url: cfg.clickhouseUrl, database: cfg.clickhouseDb });

try {
  if (!triageCfg.enabled) {
    console.log("triage disabled (set TRIAGE_ENABLED=1 to run)");
  } else if (triageCfg.provider === "anthropic" && !triageCfg.apiKey) {
    console.error("triage: ANTHROPIC_API_KEY required for the anthropic provider (or set TRIAGE_PROVIDER=mock)");
    process.exitCode = 1;
  } else {
    const provider = makeProvider(triageCfg);
    const res = await runTriage(store, provider);
    console.log(`[${new Date().toISOString()}] triage (${provider.model}): ${res.triaged}/${res.candidates} incident(s)`);
  }
} catch (e) {
  console.error("triage error:", e);
  process.exitCode = 1;
} finally {
  await store.close();
}
