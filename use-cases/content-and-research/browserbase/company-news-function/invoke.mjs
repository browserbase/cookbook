import { pathToFileURL } from 'node:url';

export async function invokeCompanyNews({ browserbaseApiKey, apiKey, functionId, companyName, model = 'gpt-5.4-mini', maxSteps = 30 }, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (const value of [browserbaseApiKey, apiKey, functionId, companyName]) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Set Browserbase and OpenAI keys, FUNCTION_ID, and company name.');
  }
  const headers = { 'x-bb-api-key': browserbaseApiKey, 'Content-Type': 'application/json' };
  const request = async (url, options = {}) => {
    const response = await fetchImpl(url, { ...options, headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Functions request failed (HTTP ${response.status}).`);
    return response.json();
  };
  const invocation = await request(`https://api.browserbase.com/v1/functions/${encodeURIComponent(functionId)}/invoke`, {
    method: 'POST', body: JSON.stringify({ params: { companyName, apiKey, model, maxSteps } }),
  });
  if (typeof invocation.id !== 'string' || !invocation.id) throw new Error('Missing invocation ID.');
  for (let attempt = 0; attempt < 300; attempt++) {
    const poll = await request(`https://api.browserbase.com/v1/functions/invocations/${encodeURIComponent(invocation.id)}`);
    if (poll.status === 'FAILED') throw new Error('Function invocation failed.');
    if (poll.status === 'COMPLETED') {
      const result = poll.results;
      if (result?.success !== true || typeof result.summary !== 'string' || !result.summary.trim() || !Array.isArray(result.topLinks) || result.topLinks.length === 0 || result.topLinks.some(link => !link || typeof link.title !== 'string' || typeof link.url !== 'string' || typeof link.source !== 'string') || typeof result.metadata?.sessionReplayUrl !== 'string') throw new Error('News search did not return a valid successful result.');
      return result;
    }
    if (!['PENDING', 'RUNNING'].includes(poll.status)) throw new Error('Unknown invocation status.');
    await sleep(3000);
  }
  throw new Error('Polling limit reached; the invocation may still be running.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await invokeCompanyNews({
      browserbaseApiKey: process.env.BROWSERBASE_API_KEY, apiKey: process.env.OPENAI_API_KEY,
      functionId: process.env.FUNCTION_ID, companyName: process.argv[2],
    });
    console.log(result.summary);
    for (const link of result.topLinks) console.log(`${link.title}\n${link.source}: ${link.url}`);
    console.log(`Replay: ${result.metadata.sessionReplayUrl}`);
  } catch { console.error('News invocation failed. Check configuration and the invocation in the dashboard.'); process.exitCode = 1; }
}
