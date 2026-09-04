import { Stagehand } from "@browserbasehq/stagehand";
import { tool } from "ai";
import { z } from "zod";

/**
 * extractAllNotes — the deterministic core of vagaro/customer-notes.
 *
 * The agent (LLM) is reliable at navigation + capture, but NOT at executing the precise
 * ~3,000-customer notes-replay loop: across runs we saw churn (state resets losing notes),
 * under-pull, off-script thrash, and hangs. Same prompt → 36 notes one run, failure the next.
 *
 * So the loop lives here as FIXED CODE the agent merely *calls* once. The agent captures the two
 * real requests into `window.__cReq` (customers/retrieve) and `window.__nReq` (notes/retrieve);
 * this tool then owns everything deterministic:
 *   1. pull EVERY customer (LastSyncTime=0 full pull, size-agnostic pagination)
 *   2. replay notes/retrieve per customer (per-customer encrypted consumerId header), with
 *      AbortController timeouts, bounded concurrency, dedup-by-note-id, and an answered-set so
 *      re-passes only retry the unanswered → converges to full coverage
 *   3. map one row per note and trigger the blob download (runner retrieves it)
 *
 * Node drives the loop in bounded chunks (each page.evaluate runs a ~time-boxed slice and returns
 * progress), so a stalled Vagaro call can't hang the run and the agent can't improvise the loop.
 */

// One in-browser chunk runs roughly this long before returning progress to Node, which re-invokes
// it. Keeps each evaluate() short so a stalled fetch can't wedge the whole run.
const CUST_CHUNK_MS = 20_000;
const NOTES_CHUNK_MS = 25_000;
// Node-side timeout per evaluate() — chunk budget plus headroom for the round-trip.
const EVAL_TIMEOUT_MS = 60_000;
// HARD overall wall-clock budget for the notes-replay phase. On timeout we stop, download what we
// have, and report it as partial — a run can never grind indefinitely (the old failure mode).
const NOTES_DEADLINE_MS = 9 * 60_000;
// Safety caps so a pathological account / endpoint can't loop forever.
const MAX_CUST_PASSES = 60;
const MAX_NOTES_PASSES = 600;
// Stall guard: stop if recent passes make no meaningful headway. A handful of customers can
// persistently 500 under load — they'd otherwise be retried every pass forever (some succeeding,
// so `newlyAnswered === 0` never trips). Bail after this many consecutive low-progress passes.
const NOTES_STALL_LIMIT = 4;
// "Low progress" = a pass answers fewer than this many new customers. Above 0 so persistent-error
// dribble (1-2 recoveries/pass) still counts as stalled and we don't spin to the pass cap.
const NOTES_MIN_PROGRESS = 3;
// Per-customer notes replay concurrency. Vagaro 500s under heavy concurrent load — keep modest.
const NOTES_CONC = 8;

// Lightweight tagged logger so the Node-driven loop is observable live in the run's stdout/trace
// (the agent only sees the final return value; this is for us watching the batch).
const log = (msg: string) => console.log(`  [extractAllNotes] ${msg}`);

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      );
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

// Shared helpers injected into every in-browser chunk.
// CID = the customer's encrypted consumer id, used BOTH as the dedup key and as the notes/retrieve
// consumerId request header. This account's full-pull (ForStorage=true, compact) record names it
// `id`; fall back to the readable variants for other accounts.
const HELPERS = `
const findArr = (o)=>{ for (const k in o){ if (Array.isArray(o[k]) && (o[k].length===0 || typeof o[k][0]==='object')) return o[k]; if (o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])){ const f=findArr(o[k]); if (f!==null) return f; } } return null; };
const tfetch = async (url,opts,ms)=>{ const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),ms||10000); try{ return await fetch(url,{...opts,signal:ctl.signal}); } finally{ clearTimeout(to); } };
const CID = (x)=> x.id ?? x.consumerId ?? x.ConsumerId ?? x.encryptedId ?? null;
`;

// --- Phase 0: are both requests captured? -------------------------------------------------------
const CHECK_CAPTURE = `(async () => {
  return { cReq: !!window.__cReq, nReq: !!window.__nReq,
    cUrl: window.__cReq ? String(window.__cReq.url).slice(0,80) : null,
    nUrl: window.__nReq ? String(window.__nReq.url).slice(0,80) : null };
})()`;

