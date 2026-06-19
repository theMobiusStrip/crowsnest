/** Self-contained admin console, served at GET /spyglass/admin. Reads /v1/meta and writes
 *  /v1/config to toggle LLM triage, set the model, and (local-only) the base URL + API key.
 *  Key/base URL persist to a gitignored 0600 secrets file, never the DB; the key is never returned. */
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
  .warn { color:#e3b341; }
  .card { border:1px solid #21262d; border-radius:10px; padding:1rem 1.2rem; background:#0f141c; }
  .form { display:flex; flex-direction:column; gap:.9rem; }
  .row { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
  label { color:#c9d1d9; }
  input[type=text], input[type=password] { background:#0b0e14; color:#c9d1d9; border:1px solid #30363d; border-radius:6px; padding:.35rem .5rem; font:inherit; min-width:280px; }
  input[type=checkbox] { width:16px; height:16px; }
  button { background:#1f6feb; color:#fff; border:0; border-radius:6px; padding:.4rem 1rem; cursor:pointer; font:inherit; }
  button:hover { background:#388bfd; }
  button.secondary { background:#30363d; } button.secondary:hover { background:#3c444d; }
  .muted { color:#7d8590; } a { color:#58a6ff; text-decoration:none; } a:hover { text-decoration:underline; }
  code { background:#161b22; border-radius:4px; padding:0 .3em; }
</style>
</head>
<body>
<main>
  <h1>🔭 admin</h1>
  <p class="sub"><a href="/spyglass">← spyglass</a> · triage configuration</p>
  <p class="desc">Configure LLM triage at runtime. enable/disable + model persist to the DB; the
    <b>base URL</b> + <b>API key</b> persist to a gitignored <code>0600</code> file (never the DB, never
    shown back). <span class="warn">⚠ This console is unauthenticated and the key is sent to whatever base
    URL you set — only run crowsnest on a trusted/local host.</span> Changes apply on the detector's next
    run; <b>restart</b> needs a supervisor (docker/pm2) to come back up.</p>

  <div class="card">
    <form id="cfg" class="form">
      <label class="row"><input type="checkbox" id="enabled"> AI triage enabled</label>
      <label class="row">model <input type="text" id="model" placeholder="claude-opus-4-7"></label>
      <label class="row">base URL <input type="text" id="baseUrl" placeholder="https://api.anthropic.com"></label>
      <label class="row">API key <input type="password" id="apiKey" placeholder="leave blank to keep current"> <span id="keystate" class="muted"></span></label>
      <div class="row">
        <button type="submit">save</button>
        <button type="button" id="restart" class="secondary">restart</button>
        <span id="status" class="muted"></span>
      </div>
    </form>
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
    document.getElementById('baseUrl').value = t.baseUrl || '';
    document.getElementById('apiKey').value = '';
    document.getElementById('keystate').textContent = t.keyPresent ? '(currently set)' : '(not set)';
  }
  fetchJson('/v1/meta').then(fill).catch(function (e) {
    document.getElementById('status').textContent = 'error: ' + e.message;
  });
  document.getElementById('cfg').addEventListener('submit', function (e) {
    e.preventDefault();
    var s = document.getElementById('status');
    s.textContent = 'saving…';
    var body = { enabled: document.getElementById('enabled').checked };
    var model = document.getElementById('model').value.trim();
    var baseUrl = document.getElementById('baseUrl').value.trim();
    var apiKey = document.getElementById('apiKey').value;
    if (model) body.model = model;
    if (baseUrl) body.baseUrl = baseUrl;
    if (apiKey) body.apiKey = apiKey;
    fetchJson('/v1/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (j) { fill(j); s.textContent = 'saved ✓'; })
      .catch(function (err) { s.textContent = 'error: ' + err.message; });
  });
  document.getElementById('restart').addEventListener('click', function () {
    var s = document.getElementById('status');
    s.textContent = 'restarting…';
    fetch('/v1/restart', { method: 'POST' })
      .then(function () { s.textContent = 'restart requested — reload once it is back (needs a supervisor)'; })
      .catch(function () { s.textContent = 'restart requested'; });
  });
</script>
</body>
</html>`;
