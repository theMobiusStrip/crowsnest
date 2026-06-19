-- 003: incidents view — collapse detections into one row per coble session (the natural
-- work-episode boundary). A plain VIEW (detections-as-code); the read API ranks/scores it.
-- Runs after 002 in the init chain; apply manually on an already-initialised instance.
--
-- severity is a string, so max()/min() would sort lexicographically — rank it numerically
-- (critical>high>medium>low) and use argMax to recover the worst severity's label.
CREATE VIEW IF NOT EXISTS crowsnest.incidents AS
SELECT
  session_id,
  any(endpoint_user)                                                                    AS endpoint_user,
  endpoint_host,
  count()                                                                               AS detections,
  uniqExact(rule)                                                                        AS distinct_rules,
  groupUniqArray(rule)                                                                   AS rules,
  max(multiIf(severity = 'critical', 4, severity = 'high', 3, severity = 'medium', 2, 1)) AS worst_rank,
  argMax(severity, multiIf(severity = 'critical', 4, severity = 'high', 3, severity = 'medium', 2, 1)) AS worst_severity,
  min(ts)                                                                                AS started,
  max(ts)                                                                                AS ended
FROM crowsnest.detections FINAL
GROUP BY session_id, endpoint_host;
