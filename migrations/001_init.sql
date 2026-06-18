-- crowsnest schema (ClickHouse). Auto-run by docker-compose on first container init.
CREATE DATABASE IF NOT EXISTS crowsnest;

-- Raw tool-decision events from the coble fleet.
-- ReplacingMergeTree dedups by event_id, so at-least-once shipping (client retries)
-- is idempotent. Partitioned by day for cheap retention + pruning.
CREATE TABLE IF NOT EXISTS crowsnest.events
(
  schema_version  UInt16,
  event_id        String,
  ts              DateTime64(3, 'UTC'),
  endpoint_user   String,
  endpoint_host   String,
  repo            String DEFAULT '',
  session_id      String,
  coble_version   String,
  mode            LowCardinality(String),
  sandbox_on      UInt8,
  tool            LowCardinality(String),
  tier            LowCardinality(String),
  decision        LowCardinality(String),
  detail          String DEFAULT '',
  ingested_at     DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMMDD(ts)
ORDER BY (event_id);

-- Detection findings produced by the detection runner (M2).
CREATE TABLE IF NOT EXISTS crowsnest.findings
(
  finding_id     String,
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
ORDER BY (finding_id);
