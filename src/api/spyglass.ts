/** Self-contained spyglass dashboard, served at GET /spyglass. Reads /v1/stats +
 *  /v1/detections and renders detection results. No build step. */
export const spyglassPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>spyglass · crowsnest</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    background:#0b0e14; color:#c9d1d9; padding:2rem 1.25rem; }
  main { max-width:980px; margin:0 auto; }
  h1 { font-size:1.6rem; margin:0; color:#e6edf3; }
  .sub { color:#7d8590; margin:.2rem 0 1.4rem; }
  .row { display:flex; flex-wrap:wrap; gap:.8rem; margin-bottom:1.4rem; }
  .card { flex:1; min-width:120px; border:1px solid #21262d; border-radius:10px; padding:.8rem 1rem; background:#0f141c; }
  .card .n { font-size:1.7rem; font-weight:700; color:#e6edf3; }
  .card .k { font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; color:#7d8590; }
  h2 { font-size:.74rem; text-transform:uppercase; letter-spacing:.08em; color:#7d8590; margin:1.6rem 0 .5rem; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; color:#7d8590; padding:.4rem .5rem; border-bottom:1px solid #30363d; }
  td { padding:.45rem .5rem; border-bottom:1px solid #161b22; vertical-align:top; }
  .sev { display:inline-block; min-width:5.2em; text-align:center; padding:0 .45em; border-radius:4px; font-size:.72rem; }
  .critical { background:#f8514933; color:#ff7b72; } .high { background:#db6d2833; color:#f0883e; }
  .medium { background:#d2992233; color:#e3b341; } .low { background:#3fb95033; color:#7ee787; }
  .muted { color:#7d8590; } a { color:#58a6ff; }
  .bar { height:.5rem; background:#1f6feb55; border-radius:3px; }
</style>
</head>
<body>
<main>
  <h1>🔭 spyglass</h1>
  <p class="sub">crowsnest detection results · <a href="/">ingest API</a> · <span id="updated" class="muted">loading…</span></p>

  <div class="row" id="cards"></div>

  <h2>By rule</h2>
  <table><tbody id="byrule"></tbody></table>

  <h2>Recent detections</h2>
  <table>
    <thead><tr><th>time</th><th>severity</th><th>rule</th><th>endpoint</th><th>summary</th></tr></thead>
    <tbody id="detections"></tbody>
  </table>
</main>
<script>
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
  const sevOrder = ['critical','high','medium','low'];

  async function fetchJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
    return r.json();
  }
  async function load() {
    const [stats, found] = await Promise.all([
      fetchJson('/v1/stats'),
      fetchJson('/v1/detections?limit=100'),
    ]);

    const bySev = Object.fromEntries((stats.bySeverity || []).map((r) => [r.severity, Number(r.n)]));
    const cards = [['total', stats.totals?.detections ?? 0], ...sevOrder.map((s) => [s, bySev[s] || 0])];
    document.getElementById('cards').innerHTML = cards.map(([k, n]) =>
      \`<div class="card"><div class="n">\${n}</div><div class="k">\${k}</div></div>\`).join('');

    const rules = stats.byRule || [];
    const max = Math.max(1, ...rules.map((r) => Number(r.n)));
    document.getElementById('byrule').innerHTML = rules.map((r) =>
      \`<tr><td style="white-space:nowrap">\${esc(r.rule)}</td><td style="width:60%"><div class="bar" style="width:\${(Number(r.n)/max*100)}%"></div></td><td class="muted">\${r.n}</td></tr>\`).join('')
      || '<tr><td class="muted">no detections yet</td></tr>';

    const rows = found.detections || [];
    document.getElementById('detections').innerHTML = rows.map((f) =>
      \`<tr><td class="muted">\${esc(f.ts)}</td><td><span class="sev \${esc(f.severity)}">\${esc(f.severity)}</span></td>\` +
      \`<td>\${esc(f.rule)}</td><td class="muted">\${esc(f.endpoint_user)}@\${esc(f.endpoint_host)}</td><td>\${esc(f.summary)}</td></tr>\`).join('')
      || '<tr><td colspan="5" class="muted">no detections yet — run the detector</td></tr>';

    document.getElementById('updated').textContent = 'updated ' + new Date().toLocaleTimeString();
  }
  // Both the initial load and each refresh surface failures on the badge, so a
  // ClickHouse blip after first paint shows "stale" instead of silently freezing.
  function refresh() {
    load().catch((e) => { document.getElementById('updated').textContent = 'stale — error: ' + e.message; });
  }
  refresh();
  setInterval(refresh, 15000);
</script>
</body>
</html>`;
