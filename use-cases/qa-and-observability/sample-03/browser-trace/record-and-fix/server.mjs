// Control server for the AppBuilder × Browserbase "show, don't prompt" demo.
// Owns one Browserbase session shown via live-view iframe in the shell UI.
//   node --env-file=../.env server.mjs   (from app_builder-demo/)  -> http://localhost:4321
import http from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { BUGGY_HTML, FIXED_HTML, dataUrl } from './apps.mjs';
import { createAccessControl, createAccessToken } from './access.mjs';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4321;
const HOST = '127.0.0.1';
const ACCESS_TOKEN = process.env.DEMO_ACCESS_TOKEN || createAccessToken();
const OWNER_COOKIE = 'browser_trace_owner';
const access = createAccessControl({ token: ACCESS_TOKEN, host: HOST, port: PORT, cookieName: OWNER_COOKIE });
// Point the preview at a real app (tunnel/staging URL) instead of the demo TaskFlow.
// APP_URL = the buggy build the user records against; FIX_URL = optional "fixed" build to swap to.
const APP_URL = process.env.APP_URL || null;
const FIX_URL = process.env.FIX_URL || null;
const inject = readFileSync(new URL('./inject.js', import.meta.url), 'utf8');
const SHELL_PATH = new URL('./shell.html', import.meta.url);   // read per-request so edits show on reload

// ---- Browserbase session ----
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
const session = await bb.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  // larger viewport => the live view streams at higher resolution (crisper in the iframe)
  browserSettings: {
    viewport: {
      width: process.env.VW ? parseInt(process.env.VW, 10) : 1920,
      height: process.env.VH ? parseInt(process.env.VH, 10) : 1080,
    },
  },
});
const browser = await chromium.connectOverCDP(session.connectUrl);
const context = browser.contexts()[0];
const page = context.pages()[0] ?? (await context.newPage());
await context.addInitScript({ content: inject });
await page.goto(APP_URL || dataUrl(BUGGY_HTML), { waitUntil: 'domcontentloaded' });

let liveUrl = '';
try { liveUrl = (await bb.sessions.debug(session.id)).debuggerFullscreenUrl; } catch (e) { console.error(e); }
console.log(`\n  Live view:  ${liveUrl}\n`);

// ---- recording buffer (poll + drain; exposeBinding doesn't work over BB CDP) ----
let events = [];
let notes = [];        // {kind:'voice'|'note', text, ts} from the user during recording
let recording = false;
let recordingId = 0;
let pollPromise = Promise.resolve();
let lastBundle = null;
const seenEventIds = new Set();

async function drainPages(targetRecordingId, collect) {
  for (const p of context.pages()) {
    try {
      const evs = await p.evaluate(() => window.__rr_drain ? window.__rr_drain() : (() => {
        const e = window.__rr_events || []; window.__rr_events = []; return e;
      })());
      if (!collect || targetRecordingId !== recordingId || !Array.isArray(evs)) continue;
      for (const event of evs) {
        const id = event?.id;
        if (id && seenEventIds.has(id)) continue;
        if (id) seenEventIds.add(id);
        events.push(event);
      }
    } catch (_) {}
  }
}
setInterval(() => {
  if (!recording) return;
  const target = recordingId;
  // Capture collection intent now. A stop waits for this promise, so a queued
  // poll still belongs to the recording that scheduled it.
  pollPromise = pollPromise.then(() => drainPages(target, target === recordingId));
}, 500);

// turn raw browser events into timeline items {kind:'action', icon, text, ts}
function summarizeActions(evs) {
  const label = (e) => {
    const flat = (e.selectors || []).map((g) => g[0]);
    const t = flat.find((s) => s.startsWith('text/'));
    const a = flat.find((s) => s.startsWith('aria/'));
    const id = flat.find((s) => s.startsWith('#'));
    return (t && t.slice(5)) || (a && a.slice(5)) || (id || 'element');
  };
  return evs.filter((e) => e.type !== 'scroll').map((e) => {
    let icon = '•', text = e.type;
    if (e.type === 'change') { icon = '⌨️'; text = `Typed “${e.value}” into ${label(e)}`; }
    else if (e.type === 'click') { icon = '🖱️'; text = `Clicked ${label(e)}`; }
    else if (e.type === 'keyDown') { icon = '⏎'; text = `Pressed ${e.key}`; }
    return { kind: 'action', icon, text, ts: e.ts || 0 };
  });
}

