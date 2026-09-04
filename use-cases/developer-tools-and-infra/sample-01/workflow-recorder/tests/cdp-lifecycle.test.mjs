import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
const source = await readFile(new URL('../scripts/cdp.mjs', import.meta.url), 'utf8');
function fixture() {
  let socket;
  const timers = new Map();
  let nextTimer = 0;
  class Socket extends EventEmitter {
    constructor() { super(); socket = this; this.sent = []; }
    send(message, callback) { if (this.throwSend) throw new Error('send failed'); this.sent.push(JSON.parse(message)); if (this.callbackError) callback(new Error('send failed')); }
    terminate() { this.terminated = true; this.emit('close'); }
  }
  const context = vm.createContext({ WebSocket: Socket, setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
  vm.runInContext(source.replace('import { WebSocket } from "ws";', '').replaceAll('export ', ''), context);
  const client = context.makeCdpClient('wss://synthetic.invalid', { timeoutMs: 10 });
  return { client, socket, timers, expire: () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } } };
}
for (const event of ['close', 'error']) {
  test(`${event} rejects every pending command and blocks future sends`, async () => {
    const { client, socket, timers } = fixture(); socket.emit('open'); await client.opened;
    const first = assert.rejects(client.send('Page.enable'), /connection ended/);
    const second = assert.rejects(client.send('Runtime.enable'), /connection ended/);
    socket.emit(event, new Error('synthetic'));
    await Promise.all([first, second]);
    assert.equal((await client.closed).reason, event === 'close' ? 'socket-closed' : 'socket-error');
    assert.equal(timers.size, 0);
    await assert.rejects(client.send('Page.enable'), /not open/);
  });
}
test('closure before opening settles both lifecycle promises', async () => {
  const { client, socket, timers } = fixture();
  const rejection = assert.rejects(client.opened, /connection ended/);
  socket.emit('close'); await rejection; await client.closed;
  assert.equal(timers.size, 0);
});
test('opening and command timeouts settle and clean up', async () => {
  const unopened = fixture(); const rejection = assert.rejects(unopened.client.opened, /connection-timeout/);
  unopened.expire(); await rejection; await unopened.client.closed;
  assert.equal(unopened.socket.terminated, true);
  const f = fixture(); f.socket.emit('open'); await f.client.opened;
  const timeout = assert.rejects(f.client.send('Page.enable'), /command timed out/);
  f.expire(); await timeout; assert.equal(f.timers.size, 0); f.client.close();
});
test('responses clear deadlines and preserve session command payloads', async () => {
  const f = fixture(); f.socket.emit('open'); await f.client.opened;
  const result = f.client.send('Page.enable', {}, 'synthetic-session');
  assert.equal(f.socket.sent[0].sessionId, 'synthetic-session');
  f.socket.emit('message', JSON.stringify({ id: 1, result: { ok: true } }));
  assert.equal((await result).ok, true); assert.equal(f.timers.size, 0); f.client.close();
});
for (const mode of ['throwSend', 'callbackError']) {
  test(`${mode} rejects the command without a dangling deadline`, async () => {
    const f = fixture(); f.socket.emit('open'); await f.client.opened; f.socket[mode] = true;
    await assert.rejects(f.client.send('Page.enable'), /send failed/); assert.equal(f.timers.size, 0); f.client.close();
  });
}
test('intentional client close settles pending work once', async () => {
  const f = fixture(); f.socket.emit('open'); await f.client.opened;
  const rejection = assert.rejects(f.client.send('Page.enable'), /client-closed/);
  f.client.close(); f.client.close(); await rejection;
  assert.equal((await f.client.closed).reason, 'client-closed'); assert.equal(f.timers.size, 0);
});

const recorder = await readFile(new URL('../scripts/record-bb.mjs', import.meta.url), 'utf8');
for (const interrupted of [false, true]) {
  test(`recorder records ${interrupted ? 'interrupted' : 'normal'} stop and releases once`, async () => {
    const process = new EventEmitter(); process.execPath = 'synthetic-node';
    let resolveClosed; const closed = new Promise(resolve => { resolveClosed = resolve; });
    const writes = []; let releases = 0; let closes = 0;
    const context = vm.createContext({ process, client: { closed, close() { closes++; resolveClosed({ reason: 'client-closed' }); } }, stopping: false, console: { log() {}, error() {} }, eventsWritten: 3, rawFd: 123, runDir: '/synthetic', rawNdjsonPath: '/synthetic/raw', runId: 'synthetic', __dirname: '/synthetic', releaseSession() { releases++; }, spawnSync: () => ({ status: 0 }), setTimeout: fn => { fn(); }, path: { join: (...parts) => parts.join('/') }, fs: { closeSync() {}, readFileSync: () => '{}', writeFileSync: (file, body) => writes.push(JSON.parse(body)), statSync: () => ({ size: 10 }) } });
    const begin = recorder.indexOf('await new Promise((resolve) => {');
    const end = recorder.indexOf('// ── helpers', begin);
    const promise = vm.runInContext(`(async () => { ${recorder.slice(begin, end)} })()`, context);
    if (interrupted) resolveClosed({ reason: 'socket-closed' }); else process.emit('SIGINT');
    await promise;
    assert.equal(writes[0].capture_status, interrupted ? 'interrupted' : 'stopped');
    assert.equal(process.exitCode, interrupted ? 1 : undefined);
    assert.equal(releases, 1); assert.equal(closes, 1);
    assert.equal(process.listenerCount('SIGINT'), 0); assert.equal(process.listenerCount('SIGTERM'), 0);
  });
}
test('cleanup is registered before initialization and releases at most once', () => {
  const process = new EventEmitter(); let releases = 0;
  const early = recorder.slice(recorder.indexOf('let stopping = false;'), recorder.indexOf('// ── 2.'));
  const release = recorder.slice(recorder.indexOf('function releaseSession()'), recorder.indexOf('await new Promise((resolve) => {'));
  const context = vm.createContext({ process, sessionId: 'synthetic', fs: { closeSync() {} }, console: { log() {}, error() {} }, spawnSync: () => { releases++; return { status: 0 }; } });
  vm.runInContext(early + release, context);
  process.emit('exit');
  vm.runInContext('releaseSession()', context);
  assert.equal(releases, 1);
});
