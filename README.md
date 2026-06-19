# crowsnest

Local-first ingest + detection service for the [coble](https://github.com/theMobiusStrip/coble)
coding-agent fleet. Agents ship their tool-decision events here; crowsnest stores them, runs
deterministic SQL **detections** (plus optional advisory **LLM triage**), and surfaces them in
**spyglass** — a dashboard of endpoints, rules, and incidents. Starts local on one machine;
architected to scale to multi-endpoint without a rewrite.

## Status

Shipped (local-first): ingest → ClickHouse · detection runner + SQL rules → `detections` ·
**spyglass** dashboard (fleet view · cross-host correlation · incident detail) · advisory
**LLM triage** (Anthropic, default off). Next: durable daemon, migration runner.

## Quickstart (dev)

```bash
npm install
npm run ch:up      # ClickHouse via Docker (migrations auto-applied on first init)
npm run dev        # ingest + read API + spyglass on :8787
npm run detect     # scan events → write detections
```

- **Dashboard:** http://localhost:8787/spyglass · ingest: `POST /v1/events` · health: `GET /healthz`
- **Read API:** `/v1/detections` · `/v1/stats` · `/v1/fleet` · `/v1/correlations` · `/v1/incident(s)`
- ClickHouse HTTP: http://localhost:8123

Send a test event:

```bash
curl -sS localhost:8787/v1/events -H 'content-type: application/json' -d '{
  "events": [{ "schema_version": 1, "event_id": "demo-1", "ts": "2026-06-18T22:00:00.000Z",
    "endpoint": { "user": "evan", "host": "mac" }, "session_id": "s1",
    "coble_version": "0.4.1", "mode": "default", "sandbox_on": false,
    "tool": "bash", "tier": "safe", "decision": "auto" }]
}'   # → {"accepted":1}
```

Optional **LLM triage** (advisory, per incident, default off — augment-never-override):

```bash
TRIAGE_ENABLED=1 ANTHROPIC_API_KEY=sk-... npm run triage   # ANTHROPIC_BASE_URL/TRIAGE_MODEL configurable
```

## Architecture

Stateless HTTP ingest → pluggable `Store` (ClickHouse) → scheduled detection runner emitting
`detections` → read API → spyglass. Network-shaped and stateless from day one, so it scales from
this single local service to multi-endpoint without a rewrite. Detections are deterministic SQL
rules; LLM triage only **augments** them (advisory verdict/score), never overrides.

```text
crowsnest/
  src/schema.ts          # zod Event/Detection contract (shared with coble's sink)
  src/ingest/            # POST /v1/events (stateless) + landing page
  src/store/             # Store interface + ClickHouse impl
  src/detection/         # SQL rules + runner → detections
  src/api/  src/triage/  # read API, spyglass dashboard, advisory LLM triage
  migrations/            # ClickHouse DDL (events, detections, incidents view, triage)
  docker/                # docker-compose: ClickHouse
```