// merge browser actions + user notes/voice into one time-ordered timeline
function buildTimeline() {
  const noteItems = notes.map((n) => ({
    kind: n.kind, icon: n.kind === 'voice' ? '🗣️' : '📝', text: n.text, ts: n.ts || 0,
  }));
  return [...summarizeActions(events), ...noteItems].sort((a, b) => a.ts - b.ts);
}

// ---- map recorded element + route -> source code (we have the repo) ----
const REPO_ROOT = process.env.REPO_ROOT || new URL('../../ui-debug-bench/targets/bench', import.meta.url).pathname;
function findFile(root, filename, depth = 7) {
  let found = null;
  (function walk(dir, d) {
    if (found || d < 0) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (found) return;
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = dir + '/' + e.name;
      if (e.isDirectory()) walk(p, d - 1);
      else if (e.name === filename) found = p;
    }
  })(root, depth);
  return found;
}
function resolveCode(appUrl, evs) {
  try {
    if (!appUrl) return null;
    const route = new URL(appUrl).pathname.replace(/\/$/, '').split('/').pop() || 'index';
    const file = findFile(REPO_ROOT, route + '.tsx') || findFile(REPO_ROOT, route + '.jsx');
    if (!file) return null;
    const lines = readFileSync(file, 'utf8').split('\n');
    const tokens = new Set();
    for (const e of evs) {
      if (e.el && e.el.data) for (const k in e.el.data) tokens.add(String(e.el.data[k]));
      if (e.name) tokens.add(e.name);
    }
    if (tokens.size === 0) return null;   // nothing was interacted with -> no code anchor
    let anchor = -1, handler = null;
    for (const t of tokens) {
      if (!t) continue;
      const idx = lines.findIndex((l) => l.includes(t));
      if (idx >= 0) {
        anchor = idx;
        for (let i = Math.max(0, idx - 6); i < Math.min(lines.length, idx + 6); i++) {
          const m = lines[i].match(/on[A-Z]\w+=\{(\w+)\}/);
          if (m) { handler = m[1]; break; }
        }
        if (handler) break;
      }
    }
    let snippet, startLine;
    if (handler) {
      const hidx = lines.findIndex((l) => new RegExp('(const|function)\\s+' + handler + '\\b').test(l));
      if (hidx >= 0) { startLine = hidx + 1; snippet = lines.slice(hidx, Math.min(lines.length, hidx + 6)).join('\n'); }
    }
    if (anchor < 0) return null;
    if (!snippet) {
      const s = Math.max(0, anchor - 4);
      startLine = s + 1; snippet = lines.slice(s, s + 16).join('\n');
    }
    return { file: file.replace(REPO_ROOT + '/', ''), route, handler, startLine, snippet,
      matchedToken: [...tokens].find((token) => token && lines[anchor].includes(token)) || null,
      match: handler ? 'element token + nearby handler' : 'element token' };
  } catch { return null; }
}

// read a JSON POST body
function readJson(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}
// read a raw binary POST body (audio)
function readBuffer(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
// transcribe an audio buffer via Whisper. Prefers Groq (free/fast), falls back to
// OpenAI — both are OpenAI-compatible endpoints. Returns { text, segments:[{text,start}] }.
function transcriptionProvider() {
  if (process.env.GROQ_API_KEY) return { url: 'https://api.groq.com/openai/v1/audio/transcriptions', key: process.env.GROQ_API_KEY, model: 'whisper-large-v3' };
  if (process.env.OPENAI_API_KEY) return { url: 'https://api.openai.com/v1/audio/transcriptions', key: process.env.OPENAI_API_KEY, model: 'whisper-1' };
  return null;
}
async function whisper(buf, mime) {
  const p = transcriptionProvider();
  if (!p) throw new Error('no transcription key (set GROQ_API_KEY or OPENAI_API_KEY)');
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime || 'audio/webm' }), 'audio.webm');
  form.append('model', p.model);
  form.append('response_format', 'verbose_json');
  const r = await fetch(p.url, { method: 'POST', headers: { Authorization: 'Bearer ' + p.key }, body: form });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'transcription error');
  return { text: j.text || '', segments: j.segments || [] };
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function requireMethod(req, res, method) {
  if (req.method === method) return true;
  send(res, 405, { error: `method must be ${method}` });
  return false;
}

