import http from 'node:http';
const UPSTREAM = 'https://example.invalid/test-runner-api';
const PORT = Number(process.env.SHIM_PORT || 8000);
const BB_CONNECT_URL = process.env.BB_CONNECT_URL;
if (!BB_CONNECT_URL) { console.error('BB_CONNECT_URL required'); process.exit(1); }
const log = (...a) => console.log('[shim]', ...a);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname.endsWith('/browsers/connection')) {
    let b=''; req.on('data',c=>b+=c); await new Promise(r=>req.on('end',r));
    log('⟶ INTERCEPTED', url.pathname, '— handing external test runner a BROWSERBASE session');
    res.writeHead(200, { 'content-type':'application/json' });
    res.end(JSON.stringify({ wsEndpoint: BB_CONNECT_URL, endpointType:'CDP', provider:'BROWSERBASE' }));
    return;
  }
  const chunks=[]; req.on('data',c=>chunks.push(c)); await new Promise(r=>req.on('end',r));
  const bodyBuf = Buffer.concat(chunks);
  const headers = { ...req.headers }; delete headers.host; delete headers['content-length'];
  try {
    const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
      method: req.method, headers,
      body: ['GET','HEAD'].includes(req.method) ? undefined : bodyBuf,
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    log(`  ${req.method} ${url.pathname} -> ${upstream.status} (${buf.length}b)`);
    const outHeaders={}; upstream.headers.forEach((v,k)=>{ if(!['content-encoding','transfer-encoding','content-length'].includes(k)) outHeaders[k]=v; });
    res.writeHead(upstream.status, outHeaders); res.end(buf);
  } catch(e){ log('  pass-through error', url.pathname, e.message); res.writeHead(502); res.end('shim upstream error'); }
});
server.listen(PORT,'127.0.0.1',()=>log(`listening on http://127.0.0.1:${PORT} -> ${UPSTREAM}`));
