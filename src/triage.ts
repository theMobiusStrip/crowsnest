import { effectiveTriageConfig, loadConfig } from "./config.js";
import { createClickHouseStore } from "./store/clickhouse.js";
import { makeProvider } from "./triage/llm.js";
import { runTriage } from "./triage/runner.js";

// Advisory LLM triage (CLI: `npm run triage`). OFF unless enabled via the admin console or TRIAGE_ENABLED.
const cfg = loadConfig();
const store = createClickHouseStore({ url: cfg.clickhouseUrl, database: cfg.clickhouseDb });

try {
  const triageCfg = await effectiveTriageConfig(store);
  if (!triageCfg.enabled) {
    console.log("triage disabled (enable it in the admin console, or set TRIAGE_ENABLED=1)");
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
