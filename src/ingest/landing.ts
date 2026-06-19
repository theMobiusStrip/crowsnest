/** Self-contained landing page served at GET / — API overview + live health. */
export const landingPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>crowsnest · ingest API</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    background:#0b0e14; color:#c9d1d9; display:flex; justify-content:center; padding:2.5rem 1rem; }
  main { width:100%; max-width:720px; }
  h1 { font-size:1.7rem; margin:0 0 .25rem; color:#e6edf3; }
  .sub { color:#7d8590; margin:0 0 1.4rem; }
  .status { display:inline-flex; align-items:center; gap:.5rem; padding:.3rem .8rem;
    border:1px solid #30363d; border-radius:999px; font-size:.85rem; }
  .dot { width:.6rem; height:.6rem; border-radius:50%; background:#7d8590; }
  .dot.ok { background:#3fb950; } .dot.bad { background:#f85149; }
  h2 { font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; color:#7d8590; margin:2rem 0 .6rem; }
  table { width:100%; border-collapse:collapse; }
  td { padding:.45rem .5rem; border-bottom:1px solid #21262d; vertical-align:top; }
  td.m { white-space:nowrap; }
  .method { display:inline-block; min-width:3.2em; padding:0 .4em; border-radius:4px;
    font-size:.76rem; text-align:center; margin-right:.5rem; }
  .get { background:#1f6feb33; color:#79c0ff; } .post { background:#3fb95033; color:#7ee787; }
  code { color:#79c0ff; }
  pre { background:#161b22; border:1px solid #21262d; border-radius:8px; padding:1rem; overflow:auto; font-size:.8rem; }
  a { color:#58a6ff; }
  footer { margin-top:2.5rem; color:#7d8590; font-size:.82rem; }
</style>
</head>
<body>
<main>
  <h1>🪺 crowsnest</h1>
  <p class="sub">Ingest API — tool-decision events from the <a href="https://github.com/theMobiusStrip/coble">coble</a> fleet, watched centrally. <a href="/spyglass">spyglass dashboard →</a></p>
  <span class="status"><span id="dot" class="dot"></span><span id="st">checking…</span></span>

  <h2>Endpoints</h2>
  <table>
    <tr><td class="m"><span class="method post">POST</span><code>/v1/events</code></td><td>Ingest a batch of events. Body <code>{ "events": [Event, …] }</code> → <code>202 {"accepted":N}</code>.</td></tr>
    <tr><td class="m"><span class="method get">GET</span><code>/healthz</code></td><td>Liveness + store status.</td></tr>
    <tr><td class="m"><span class="method get">GET</span><code>/</code></td><td>This page.</td></tr>
    <tr><td class="m"><span class="method get">GET</span><code>/spyglass</code></td><td>Detection dashboard.</td></tr>
  </table>

  <h2>Event shape</h2>
  <pre>{
  "schema_version": 1,
  "event_id": "uuid",             // dedup key
  "ts": "2026-06-18T22:00:00Z",   // ISO-8601
  "endpoint": { "user": "…", "host": "…" },
  "session_id": "…", "coble_version": "…",
  "mode": "default", "sandbox_on": false,
  "tool": "bash", "tier": "safe",
  "decision": "auto",             // auto | approved | denied | error
  "detail": "…"                   // reason (redacted at the edge)
}</pre>

  <h2>Try it</h2>
  <pre>curl -sS localhost:8787/v1/events -H 'content-type: application/json' \\
  -d '{"events":[{"schema_version":1,"event_id":"x1","ts":"2026-06-18T22:00:00Z",
  "endpoint":{"user":"evan","host":"mac"},"session_id":"s1","coble_version":"0.4.1",
  "mode":"default","sandbox_on":false,"tool":"bash","tier":"safe","decision":"auto"}]}'</pre>

  <footer>crowsnest · <a href="https://github.com/theMobiusStrip/crowsnest">github.com/theMobiusStrip/crowsnest</a></footer>
</main>
<script>
  fetch('/healthz').then(r => r.json().then(j => ({ ok: r.ok, j })))
    .then(({ ok, j }) => {
      const dot = document.getElementById('dot'), st = document.getElementById('st');
      if (ok && j.status === 'ok') { dot.className = 'dot ok'; st.textContent = 'healthy · store connected'; }
      else { dot.className = 'dot bad'; st.textContent = 'degraded · store ' + (j.store ? 'ok' : 'down'); }
    })
    .catch(() => {
      document.getElementById('dot').className = 'dot bad';
      document.getElementById('st').textContent = 'unreachable';
    });
</script>
</body>
</html>`;
