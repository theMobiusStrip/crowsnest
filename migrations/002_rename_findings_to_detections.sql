-- 002: rename `findings` → `detections` (and `finding_id` → `detection_id`).
--
-- The concept is "detection" throughout the code/plan. `finding_id` is the table's
-- sorting key, which ClickHouse cannot RENAME COLUMN in place, so we recreate the
-- table with the new schema and copy the data over, then drop the old one.
-- Runs after 001 in the init chain (fresh install: copies 0 rows); apply manually
-- on an already-initialised instance.

CREATE TABLE IF NOT EXISTS crowsnest.detections
(
  detection_id   String,
  rule           LowCardinality(String),
  severity       LowCardinality(String),
  ts             DateTime64(3, 'UTC'),
  event_id       String DEFAULT '',
  endpoint_user  String DEFAULT '',
  endpoint_host  String DEFAULT '',
  session_id     String DEFAULT '',
  summary        String,
  detail         String DEFAULT '',
  created_at     DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMMDD(ts)
ORDER BY (detection_id);

-- Carry existing rows over (no-op on a fresh install).
INSERT INTO crowsnest.detections
SELECT finding_id AS detection_id, rule, severity, ts, event_id, endpoint_user,
       endpoint_host, session_id, summary, detail, created_at
FROM crowsnest.findings;

DROP TABLE IF EXISTS crowsnest.findings;
