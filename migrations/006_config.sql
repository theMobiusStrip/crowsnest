-- 006: runtime config key-value store for the admin console (e.g. toggling LLM triage without
-- a restart). Keys: `triage.enabled`, `triage.model`. SECRETS ARE NEVER STORED HERE — the
-- Anthropic API key and base URL stay env-only (a mutable base URL on an unauthenticated console
-- would be a key-exfiltration vector). Effective config = env defaults overlaid with these rows.
CREATE TABLE IF NOT EXISTS crowsnest.config
(
  key         String,
  value       String,
  updated_at  DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (key);
