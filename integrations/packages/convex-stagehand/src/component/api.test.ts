import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const page = { goto:vi.fn(), snapshot:vi.fn(async()=>({formattedTree:'page'})),url:vi.fn(async()=> 'https://example.com'),screenshot:vi.fn(async()=>new Uint8Array([1])),click:vi.fn(),type:vi.fn(),keyPress:vi.fn(),scroll:vi.fn() };
  const browser = {sessionId:'session',close:vi.fn(),context:{activePage:vi.fn(async()=>page),newPage:vi.fn(async()=>page)}};
  const stagehand = {close:vi.fn(),rpcClient:{browserWebSocketDebuggerUrl:'wss://test'},act:vi.fn(async()=>({data:{success:true,message:'ok',actions:[],actionDescription:'test'}})),extract:vi.fn(async(_instruction: string, _schema: unknown)=>({data:{name:'Ada'}})),observe:vi.fn(async()=>({data:[]}))};
  return {page,browser,stagehand,launch:vi.fn<() => Promise<import("@browserbasehq/stagehand").StagehandBrowser>>(),connect:vi.fn<() => Promise<import("@browserbasehq/stagehand").StagehandBrowser>>(),create:vi.fn(async(_options: import("@browserbasehq/stagehand").StagehandCreateOptions)=>stagehand),release:vi.fn(),generateText:vi.fn()};
});
vi.mock('@browserbasehq/stagehand',async importOriginal=>({...await importOriginal<typeof import('@browserbasehq/stagehand')>(),browserbase:{launch:mocks.launch,connect:mocks.connect},Stagehand:{create:mocks.create}}));
vi.mock('@browserbasehq/sdk',()=>({default:class {sessions={update:mocks.release}}}));
vi.mock('ai',async importOriginal=>({...await importOriginal<typeof import('ai')>(),generateText:mocks.generateText}));
import {startSession,endSession,act,extract,runBrowserTask} from './api.js';
import { convexTest } from 'convex-test';
import schema from './schema.js';
import { api as componentApi, internal as componentInternal } from './_generated/api.js';
import { localBrowser, StagehandCreateOptionsSchema } from '@browserbasehq/stagehand';
const config={browserbaseApiKey:'test',browserbaseProjectId:'test',modelApiKey:'test'};
class SyntheticWebSocket extends EventTarget {
  static OPEN = 1;
  readyState = 1;
  constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event("open"))); }
  send(raw: string) {
    const message = JSON.parse(raw);
    const result = message.method === "Target.getTargets" ? { targetInfos: [{ targetId: "worker", type: "service_worker", url: "chrome-extension://synthetic/service-worker.js", title: "Synthetic" }] }
      : message.method === "Target.attachToTarget" ? { sessionId: "cdp-session" }
      : message.method === "Runtime.evaluate" ? { result: { value: { marker: { protocolVersion: "1.0.0", serverInfo: { name: "stagehand", version: "4.0.2" } }, hasReceiver: true } } }
      : {};
    queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ id: message.id, result }) })));
  }
  close() { this.readyState = 3; this.dispatchEvent(new Event("close")); }
}
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.create.mockReset().mockResolvedValue(mocks.stagehand);
  vi.stubGlobal("WebSocket", SyntheticWebSocket);
  const connect = async () => {
    const browser = await localBrowser.connect({ cdpUrl: "ws://synthetic.invalid", extensionId: "synthetic" });
    Object.defineProperty(browser, "context", { value: mocks.browser.context });
    Object.defineProperty(browser, "sessionId", { value: "session" });
    const close = browser.close.bind(browser);
    vi.spyOn(browser, "close").mockImplementation(async () => { mocks.browser.close(); await close(); });
    return browser;
  };
  mocks.launch.mockImplementation(connect);
  mocks.connect.mockImplementation(connect);
});
afterEach(()=>vi.unstubAllGlobals());
describe('v4 component lifecycle',()=>{
  it('launches persistent browser and disconnects without releasing session',async()=>{
    expect(await startSession(config)).toEqual({sessionId:'session',cdpUrl:'wss://test',available:true});
    expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({keepAlive:true}));
    expect(mocks.browser.close).toHaveBeenCalledOnce();expect(mocks.release).not.toHaveBeenCalled();
  });
  it('accepts the component default payload through the real strict schema',async()=>{
    await expect(startSession(config, {browserbaseSessionID:undefined,browserbaseSessionCreateParams:undefined,model:undefined,domSettleTimeoutMs:undefined,selfHeal:undefined,systemPrompt:undefined,verbose:undefined,experimental:undefined})).resolves.toMatchObject({available:true});
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it('runs the actual Convex start action through the real strict Stagehand schema',async()=>{
    const t = convexTest(schema, import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]));
    await expect(t.action(componentApi.lib.startSession, {...config,url:"https://example.com"})).resolves.toMatchObject({sessionId:"session"});
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.page.goto).toHaveBeenCalledWith("https://example.com", expect.any(Object));
    const options = mocks.create.mock.calls[0]?.[0];
    expect(() => StagehandCreateOptionsSchema.parse({...options,browserbaseSessionCreateParams:undefined})).toThrow();
    expect(() => StagehandCreateOptionsSchema.parse({...options,browser:mocks.browser})).toThrow();
  });
  it('separates browser launch fields and maps supported client options',async()=>{
    await startSession(config,{browserbaseSessionCreateParams:{region:"eu-central-1"},selfHeal:false,domSettleTimeoutMs:100,systemPrompt:"Synthetic prompt",verbose:2});
    expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({region:"eu-central-1"}));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({selfHeal:false,domSettleTimeoutMs:100,systemPrompt:"Synthetic prompt",logging:{level:"debug",format:"pretty"}}));
    expect(mocks.create.mock.calls[0]?.[0]).not.toHaveProperty("browserbaseSessionCreateParams");
    expect(mocks.create.mock.calls[0]?.[0]).not.toHaveProperty("verbose");
  });
  it('rejects unsupported or invalid client options before allocating a browser',async()=>{
    await expect(startSession(config,{experimental:true})).rejects.toThrow("not supported");
    await expect(startSession(config,{domSettleTimeoutMs:-1})).rejects.toThrow();
    expect(mocks.launch).not.toHaveBeenCalled();
  });
  it('unwraps data and reconnects for each action',async()=>{
    expect((await act('session','click',config)).result.success).toBe(true);
    expect(mocks.connect).toHaveBeenCalledWith({apiKey:'test',sessionId:'session'});
    expect(mocks.stagehand.close).toHaveBeenCalledOnce();expect(mocks.browser.close).toHaveBeenCalledOnce();
  });
  it('closes browser when initialization fails',async()=>{
    mocks.create.mockRejectedValueOnce(new Error('init failed'));
    await expect(act('session','click',config)).rejects.toThrow('init failed');expect(mocks.browser.close).toHaveBeenCalledOnce();
  });
  it('converts serialized JSON Schema into an actual Zod schema',async()=>{
    expect((await extract('session','read',{type:'object',properties:{name:{type:'string'}},required:['name']},config)).result).toEqual({name:'Ada'});
    const schema=mocks.stagehand.extract.mock.calls[0]?.[1];
    expect(schema).toBeDefined();
  });
  it('explicitly releases ended sessions',async()=>{await endSession('session',config);expect(mocks.release).toHaveBeenCalledWith('session',{projectId:'test',status:'REQUEST_RELEASE'});});
  it('supports multiple browser tool steps and explicit verified completion',async()=>{
    mocks.generateText.mockImplementationOnce(async options=>{
      await options.tools.inspect.execute({});await options.tools.act.execute({instruction:'click'});
      await options.tools.finish.execute({success:true,summary:'verified'});
      return {text:'verified',totalUsage:{inputTokens:5,outputTokens:3}};
    });
    expect((await runBrowserTask('session',{}, {instruction:'task'},config)).result.completed).toBe(true);
    expect(mocks.stagehand.act).toHaveBeenCalledOnce();expect(mocks.browser.close).toHaveBeenCalledOnce();
  });
  it('releases a newly launched session if initialization fails',async()=>{
    mocks.create.mockRejectedValueOnce(new Error('init failed'));
    await expect(startSession(config)).rejects.toThrow('init failed');expect(mocks.release).toHaveBeenCalledOnce();
  });
  it('provides real screenshot and pointer tools in CUA mode',async()=>{
    mocks.generateText.mockImplementationOnce(async options=>{
      expect(options.tools.inspect).toBeUndefined();
      expect(await options.tools.screenshot.execute({})).toBe('AQ==');
      await options.tools.click.execute({x:1,y:2});
      return {text:'unfinished',totalUsage:{}};
    });
    expect((await runBrowserTask('session',{mode:'cua'}, {instruction:'task'},config)).result.success).toBe(false);
    expect(mocks.page.click).toHaveBeenCalledWith(1,2);
  });
  it('rejects removed trace cache explicitly',async()=>{await expect(runBrowserTask('session',{}, {instruction:'task'},config,true)).rejects.toThrow('caching was removed');});
});

