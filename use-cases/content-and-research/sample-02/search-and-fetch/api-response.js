export async function readApiResponse(response, kind) {
  if (!response.ok) throw new Error(`Browserbase ${kind} HTTP ${response.status}`);
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`Browserbase ${kind} returned invalid JSON`); }
  if (!data || typeof data !== "object" || Array.isArray(data) || data.error || data.success === false) {
    throw new Error(`Browserbase ${kind} returned an API error`);
  }
  if (data.statusCode !== undefined && (!Number.isInteger(data.statusCode) || data.statusCode < 200 || data.statusCode >= 300)) {
    throw new Error(`Browserbase ${kind} target request failed`);
  }
  if (kind === "search") {
    if (!Array.isArray(data.results) || data.results.some(row => !row || typeof row.url !== "string" || !/^https?:\/\//.test(row.url))) {
      throw new Error("Browserbase search returned invalid results");
    }
  } else if (!data.content || typeof data.content !== "object" || Array.isArray(data.content) || typeof data.content.is_relevant !== "boolean") {
    throw new Error("Browserbase extraction returned invalid signal content");
  }
  return data;
}
