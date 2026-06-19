# crowsnest

Local-first ingest + detection service for the [coble](https://github.com/theMobiusStrip/coble)
coding-agent fleet. Agents ship their tool-decision events here; crowsnest stores them, runs
deterministic SQL **detections** (plus optional advisory **LLM triage**), and surfaces them in
**spyglass** — a dashboard of endpoints, rules, and incidents. Starts local on one machine;
architected to scale to multi-endpoint without a rewrite.

## Status

Shipped (local-first): ingest → ClickHouse · detection runner + SQL rules → `detections` ·
**spyglass** dashboard (fleet view · cross-host correlation · incident detail) · advisory
**LLM triage** (Anthropic, default off) · admin console. Next: migration runner.

## Live demo (GitHub Pages)

A static, backend-free snapshot of the **spyglass** dashboard (sample data, no ClickHouse) is
published to GitHub Pages:

**https://themobiusstrip.github.io/crowsnest/**

It's the real dashboard, not a mockup — [`scripts/build-demo.mjs`](scripts/build-demo.mjs) extracts
the page straight from [`src/api/spyglass.ts`](src/api/spyglass.ts), rewrites the `/v1/*` fetches to
static JSON fixtures, and writes the result to [`docs/`](docs/). Rebuild after any dashboard change:

```bash
npm run build:demo                     # regenerate docs/ from source + fixtures
python3 -m http.server 4173 -d docs    # preview locally → http://localhost:4173
```

Enable once in **Settings → Pages → Deploy from a branch → `master` / `/docs`**. Incident
drill-down and the admin console are live-only (they need the backend).

## Quickstart (dev)

```bash
npm install
npm run ch:up      # ClickHouse via Docker (migrations auto-applied on first init)
npm run dev        # ingest + read API + spyglass on :8787
npm run detect     # scan events → write detections
```

**Run as a durable daemon** (server + ClickHouse in Docker, `restart: unless-stopped` — the admin
`restart` button and reboots recover automatically):

```bash
npm run up         # build + start the whole stack   ·   npm run down to stop
```

- **Dashboard:** http://localhost:8787/spyglass · ingest: `POST /v1/events` · health: `GET /healthz`
- **Read API:** `/v1/detections` · `/v1/stats` · `/v1/fleet` · `/v1/health` (per-host heartbeat) ·
  `/v1/correlations` · `/v1/incident(s)`
- ClickHouse HTTP: http://localhost:8123

Send a test event:

```bash
curl -sS localhost:8787/v1/events -H 'content-type: application/json' -d '{
  "events": [{ "schema_version": 1, "event_id": "demo-1", "ts": "2026-06-18T22:00:00.000Z",
    "endpoint": { "user": "alice", "host": "laptop" }, "session_id": "s1",
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
this single local service to multi-endpoint without a rewrite.

**Key design highlights**
- **Untrusted by default** — every ingested event field is treated as hostile data and HTML/SQL-escaped
  before it reaches the dashboard or the triage LLM (spotlighted prompt). One real boundary; see
  [`SECURITY.md`](SECURITY.md).
- **Deterministic backbone, advisory AI** — versioned SQL rules decide what's a detection; LLM triage
  only adds a verdict/score/rationale (**augment-never-override**), and a human *manual* verdict wins.
- **Scales without a rewrite** — network ingest + stateless server + a `Store` seam (single-node
  ClickHouse → cluster) + `event_id` dedup mean multi-endpoint = more clients + replicas.
- **Endpoint- and incident-centric** — events roll up by host (fleet view, cross-host correlation) and
  by coble run (incidents), so operators triage *episodes*, not rows.
- **No build-step UI** — spyglass + admin are self-contained served HTML; the whole service is a handful
  of TS files over ClickHouse.

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
