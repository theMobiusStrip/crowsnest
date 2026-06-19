# crowsnest security model

crowsnest ingests tool-decision events from a fleet of [coble](https://github.com/theMobiusStrip/coble)
coding agents, stores them in ClickHouse, runs deterministic SQL detections, renders a
dashboard, and optionally sends incidents to an LLM for **advisory** triage. This document
states its trust boundary and what each protection actually guarantees — including where it
does **not**.

One-sentence version: **every field of an ingested event is UNTRUSTED data; crowsnest's job
is to store it, detect on it, and show it without ever letting it execute** — as SQL, as HTML
in the dashboard, or as instructions to the triage LLM.

## Threat model

**Assets.** The ClickHouse store, the operator reading the dashboard (whose browser renders
event content), the model-provider channel (only when triage is enabled), and the host.

**Trust boundary.** The events are **untrusted**. coble captures tool activity into fields
like `detail` and `summary`; a compromised or malicious endpoint — or merely attacker-chosen
content that flowed through a real agent — can place hostile bytes in any string field. Those
bytes then travel: ingest → ClickHouse → dashboard HTML **and** → the triage LLM prompt. Each
hop is a place the data must stay inert.

**Adversaries.**
1. *Malicious event content* — a crafted `detail`/`summary`/`host` aiming for stored XSS in
   the dashboard, SQL injection via a read filter, or prompt injection of the triage model.
2. *The triage LLM itself* — advisory output that is wrong, over-eager, or injection-steered.
3. *Network reachability* — there is **no authentication** (local-first MVP); anyone who can
   reach the port can POST events, read the dashboard API, and POST manual triage.

## The layers

Each answers a *different* question; they are complementary, not redundant.

| Layer | Question | Enforced by | A security boundary? |
| --- | --- | --- | --- |
| **Validation** | "Is this a well-formed event?" | zod `safeParse` (`src/schema.ts`, `src/ingest/server.ts`) | Shape only — not a content judgment |
| **Parameterized SQL** | "Can a field break out of a query?" | ClickHouse `query_params` / `{k:String}` (`src/store/clickhouse.ts`, `src/api/detections.ts`) | **Yes**, for query *values* |
| **HTML escaping** | "Can a field run in the operator's browser?" | client-side `esc()` in the dashboard (`src/api/spyglass.ts`, `src/api/incident.ts`) | **Yes**, for stored XSS — only as long as *every* field passes through it |
| **Spotlighting + advisory triage** | "Is this data or an instruction?" | escaped `<incident>` envelope; output never edits a detection (`src/triage/llm.ts`) | No — injection defense-in-depth + blast-radius limit |
| **Egress gate** | "Does anything leave the host?" | triage default-OFF; no call without key (`src/config.ts`) | **Yes**, for exfiltration |
| **Detection rules** | "Is this activity suspicious?" | deterministic SQL (`src/detection/rules.ts`) | No — a signal, bypassable |

Triage sits **beside** the deterministic pipeline, never above it: the rules decide what a
detection is and how severe it is; the LLM only attaches an advisory verdict/score for display.
A triage failure, timeout, or injection can therefore never suppress or downgrade a detection.

## Honest limitations (do not overclaim)

- **No authentication or authorization.** Ingest, the read API, and manual triage are all
  open to anyone who can reach the port. This is a documented MVP non-goal ("behind the trust
  boundary") — do not deploy to an untrusted network without a front door.
- **XSS safety is client-side and total-coverage.** The dashboard escapes untrusted fields
  with an inlined `esc()` in its `<script>`; there is no CSP header. A *single* untrusted field
  interpolated into HTML without `esc()` is stored XSS. New fields/columns must be escaped at
  every render site.
- **SQL identifiers can't be parameterized.** `query_params` binds *values* only; any table or
  column name must be hard-coded, never derived from request input. A future query that
  string-concatenates a filter value (instead of `{k:String}`) is injectable.
- **Triage is probabilistic and spotlighting is a hint.** The `<incident>` envelope helps the
  model separate data from instructions but does not guarantee it; the verdict can be wrong.
  That is tolerable *only because* it is advisory — keep it that way.
- **Egress is host-only and trusts the gateway.** When enabled, triage calls `ANTHROPIC_BASE_URL`;
  a custom/proxy gateway is fully trusted with the incident payload. The payload contains
  untrusted event text — keep the base URL pointed at something you trust.
- **Error bodies echo `String(err)`.** `server.ts` returns `detail: String(err)` on failures so
  clients can parse them; keep store internals and secrets out of thrown error messages.
- **Dedup keys are forgeable.** `event_id` (ingest) and `detection_id` (detection) drive
  at-least-once dedup; with no auth, a chosen id can overwrite/suppress a row. Confidentiality
  and integrity rest on network reachability, not on these keys.

## Reporting a vulnerability

Please open a security advisory on the GitHub repository rather than a public issue. Include
reproduction steps and the affected version.
