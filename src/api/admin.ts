/** Self-contained admin console, served at GET /spyglass/admin. Reads /v1/meta and writes
 *  /v1/config to toggle LLM triage + set the model at runtime. The API key and base URL are
 *  env-only (never editable here) — shown read-only. */
export const adminPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>admin · crowsnest</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    background:#0b0e14; color:#c9d1d9; padding:2rem 1.25rem; }
  main { max-width:680px; margin:0 auto; }
  h1 { font-size:1.6rem; margin:0; color:#e6edf3; }
  .sub { color:#7d8590; margin:.2rem 0 .4rem; }
  .desc { color:#8b949e; margin:0 0 1.4rem; }
  .card { border:1px solid #21262d; border-radius:10px; padding:1rem 1.2rem; background:#0f141c; }
  .form { display:flex; flex-direction:column; gap:.9rem; }
  .row { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
  label { color:#c9d1d9; }
  input[type=text] { background:#0b0e14; color:#c9d1d9; border:1px solid #30363d; border-radius:6px; padding:.35rem .5rem; font:inherit; min-width:260px; }
  input[type=checkbox] { width:16px; height:16px; }
  button { background:#1f6feb; color:#fff; border:0; border-radius:6px; padding:.4rem 1rem; cursor:pointer; font:inherit; }
  button:hover { background:#388bfd; }
  .muted { color:#7d8590; } a { color:#58a6ff; text-decoration:none; } a:hover { text-decoration:underline; }
  table.ro { width:100%; border-collapse:collapse; margin-top:1rem; }
  table.ro td { padding:.4rem .5rem; border-bottom:1px solid #161b22; }
  table.ro td:first-child { color:#7d8590; width:12rem; }
  code { background:#161b22; border-radius:4px; padding:0 .3em; }
  .ok { color:#7ee787; } .warn { color:#e3b341; }
</style>
</head>
<body>
<main>
  <h1>🔭 admin</h1>
  <p class="sub"><a href="/spyglass">← spyglass</a> · triage configuration</p>
  <p class="desc">Toggle automatic LLM triage and set the model at runtime (persisted; the detector
    picks it up on its next run). The <b>API key</b> and <b>base URL</b> stay environment-only —
    a mutable base URL on an unauthenticated console could leak the key — so set
    <code>ANTHROPIC_API_KEY</code> / <code>ANTHROPIC_BASE_URL</code> in the environment.</p>

  <div class="card">
    <form id="cfg" class="form">
      <label class="row"><input type="checkbox" id="enabled"> AI triage enabled</label>
      <label class="row">model <input type="text" id="model" placeholder="claude-opus-4-7"></label>
      <div class="row"><button type="submit">save</button> <span id="status" class="muted"></span></div>
    </form>
    <table class="ro">
      <tr><td>base URL (env)</td><td id="baseUrl" class="muted">—</td></tr>
      <tr><td>API key (env)</td><td id="key" class="muted">—</td></tr>
    </table>
  </div>
</main>
<script>
  function fetchJson(url, opts) {
    return fetch(url, opts).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function fill(m) {
    var t = m.triage || {};
    document.getElementById('enabled').checked = !!t.enabled;
    document.getElementById('model').value = t.model || '';
    document.getElementById('baseUrl').textContent = t.baseUrl || '—';
    var k = document.getElementById('key');
    k.textContent = t.keyPresent ? 'present ✓' : 'missing — set ANTHROPIC_API_KEY';
    k.className = t.keyPresent ? 'ok' : 'warn';
  }
  fetchJson('/v1/meta').then(fill).catch(function (e) {
    document.getElementById('status').textContent = 'error: ' + e.message;
  });
  document.getElementById('cfg').addEventListener('submit', function (e) {
    e.preventDefault();
    var s = document.getElementById('status');
    s.textContent = 'saving…';
    fetchJson('/v1/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: document.getElementById('enabled').checked, model: document.getElementById('model').value }),
    }).then(function (j) { fill(j); s.textContent = 'saved ✓'; })
      .catch(function (err) { s.textContent = 'error: ' + err.message; });
  });
</script>
</body>
</html>`;
