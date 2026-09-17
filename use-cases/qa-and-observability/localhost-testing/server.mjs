import http from 'node:http';

const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Acme Staging — Local Dev</title>
<style>
  :root{--bg:#0b0f17;--card:#131a26;--line:#243043;--text:#e6edf6;--muted:#8aa0bd;--accent:#5b8cff;--ok:#37d39b}
  *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#16203150,transparent),var(--bg);color:var(--text);min-height:100vh;display:grid;place-items:center}
  .badge{position:fixed;top:18px;left:50%;transform:translateX(-50%);background:#1b2433;border:1px solid var(--line);color:var(--muted);font-size:13px;padding:7px 14px;border-radius:999px}
  .badge b{color:#ffb454}
  .card{width:380px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:32px;box-shadow:0 20px 60px #0008}
  .logo{display:flex;align-items:center;gap:10px;margin-bottom:24px}
  .dot{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--accent),#9b5bff)}
  .logo span{font-weight:700;font-size:18px;letter-spacing:.2px}
  h1{font-size:20px;margin:0 0 4px}.sub{color:var(--muted);font-size:13px;margin:0 0 22px}
  label{display:block;font-size:12px;color:var(--muted);margin:14px 0 6px}
  input{width:100%;padding:11px 13px;background:#0e1521;border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:14px;outline:none}
  input:focus{border-color:var(--accent)}
  button{width:100%;margin-top:22px;padding:12px;border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:600;font-size:15px;cursor:pointer}
  #dashboard{display:none;text-align:center}
  #dashboard.show{display:block}.card.hide{display:none}
  .check{width:64px;height:64px;border-radius:50%;background:#10261f;border:1px solid #1f5142;display:grid;place-items:center;margin:0 auto 18px}
  .check svg{stroke:var(--ok)}
  .kpis{display:flex;gap:12px;margin-top:22px}
  .kpi{flex:1;background:#0e1521;border:1px solid var(--line);border-radius:10px;padding:14px}
  .kpi .n{font-size:22px;font-weight:700}.kpi .l{font-size:11px;color:var(--muted);margin-top:2px}
</style></head><body>
<div class="badge">🔒 Served from <b>127.0.0.1:3000</b> — not reachable from the public internet</div>

<div class="card" id="login-card">
  <div class="logo"><div class="dot"></div><span>Acme Staging</span></div>
  <h1>Sign in</h1><p class="sub">Internal QA environment</p>
  <label for="email">Email</label>
  <input id="email" type="email" placeholder="operator@example.invalid" autocomplete="off"/>
  <label for="password">Password</label>
  <input id="password" type="password" placeholder="••••••••"/>
  <button id="login-button" onclick="doLogin()">Sign in</button>
</div>

<div class="card hide" id="dashboard-card">
  <div id="dashboard" class="show">
    <div class="check"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg></div>
    <h1 id="dashboard-title">Welcome, QA Agent</h1>
    <p class="sub" id="who"></p>
    <div class="kpis">
      <div class="kpi"><div class="n">98.6%</div><div class="l">Pass rate</div></div>
      <div class="kpi"><div class="n">142</div><div class="l">Tests today</div></div>
      <div class="kpi"><div class="n">2.3m</div><div class="l">Avg CI time</div></div>
    </div>
  </div>
</div>

<script>
function doLogin(){
  var email=document.getElementById('email').value||'qa@example.invalid';
  document.getElementById('login-button').textContent='Signing in…';
  setTimeout(function(){
    document.getElementById('login-card').classList.add('hide');
    document.getElementById('dashboard-card').classList.remove('hide');
    document.getElementById('who').textContent='Signed in as '+email;
  },500);
}
</script></body></html>`;

http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(3000, '127.0.0.1', () => console.log('Acme Staging running at http://127.0.0.1:3000'));
