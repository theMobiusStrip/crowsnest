# crowsnest

Local-first ingest + detection service for [coble](../coble) fleet logs — it watches the
fleet of cobles, runs detections, and surfaces daily results. Starts local; architected to
scale to multi-endpoint without a rewrite. See **[PLAN.md](./PLAN.md)**.

## Status

**M0 — scaffold.** Event schema, ClickHouse migrations, docker-compose, project config.
The `POST /v1/events` ingest server lands in M1.

## Quickstart (dev)

```bash
npm install
npm run ch:up      # ClickHouse + Grafana via Docker (tables auto-created from migrations/)
npm run dev        # crowsnest (M1 will serve POST /v1/events)
```

- ClickHouse HTTP: http://localhost:8123
- Grafana: http://localhost:3000 (admin / admin)

## Layout

See [PLAN.md](./PLAN.md) for the architecture, the scalability seams, and the milestones.
