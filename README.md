# crowsnest

Local-first ingest + detection service for [coble](../coble) fleet logs — it watches the
fleet of cobles, runs detections, and surfaces daily results. Starts local; architected to
scale to multi-endpoint without a rewrite. See **[PLAN.md](./PLAN.md)**.

## Status

**M1 — ingest.** `POST /v1/events` validates event batches (zod) and writes to ClickHouse
via a pluggable `Store`. Detection runner + rules land in M2.

## Quickstart (dev)

```bash
npm install
npm run ch:up      # ClickHouse + Grafana via Docker (tables auto-created from migrations/)
npm run dev        # crowsnest ingest server on :8787
```

- Ingest: `POST http://localhost:8787/v1/events` · health: `GET /healthz`
- ClickHouse HTTP: http://localhost:8123 · Grafana: http://localhost:3000 (admin / admin)

Send a test event:

```bash
curl -sS localhost:8787/v1/events -H 'content-type: application/json' -d '{
  "events": [{ "schema_version": 1, "event_id": "demo-1", "ts": "2026-06-18T22:00:00.000Z",
    "endpoint": { "user": "evan", "host": "mac" }, "session_id": "s1",
    "coble_version": "0.4.1", "mode": "default", "sandbox_on": false,
    "tool": "bash", "tier": "safe", "decision": "auto" }]
}'   # → {"accepted":1}
```

## Layout

See [PLAN.md](./PLAN.md) for the architecture, the scalability seams, and the milestones.
