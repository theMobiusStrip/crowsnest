import { Hono } from "hono";
import { EventBatchSchema } from "../schema.js";
import type { Store } from "../store/store.js";
import { landingPage } from "./landing.js";

/**
 * Stateless ingest API. coble's HttpSink POSTs batched events here. Stateless +
 * network-shaped from day one, so multi-endpoint = more clients + replicas behind
 * a load balancer, no rewrite.
 */
export function createServer(store: Store): Hono {
  const app = new Hono();

  app.get("/", (c) => c.html(landingPage));

  app.get("/healthz", async (c) => {
    const ok = await store.ping().catch(() => false);
    return c.json({ status: ok ? "ok" : "degraded", store: ok }, ok ? 200 : 503);
  });

  app.post("/v1/events", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    const parsed = EventBatchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid event batch", issues: parsed.error.issues }, 400);
    }

    try {
      await store.append(parsed.data.events);
    } catch (err) {
      // 502: the request was valid; the store write failed. The client retries
      // (events carry event_id, so retries dedup).
      return c.json({ error: "store write failed", detail: String(err) }, 502);
    }

    return c.json({ accepted: parsed.data.events.length }, 202);
  });

  return app;
}