async function beginRecording() {
  recording = false;
  await pollPromise;
  await drainPages(recordingId, false);
  events = []; notes = []; seenEventIds.clear(); lastBundle = null;
  recordingId += 1;
  recording = true;
}
async function finishRecording() {
  if (!recording && lastBundle) return lastBundle;
  const target = recordingId;
  recording = false;
  await pollPromise;
  await drainPages(target, true);
  const timeline = buildTimeline();
  const code = resolveCode(APP_URL, events);
  const elements = events.filter((e) => e.el).map((e) => ({ type: e.type, name: e.name, role: e.role, value: e.value, el: e.el }));
  const voiceText = notes.filter((n) => n.kind === 'voice').map((n) => n.text).join(' ');
  const noteText = notes.filter((n) => n.kind === 'note').map((n) => n.text).join(' | ');
  lastBundle = { count: timeline.length, timeline, actions: events.length, notes: notes.length, code, elements, voiceText, noteText };
  return lastBundle;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/' && access.tokenMatches(url.searchParams.get('token'))) {
      res.writeHead(303, { location: '/', 'set-cookie': access.ownerCookie });
      return res.end();
    }
    if (!access.authorized(req)) return send(res, 401, { error: 'unauthorized' });
    if (req.method === 'POST' && !access.sameOrigin(req)) return send(res, 403, { error: 'origin rejected' });
    if (url.pathname === '/') return send(res, 200, readFileSync(SHELL_PATH, 'utf8'), 'text/html');
    if (url.pathname === '/api/live') return send(res, 200, { liveUrl });
    if (url.pathname === '/api/config') return send(res, 200, { recordOnly: !!process.env.RECORD_ONLY, appUrl: APP_URL, appName: process.env.APP_NAME || 'your app' });
    if (url.pathname === '/api/record/start') {
      if (!requireMethod(req, res, 'POST')) return;
      await beginRecording();
      return send(res, 200, { ok: true, recordingId });
    }
    if (url.pathname === '/api/note') {
      if (!requireMethod(req, res, 'POST')) return;
      const body = await readJson(req);
      if (body.text && body.text.trim()) notes.push({ kind: body.kind === 'voice' ? 'voice' : 'note', text: body.text.trim(), ts: body.ts || Date.now() });
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/transcribe') {
      if (!requireMethod(req, res, 'POST')) return;
      const recStart = parseInt(url.searchParams.get('recStart') || '0', 10) || Date.now();
      const mime = url.searchParams.get('mime') || 'audio/webm';
      const buf = await readBuffer(req);
      if (!transcriptionProvider()) return send(res, 200, { ok: false, error: 'no transcription key' });
      try {
        const { text, segments } = await whisper(buf, mime);
        // interleave: each spoken segment becomes a voice note at its real moment
        if (segments.length) segments.forEach((s) => { const t = (s.text || '').trim(); if (t) notes.push({ kind: 'voice', text: t, ts: recStart + Math.round((s.start || 0) * 1000) }); });
        else if (text.trim()) notes.push({ kind: 'voice', text: text.trim(), ts: recStart });
        return send(res, 200, { ok: true, text, segments: segments.length });
      } catch (e) { return send(res, 200, { ok: false, error: String(e).slice(0, 200) }); }
    }
    if (url.pathname === '/api/record/stop') {
      if (!requireMethod(req, res, 'POST')) return;
      return send(res, 200, await finishRecording());
    }
    if (url.pathname === '/api/fix') { if (!requireMethod(req, res, 'POST')) return; await page.goto(FIX_URL || dataUrl(FIXED_HTML), { waitUntil: 'domcontentloaded' }); return send(res, 200, { ok: true }); }
    if (url.pathname === '/api/reload') { if (!requireMethod(req, res, 'POST')) return; await page.reload({ waitUntil: 'domcontentloaded' }); return send(res, 200, { ok: true }); }
    if (url.pathname === '/api/seed') {
      if (!requireMethod(req, res, 'POST')) return;
      // type a couple tasks on the server's own page (proves the fix in the preview)
      for (const t of ['Buy milk', 'Ship the demo']) {
        await page.fill('#new-task', t); await page.click('#add-btn'); await page.waitForTimeout(250);
      }
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/reset') { if (!requireMethod(req, res, 'POST')) return; await page.goto(dataUrl(BUGGY_HTML), { waitUntil: 'domcontentloaded' }); return send(res, 200, { ok: true }); }
    if (url.pathname === '/api/shot') { const buf = await page.screenshot(); return send(res, 200, buf, 'image/png'); }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: String(e).slice(0, 200) });
  }
});
server.listen(PORT, HOST);
console.log(`  Open:       http://${HOST}:${PORT}/?token=${encodeURIComponent(ACCESS_TOKEN)}\n`);
