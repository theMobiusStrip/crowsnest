/** Self-contained spyglass dashboard, served at GET /spyglass. Reads /v1/stats, /v1/detections,
 *  /v1/fleet, /v1/correlations, /v1/incidents and renders the fleet view. No build step. */
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
  main { max-width:1040px; margin:0 auto; }
  h1 { font-size:1.6rem; margin:0; color:#e6edf3; }
  .sub { color:#7d8590; margin:.2rem 0 .4rem; }
  .desc { color:#8b949e; margin:0 0 1.4rem; max-width:74ch; }
  .row { display:flex; flex-wrap:wrap; gap:.8rem; margin-bottom:1.2rem; }
  .card { flex:1; min-width:110px; border:1px solid #21262d; border-radius:10px; padding:.7rem 1rem; background:#0f141c; }
  .card .n { font-size:1.7rem; font-weight:700; color:#e6edf3; }
  .card .k { font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; color:#7d8590; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }
  @media (max-width:720px){ .cols { grid-template-columns:1fr; } }
  h2 { font-size:.74rem; text-transform:uppercase; letter-spacing:.08em; color:#7d8590; margin:1.6rem 0 .5rem; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; color:#7d8590; padding:.4rem .5rem; border-bottom:1px solid #30363d; }
  td { padding:.45rem .5rem; border-bottom:1px solid #161b22; vertical-align:top; }
  .sev { display:inline-block; min-width:5.2em; text-align:center; padding:0 .45em; border-radius:4px; font-size:.72rem; }
  .critical { background:#f8514933; color:#ff7b72; } .high { background:#db6d2833; color:#f0883e; }
  .medium { background:#d2992233; color:#e3b341; } .low { background:#3fb95033; color:#7ee787; }
  .vd { display:inline-block; padding:0 .4em; border-radius:4px; font-size:.7rem; }
  .likely_benign { background:#3fb95033; color:#7ee787; } .needs_review { background:#d2992233; color:#e3b341; }
  .likely_malicious { background:#f8514933; color:#ff7b72; }
  .muted { color:#7d8590; } a { color:#58a6ff; text-decoration:none; } a:hover { text-decoration:underline; }
  .hint { position:relative; cursor:help; color:#7d8590; font-size:.82em; border-bottom:1px dotted #6e7681; }
  .hint .tip { display:none; position:absolute; left:0; top:1.5em; z-index:20; width:250px;
    background:#161b22; border:1px solid #30363d; border-radius:6px; padding:.5rem .6rem; color:#c9d1d9;
    font-size:.78rem; line-height:1.45; text-transform:none; letter-spacing:0; font-weight:400; white-space:normal; }
  .hint:hover .tip, .hint:focus .tip { display:block; }
  a.ilink { text-decoration:underline; font-weight:600; }
  .bar { height:.5rem; background:#1f6feb55; border-radius:3px; }
  .tag { font-size:.68rem; padding:0 .4em; border-radius:4px; background:#30363d; color:#adbac7; }
  .tag.stale { background:#f8514933; color:#ff7b72; }
  .hl { display:inline-block; padding:0 .4em; border-radius:4px; font-size:.68rem; }
  .hl.live { background:#3fb95033; color:#7ee787; } .hl.idle { background:#d2992233; color:#e3b341; }
  .hl.stale { background:#f8514933; color:#ff7b72; }
  .fleethealth { margin:-.1rem 0 .55rem; font-size:.82rem; }
  .evidence { color:#6e7681; font-size:.85em; white-space:pre-wrap; word-break:break-word; margin-top:.15rem; }
  .filter { background:#1f6feb22; border:1px solid #1f6feb55; border-radius:6px; padding:.05rem .45rem; }
</style>
</head>
<body>
<main>
  <h1>🔭 spyglass</h1>
  <p class="sub">crowsnest fleet view · <a href="/">ingest API</a> · <a href="/spyglass/admin">admin</a> ·
    <span id="triagestate" class="muted"></span> · <span id="scope"></span> ·
    <span id="updated" class="muted">loading…</span></p>
  <p class="desc">Security console for the <a href="https://github.com/theMobiusStrip/coble">coble</a> fleet —
    deterministic detections + advisory LLM triage across every agent run, by endpoint, rule, and incident.</p>

  <div class="row" id="cards"></div>

  <div class="cols">
    <div>
      <h2>By endpoint <span class="hint" tabindex="0">&#9432;<span class="tip">Per-host heartbeat from the last event: <b>live</b> &le;1h, <b>idle</b> &le;24h, <b>stale</b> &gt;24h (agent stopped shipping — a coverage gap).</span></span></h2>
      <div class="fleethealth" id="fleethealth"></div>
      <table><thead><tr><th>host</th><th>health</th><th>det</th><th>crit</th><th>last seen</th></tr></thead><tbody id="fleet"></tbody></table>
    </div>
    <div>
      <h2>By rule</h2>
      <table><tbody id="byrule"></tbody></table>
    </div>
  </div>

  <h2>Fleet-wide — same rule across &gt;1 host (24h)</h2>
  <table><tbody id="correlations"></tbody></table>

  <h2>Incidents — ranked by rule risk · triage is advisory (AI)</h2>
  <table>
    <thead><tr><th>severity</th><th>host</th><th>session <span class="hint" tabindex="0">&#9432;<span class="tip">One coble run — a single agent conversation/session. All its detections are grouped into this incident; click the session to open it.</span></span></th><th>rules</th><th>det</th><th>score</th><th>triage</th></tr></thead>
    <tbody id="incidents"></tbody>
  </table>

  <h2>Recent detections</h2>
  <table>
    <thead><tr><th>time</th><th>severity</th><th>rule</th><th>endpoint</th><th>summary</th></tr></thead>
    <tbody id="detections"></tbody>
  </table>
</main>
<script>
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); };
  var enc = encodeURIComponent;
  var sevOrder = ['critical','high','medium','low'];
  var host = new URLSearchParams(location.search).get('host') || '';
  var hostP = function (sep) { return host ? sep + 'host=' + enc(host) : ''; };
  var set = function (id, html) { document.getElementById(id).innerHTML = html; };
  var sevBadge = function (s) { return '<span class="sev ' + esc(s) + '">' + esc(s) + '</span>'; };
  var hlBadge = function (h) { h = h || 'stale'; return '<span class="hl ' + esc(h) + '">' + esc(h) + '</span>'; };
  var hostLink = function (h) { return '<a href="?host=' + enc(h) + '">' + esc(h) + '</a>'; };
  var emptyRow = function (cols, text) { return '<tr><td colspan="' + cols + '" class="muted">' + text + '</td></tr>'; };

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
      return r.json();
    });
  }

  function render(stats, det, fleet, corr, inc, meta) {
    stats = stats || {}; det = det || {}; fleet = fleet || {}; corr = corr || {}; inc = inc || {};
    var tri = (meta && meta.triage) || {};
    set('triagestate', tri.enabled
      ? 'AI triage: <b>on</b> <span class="muted">(' + esc(tri.model || '') + ')</span>'
      : 'AI triage: <b>off</b>');
    set('scope', host
      ? 'host: <span class="filter">' + esc(host) + '</span> <a href="?">✕ all</a>'
      : '<span class="muted">all hosts</span>');

    var bySev = {};
    (stats.bySeverity || []).forEach(function (r) { bySev[r.severity] = Number(r.n); });
    var cards = [['total', stats.totals ? stats.totals.detections : 0]].concat(
      sevOrder.map(function (s) { return [s, bySev[s] || 0]; }));
    set('cards', cards.map(function (kv) {
      return '<div class="card"><div class="n">' + kv[1] + '</div><div class="k">' + kv[0] + '</div></div>';
    }).join(''));

    var fh = fleet.health || { hosts: 0, live: 0, idle: 0, stale: 0 };
    set('fleethealth', fh.hosts
      ? '<span class="hl live">' + fh.live + ' live</span> · <span class="hl idle">' + fh.idle +
        ' idle</span> · <span class="hl stale">' + fh.stale + ' stale</span> ' +
        '<span class="muted">of ' + fh.hosts + '</span>'
      : '<span class="muted">no hosts yet</span>');

    set('fleet', (fleet.fleet || []).map(function (f) {
      var tags = (f.sensitivity > 1 ? ' <span class="tag">' + (f.sensitivity === 3 ? 'prod' : 'ci/stg') + '</span>' : '');
      return '<tr><td>' + hostLink(f.endpoint_host) + tags + '</td><td>' + hlBadge(f.health) +
        '</td><td>' + f.detections + '</td><td>' + (f.crit || 0) + '</td><td class="muted">' +
        esc(f.last_seen || '—') + '</td></tr>';
    }).join('') || emptyRow(5, 'no endpoints yet'));

    var rules = stats.byRule || [];
    var max = Math.max.apply(null, [1].concat(rules.map(function (r) { return Number(r.n); })));
    set('byrule', rules.map(function (r) {
      return '<tr><td style="white-space:nowrap">' + esc(r.rule) +
        '</td><td style="width:55%"><div class="bar" style="width:' + (Number(r.n) / max * 100) +
        '%"></div></td><td class="muted">' + r.n + '</td></tr>';
    }).join('') || emptyRow(3, 'no detections yet'));

    set('correlations', (corr.correlations || []).map(function (co) {
      return '<tr><td>' + esc(co.rule) + '</td><td class="muted">' + co.hosts +
        ' hosts</td><td class="muted">' + (co.host_list || []).map(esc).join(', ') + '</td></tr>';
    }).join('') || emptyRow(3, 'no cross-host correlations'));

    set('incidents', (inc.incidents || []).map(function (i) {
      var t = i.triage;
      var triageCell = t
        ? '<span class="vd ' + esc(t.verdict) + '">' + esc(String(t.verdict).replace(/_/g, ' ')) + '</span> ' + esc(t.score) +
          (t.rationale ? '<div class="evidence">' + esc(t.rationale) + '</div>' : '')
        : '<span class="muted">—</span>';
      return '<tr><td>' + sevBadge(i.worst_severity) + '</td><td>' + hostLink(i.endpoint_host) +
        '</td><td><a class="ilink" href="/spyglass/incident?session=' + enc(i.session_id) + '&amp;host=' + enc(i.endpoint_host) +
        '" title="open incident details">' + esc(i.session_id) + ' ↗</a></td><td>' + (i.rules || []).map(esc).join(', ') +
        '</td><td>' + i.detections + '</td><td>' + i.score + '</td><td>' + triageCell + '</td></tr>';
    }).join('') || emptyRow(7, 'no incidents yet'));

    set('detections', (det.detections || []).map(function (d) {
      var evidence = d.detail ? '<div class="evidence">' + esc(d.detail) + '</div>' : '';
      return '<tr><td class="muted">' + esc(d.ts) + '</td><td>' + sevBadge(d.severity) + '</td><td>' +
        esc(d.rule) + '</td><td class="muted">' + esc(d.endpoint_user) + '@' + esc(d.endpoint_host) +
        '</td><td>' + esc(d.summary) + evidence + '</td></tr>';
    }).join('') || emptyRow(5, 'no detections yet — run the detector'));
  }

  // allSettled so one failing endpoint (e.g. a missing view, or a transient blip) degrades to
  // that panel being empty + a count on the badge — not a fully blank dashboard.
  function load() {
    return Promise.allSettled([
      fetchJson('/v1/stats' + hostP('?')),
      fetchJson('/v1/detections?limit=100' + hostP('&')),
      fetchJson('/v1/fleet'),
      fetchJson('/v1/correlations'),
      fetchJson('/v1/incidents' + hostP('?')),
      fetchJson('/v1/meta'),
    ]).then(function (rs) {
      var val = function (i) { return rs[i].status === 'fulfilled' ? rs[i].value : null; };
      render(val(0), val(1), val(2), val(3), val(4), val(5));
      var failed = rs.filter(function (r) { return r.status === 'rejected'; }).length;
      var stamp = 'updated ' + new Date().toLocaleTimeString();
      document.getElementById('updated').textContent = failed ? stamp + ' · ' + failed + ' panel(s) failed' : stamp;
    });
  }

  // Both the initial load and each refresh surface failures on the badge, so a ClickHouse blip
  // after first paint shows "stale" instead of silently freezing.
  function refresh() {
    load().catch(function (e) {
      document.getElementById('updated').textContent = 'stale — error: ' + e.message;
    });
  }
  refresh();
  setInterval(refresh, 15000);
</script>
</body>
</html>`;
