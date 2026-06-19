-- 005: make `triage` an append-only audit log so the incident page can show triage history
-- (every LLM/manual event is kept, with its timestamp). The "current" verdict is derived at read
-- time — prefer model='manual', else newest (ORDER BY ... LIMIT 1 BY) — so no engine-level dedup
-- is needed. This recreates the table (ReplacingMergeTree → MergeTree); runs after 004 in the chain,
-- apply manually on an already-initialised instance.
CREATE TABLE IF NOT EXISTS crowsnest.triage_log
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
ENGINE = MergeTree
ORDER BY (session_id, endpoint_host, created_at);

-- carry ALL existing triage rows over (not just the latest) so re-running this migration is
-- idempotent — it copies the full log back rather than collapsing it. The "current" verdict is
-- derived at read time (manual-preferred), so keeping every row here is exactly the history we want.
INSERT INTO crowsnest.triage_log
SELECT session_id, endpoint_host, detections, verdict, score, rationale, model, created_at
FROM crowsnest.triage;

DROP TABLE crowsnest.triage;
RENAME TABLE crowsnest.triage_log TO crowsnest.triage;