// --- Phase 0.5: reconstruct __cReq from __nReq if it wasn't captured -----------------------------
// customers/retrieve fires on PAGE LOAD, so the interceptor often misses it (a race) — but
// notes/retrieve only fires on a deliberate Notes-tab click, which the agent always does. Both hit
// the same host/region with the same auth headers (s_utkn, grouptoken), so we can derive the
// customers request from the notes one. This makes the agent's only hard requirement "capture
// notes/retrieve", removing the flaky page-load dependency.
const RECONSTRUCT_CREQ = `(async () => {
  if (window.__cReq) return { reconstructed:false, cReq:true };
  const n = window.__nReq;
  if (!n) return { reconstructed:false, cReq:false, nReq:false };
  const m = String(n.url).match(/^(https?:\\/\\/[^/]+\\/.*?\\/api\\/v[0-9]+\\/)/i);
  if (!m) return { reconstructed:false, cReq:false, nReq:true, note:"no api base in notes url" };
  const url = m[1] + "merchants/customers/retrieve?searchtext=&Page=1&PageSize=200&ForStorage=true&LastSyncTime=0";
  const h = {}; for (const k in (n.headers||{})) { if (/consumerid|content-type|content-length/i.test(k)) continue; h[k] = n.headers[k]; }
  window.__cReq = { url, method:"GET", headers:h, body:null };
  return { reconstructed:true, cReq:true, base:m[1] };
})()`;

// --- Phase 1: pull EVERY customer (one time-boxed slice per call) --------------------------------
const PULL_CUSTOMERS = `(async () => {
${HELPERS}
  const c = window.__cReq;
  if (!c) return { error: "no __cReq" };
  const setP = (url,k,v) => { const u = new URL(url); u.searchParams.set(k,v); return u.toString(); };
  window.__cust_byId = window.__cust_byId || new Map();
  if (window.__cust_page == null) window.__cust_page = 1;
  if (window.__cust_total == null) window.__cust_total = Infinity;
  const byId = window.__cust_byId;
  const start = Date.now();
  let empty = 0;
  while (byId.size < window.__cust_total && window.__cust_page <= 5000 && (Date.now()-start) < ${CUST_CHUNK_MS}) {
    const page = window.__cust_page;
    const url = setP(setP(setP(c.url, "Page", page), "PageSize", 200), "LastSyncTime", 0);
    let arr=[], tot=null;
    try {
      const r = await tfetch(url, { method: c.method||"GET", headers:c.headers }, 12000);
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt); } catch(e){}
      if (j) { arr = findArr(j) ?? []; tot = j.total ?? j.totalRecords ?? j.totalRecord ?? null; }
      if (page === 1 && !window.__cust_dbg) window.__cust_dbg = { status:r.status, ok:r.ok, urlHit:String(url).slice(0,120), keys: j? Object.keys(j).slice(0,12): null, arrLen: arr.length, bodyHead: txt.slice(0,200) };
    } catch(e){ if (page === 1 && !window.__cust_dbg) window.__cust_dbg = { err: String(e && e.message || e), urlHit:String(url).slice(0,120) }; }
    if (!arr.length) { if (empty<2){ empty++; await new Promise(s=>setTimeout(s,800)); continue; } window.__cust_done = true; break; }
    empty = 0; if (tot!=null && +tot>0) window.__cust_total = +tot;
    const before = byId.size;
    for (const x of arr) { const id=CID(x); if (id) byId.set(id, x); } // key by encrypted id; store FULL raw record
    window.__cust_page++;
    // This account's full-pull (LastSyncTime=0) returns the ENTIRE set on every page — it ignores the
    // Page param — so an empty page never comes. Terminate when a non-empty page adds NO new ids.
    if (byId.size === before) { window.__cust_done = true; break; }
  }
  const done = !!window.__cust_done || byId.size >= window.__cust_total;
  // ALWAYS publish the current customer set (even on a deadline/cap exit) so Phase 2 has it.
  window.__customers = [...byId.values()];
  window.__notesById = window.__notesById || {};
  window.__answered = window.__answered || {};
  return { done, customers: byId.size, total: (window.__cust_total===Infinity?null:window.__cust_total), dbg: window.__cust_dbg || null };
})()`;

