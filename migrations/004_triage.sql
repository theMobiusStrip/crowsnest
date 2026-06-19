-- 004: advisory LLM triage, one row per incident (session_id + host). ReplacingMergeTree so a
-- re-triage replaces the prior verdict. ADVISORY ONLY — this table never feeds back into the
-- deterministic `detections` / rule severities; the read API left-joins it for display.
-- Runs after 003 in the init chain; apply manually on an already-initialised instance.
CREATE TABLE IF NOT EXISTS crowsnest.triage
(
  session_id     String,
  endpoint_host  String,
  detections     UInt32,
  verdict        LowCardinality(String),
  score          UInt8,
  rationale      String,
  model          LowCardinality(String),
  created_at     DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY (session_id, endpoint_host);