describe("persistent session settings", () => {
  it("restores settings through actual Convex storage and all reconnecting operations", async () => {
    const t = convexTest(schema, import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]));
    const settings = {systemPrompt: "Synthetic session instruction", selfHeal: false, domSettleTimeoutMs: 123, verbose: 0};
    await t.action(componentApi.lib.startSession, {...config, url: "https://example.com", options: settings});
    const stored = await t.run(async ctx => ctx.db.query("sessions").first());
    expect(stored?.settings).toEqual(settings);
    expect(stored).not.toHaveProperty("modelApiKey");
    expect(stored).not.toHaveProperty("browserbaseApiKey");
    expect(stored?.settings).not.toHaveProperty("model");
    for (const call of mocks.create.mock.calls) {
      expect(call[0]).toMatchObject({systemPrompt: settings.systemPrompt, selfHeal: false, domSettleTimeoutMs: 123, logging: {level: "off"}});
    }
    const args = {...config, sessionId: "session", sessionConfig: {systemPrompt: "Conflicting caller default", selfHeal: true}};
    await t.action(componentApi.lib.act, {...args, action: "test"});
    await t.action(componentApi.lib.extract, {...args, instruction: "test", schema: {type: "object", properties: {name: {type: "string"}}}});
    await t.action(componentApi.lib.observe, {...args, instruction: "test"});
    mocks.generateText.mockResolvedValueOnce({text: "unfinished", totalUsage: {}});
    await t.action(componentApi.lib.agent, {...args, instruction: "test"});
    expect(mocks.create).toHaveBeenCalledTimes(6);
    for (const call of mocks.create.mock.calls) {
      expect(call[0]).toMatchObject({systemPrompt: settings.systemPrompt, selfHeal: false, domSettleTimeoutMs: 123, logging: {level: "off"}});
    }
    await t.action(componentApi.lib.endSession, {...config, sessionId: "session"});
    expect((await t.run(async ctx => ctx.db.query("sessions").first()))?.settings).toEqual(settings);
  });
  it("uses caller settings for preexisting sessions without stored settings", async () => {
    const t = convexTest(schema, import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]));
    await t.action(componentApi.lib.act, {...config, sessionId: "old-session", action: "test", sessionConfig: {selfHeal: false, systemPrompt: "Legacy caller"}});
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({selfHeal: false, systemPrompt: "Legacy caller"}));
  });
});

it("rejects credential fields at the stored-settings validator", async () => {
  const t = convexTest(schema, import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]));
  await expect(t.mutation(componentInternal.metadata.upsertSessionMetadata, {
    sessionId: "synthetic",
    settings: {modelApiKey: "synthetic-credential"},
  })).rejects.toThrow();
  expect(await t.run(async ctx => ctx.db.query("sessions").collect())).toEqual([]);
});