// --- Phase 2: replay notes per customer (one time-boxed slice per call) --------------------------
export const REPLAY_NOTES = `(async () => {
${HELPERS}
  const n = window.__nReq; const cs = window.__customers;
  if (!n) return { error: "no __nReq" };
  if (!cs) return { error: "no __customers" };
  const start = Date.now();
  let nbody = {}; try { nbody = JSON.parse(n.body); } catch(e){}
  const noteId = (x)=>String(x.id ?? x.noteId ?? x.NoteId ?? JSON.stringify(x));
  window.__notesById = window.__notesById || {};
  window.__answered  = window.__answered  || {};
  const getNotes = async (cust) => {
    const all = [];
    for (let page=1; page<=5000; page++) {
      let response = null;
      for (let a=0; a<2; a++) {
        try {
          const r = await tfetch(n.url, { method:n.method||"POST", headers:{ ...n.headers, consumerId: CID(cust) },
            body: JSON.stringify({ ...nbody, type:-1, operationType:1, merchantId:null, page, pageSize:200 }) }, 10000);
          if (r.status === 204) return { ok:true, notes:all };
          if (!r.ok) { await new Promise(s=>setTimeout(s,500*(a+1))); continue; }
          response = await r.json(); break;
        } catch(e){ await new Promise(s=>setTimeout(s,500*(a+1))); }
      }
      if (!response) return { ok:false, notes:all };
      const arr = findArr(response);
      if (arr===null) return { ok:false, notes:all };
      if (arr.length && !window.__note_keys) window.__note_keys = Object.keys(arr[0]);
      all.push(...arr.map(x => ({ ...x, __cust: cust })));
      const total = Number(response.total ?? response.totalRecords ?? response.totalRecord ?? NaN);
      const hasMore = response.hasMore ?? response.has_more;
      if (hasMore === false || (Number.isFinite(total) && all.length >= total) || (hasMore == null && arr.length < 200)) {
        return { ok:true, notes:all };
      }
    }
    return { ok:false, notes:all };
  };
  const CONC = ${NOTES_CONC};
  const todo = cs.filter(c => !window.__answered[CID(c)]);
  const before = Object.keys(window.__answered).length;
  let i = 0;
  while (i < todo.length && (Date.now()-start) < ${NOTES_CHUNK_MS}) {
    const batch = todo.slice(i, i + CONC);
    const res = await Promise.all(batch.map(getNotes));
    res.forEach((r,k) => { if (r.ok) { window.__answered[CID(batch[k])] = true; for (const x of r.notes) window.__notesById[noteId(x)] = x; } });
    i += batch.length;
  }
  const answered = Object.keys(window.__answered).length;
  return { done: answered >= cs.length, answered, total: cs.length, notes: Object.keys(window.__notesById).length, newlyAnswered: answered - before, noteKeys: window.__note_keys || null };
})()`;

// --- Phase 3: map one row per note and DOWNLOAD -------------------------------------------------
const MAP_AND_DOWNLOAD = `(async () => {
  const notes = Object.values(window.__notesById || {});
  const j = (v) => (v==null?"":String(v));
  const pick = (o,keys) => { for (const k of keys) if (o[k]!=null && o[k]!=="") return o[k]; return ""; };
  const out = notes.map(nt => { const cu = nt.__cust || {}; return {
    // This account's customers come back in Vagaro's compact storage format:
    //   fn = full name · e = email · c = cell/mobile · d = day/primary phone · n = night phone
    // Fall back to readable field names so other accounts (non-compact) still map.
    clientName:  j(pick(cu, ["fn","fullName","FullName"]) || ((cu.firstName||"") + " " + (cu.lastName||"")).trim()),
    clientEmail: j(pick(cu, ["e","email","emailAddress","Email"])),
    // clientPhone = first non-empty phone: cell -> day -> night (compact), then readable variants.
    clientPhone: j(pick(cu, ["c","d","n","mobilePhone","cellPhone","mobile","phone","phoneNumber","dayPhone","nightPhone","homePhone","workPhone"])),
    noteCreatedDate: j(pick(nt, ["createdDate","CreatedDate","strCreatedDate","dateCreated","createdOn"])),
    noteAuthor:  j(pick(nt, ["addedByName","createdByName","addedBy","author","employeeName"])),
    noteType:    j(pick(nt, ["typeName","type","Type","noteType","NoteType"])),
    note:        j(pick(nt, ["note","Note","description","Description","noteText","NoteText","strNote","noteDescription"])),
  }; });
  const phoneFilled = out.filter(r => r.clientPhone).length;
  const blob = new Blob([JSON.stringify(out, null, 2)], { type:"application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "vagaro_customer_notes.json"; document.body.appendChild(a); a.click();
  return { rows: out.length, phoneFilled, sample: out.slice(0, 2) };
})()`;

/**
 * Factory mirroring createBrowserEvalTool(sh!): returns the agent tool, bound to this session's page.
 * Registered by the runner as `extractAllNotes` when the workflow folder ships a tool.ts.
 */
