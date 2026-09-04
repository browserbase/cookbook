/** Attach a bearer header only to requests whose origin matches the tunnel. */
export async function installTunnelAuth(cdp, { tunnelUrl, headerName, secret }, onError = () => {}) {
  const tunnel = new URL(tunnelUrl);
  if (!['http:', 'https:'].includes(tunnel.protocol) || tunnel.username || tunnel.password) {
    throw new Error('Tunnel URL must be an HTTP(S) origin without credentials');
  }
  if (typeof headerName !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(headerName)) {
    throw new Error('Invalid tunnel header name');
  }
  if (typeof secret !== 'string' || !secret || /[\r\n]/.test(secret)) {
    throw new Error('Invalid tunnel secret');
  }
  const headerKey = headerName.toLowerCase();
  const pending = new Set();
  const handle = async ({ requestId, request }) => {
    try {
      const headers = Object.entries(request.headers)
        .filter(([name]) => name.toLowerCase() !== headerKey)
        .map(([name, value]) => ({ name, value: String(value) }));
      const url = new URL(request.url);
      if (url.origin === tunnel.origin && !url.username && !url.password) {
        headers.push({ name: headerName, value: secret });
      }
      // CDP overrides apply to this request only; each redirect is paused again.
      await cdp.send('Fetch.continueRequest', { requestId, headers });
    } catch {
      try { await cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); } catch {}
      onError();
    }
  };
  const listener = event => {
    const task = handle(event);
    pending.add(task);
    void task.finally(() => pending.delete(task)).catch(() => {});
  };
  await cdp.send('Network.enable');
  // Remove any page-wide override left by an earlier version of attach.mjs.
  await cdp.send('Network.setExtraHTTPHeaders', { headers: {} });
  cdp.on('Fetch.requestPaused', listener);
  try {
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  } catch (error) {
    cdp.off('Fetch.requestPaused', listener);
    throw error;
  }
  return async () => {
    await cdp.send('Fetch.disable');
    cdp.off('Fetch.requestPaused', listener);
    await Promise.allSettled([...pending]);
  };
}