export function createExtractAllNotesTool(stagehand: Stagehand) {
  return tool({
    description:
      "Extract EVERY customer note in this Vagaro account and download them as a file. Call this ONCE, " +
      "after you have captured both the customers/retrieve request (window.__cReq) and a notes/retrieve " +
      "request (window.__nReq) on this page. It deterministically pulls all customers, replays the notes " +
      "API per customer, dedupes, and triggers the download. Takes no meaningful input.",
    inputSchema: z.object({
      confirm: z
        .boolean()
        .optional()
        .describe(
          "Set true once both window.__cReq and window.__nReq are captured on the current page.",
        ),
    }),
    execute: async () => {
      const page = (await stagehand.browser.context.activePage())!;
      const run = (expr: string, label: string) =>
        withTimeout(page.evaluate(expr), EVAL_TIMEOUT_MS, label) as Promise<
          Record<string, unknown>
        >;

      // Phase 0 — ensure both requests are available. notes/retrieve is the hard requirement; if the
      // page-load customers/retrieve was missed, reconstruct it from the notes request.
      const recon = await run(RECONSTRUCT_CREQ, "reconstruct-creq");
      if (recon.reconstructed)
        log("reconstructed customers/retrieve from notes/retrieve");
      const cap = await run(CHECK_CAPTURE, "check-capture");
      if (!cap.nReq) {
        return {
          success: false,
          error:
            "Capture incomplete — notes/retrieve (window.__nReq) was not captured. Install the " +
            "interceptor, then open ONE customer's Notes tab to fire notes/retrieve, then call again.",
        };
      }
      if (!cap.cReq) {
        return {
          success: false,
          error:
            "Could not obtain customers/retrieve (window.__cReq) or reconstruct it from notes/retrieve.",
        };
      }

      // Phase 1 — pull every customer (looped until done, with a hard deadline so it can't spin).
      let cust: Record<string, unknown> = {};
      const custDeadline = Date.now() + 3 * 60_000;
      for (
        let pass = 0;
        pass < MAX_CUST_PASSES && Date.now() < custDeadline;
        pass++
      ) {
        cust = await run(PULL_CUSTOMERS, "pull-customers");
        if (cust.error)
          return { success: false, error: `pull-customers: ${cust.error}` };
        log(
          `customers pulled: ${cust.customers}${cust.total ? `/${cust.total}` : ""}` +
            (cust.dbg ? `  dbg=${JSON.stringify(cust.dbg)}` : ""),
        );
        if (cust.done) break;
      }
      const customers = Number(cust.customers ?? 0);
      if (!customers) {
        return {
          success: false,
          error: `pulled 0 customers — replay of customers/retrieve returned nothing. dbg=${JSON.stringify(cust.dbg ?? null)}`,
        };
      }
      const customerEnumerationComplete = cust.done === true;
      log(`customer pull complete: ${customers} customers`);

      // Phase 2 — replay notes until every customer is answered, a stall, or the deadline. The
      // deadline is the hard backstop: a run can never grind indefinitely (the old hang).
      let notes: Record<string, unknown> = {};
      let stalled = 0;
      let timedOut = false;
      const deadline = Date.now() + NOTES_DEADLINE_MS;
      for (let pass = 0; pass < MAX_NOTES_PASSES; pass++) {
        if (Date.now() >= deadline) {
          timedOut = true;
          log(
            `notes replay hit ${NOTES_DEADLINE_MS / 60000}min deadline — downloading partial`,
          );
          break;
        }
        notes = await run(REPLAY_NOTES, "replay-notes");
        if (notes.error)
          return { success: false, error: `replay-notes: ${notes.error}` };
        const newly = Number(notes.newlyAnswered ?? 0);
        log(
          `pass ${pass + 1}: answered ${notes.answered}/${notes.total}  notes ${notes.notes}  (+${newly} this pass)` +
            (notes.noteKeys
              ? `  noteKeys=${JSON.stringify(notes.noteKeys)}`
              : ""),
        );
        if (notes.done) break;
        if (newly < NOTES_MIN_PROGRESS) {
          if (++stalled >= NOTES_STALL_LIMIT) {
            log(
              `stalled (${stalled} low-progress passes) — ${Number(notes.total) - Number(notes.answered)} customers persistently erroring`,
            );
            break;
          }
        } else {
          stalled = 0;
        }
      }

      // Phase 3 — map + download (always runs, even on partial, so no work is thrown away).
      const dl = await run(MAP_AND_DOWNLOAD, "map-download");
      if (dl.error)
        return { success: false, error: `map-download: ${dl.error}` };
      log(`downloaded ${dl.rows} notes (${dl.phoneFilled} with phone)`);

      const answered = Number(notes.answered ?? 0);
      const unanswered = customers - answered;
      const complete = customerEnumerationComplete && answered >= customers && !timedOut;
      return {
        success: true,
        complete,
        customers,
        answered,
        unanswered,
        customerEnumerationComplete,
        reportedCustomerTotal: cust.total ?? null,
        timedOut,
        notesDownloaded: Number(dl.rows ?? 0),
        phoneFilled: Number(dl.phoneFilled ?? 0),
        sample: dl.sample,
        note: complete
          ? "customer enumeration complete and every customer answered"
          : !customerEnumerationComplete
            ? `customer enumeration stopped early at ${customers}${cust.total ? `/${cust.total}` : ""}; downloaded partial data.`
          : timedOut
            ? `hit time deadline; ${unanswered} customer(s) not yet answered (downloaded partial).`
            : `${unanswered} customer(s) persistently errored and were skipped.`,
      };
    },
  });
}
