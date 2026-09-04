import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,mkdir,rm,readFile,realpath} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';
import {resolveBrowseBinary,browseArguments} from '../lib/browse-cli.ts';
const commands=['open','click','type','press','back','get','wait','snapshot','tab:list','tab:switch'];
async function fixture(change,run){const root=await mkdtemp(path.join(os.tmpdir(),'cookbook-browse-contract-'));try{await mkdir(path.join(root,'bin'));const binary=path.join(root,'bin/run.js');await writeFile(binary,'#!/usr/bin/env node\n',{mode:0o700});const pkg={name:'browse',version:'0.9.6',bin:{browse:'bin/run.js'}};const manifest={commands:Object.fromEntries(commands.map(c=>[c,{flags:{session:{},cdp:{}}}]))};manifest.commands.snapshot.flags.full={};manifest.commands.stop={flags:{session:{},force:{}}};change?.(pkg,manifest);await writeFile(path.join(root,'package.json'),JSON.stringify(pkg));await writeFile(path.join(root,'oclif.manifest.json'),JSON.stringify(manifest));await run(binary);}finally{await rm(root,{recursive:true,force:true});}}
test('resolves supported package metadata without executing its entrypoint',()=>fixture(null,async binary=>assert.equal(await resolveBrowseBinary(binary),await realpath(binary))));
for(const [name,change] of [['different package',p=>p.name='unrelated'],['version drift',p=>p.version='0.9.7'],['missing full snapshot',(_p,m)=>delete m.commands.snapshot.flags.full],['missing CDP attachment',(_p,m)=>delete m.commands.open.flags.cdp]])test('rejects '+name,()=>fixture(change,async binary=>await assert.rejects(resolveBrowseBinary(binary))));
test('command builder uses topic commands, named session and explicit endpoint',()=>{assert.deepEqual(browseArguments('tab:list',[],'synthetic','wss://synthetic.invalid/cdp'),['tab','list','--session','synthetic','--cdp','wss://synthetic.invalid/cdp']);assert.deepEqual(browseArguments('snapshot',['--full'],'synthetic','wss://synthetic.invalid/cdp').slice(0,2),['snapshot','--full']);assert.deepEqual(browseArguments('stop',['--force'],'synthetic'),['stop','--force','--session','synthetic']);assert.throws(()=>browseArguments('open',[],'synthetic'));});
const raw=await readFile(new URL('../lib/demo-controller.ts',import.meta.url),'utf8');
test('actual browser startup rejects incompatible CLI before allocating a session',async()=>{let allocated=0;const scope=vm.createContext({resolveBrowseBinary:async()=>{throw Error('incompatible CLI');},Browserbase:class{constructor(){allocated++;}},getBrowserbaseApiKey:()=> 'synthetic',getBrowserbaseProjectId:()=> 'synthetic'});const source=raw.slice(raw.indexOf('async function ensureBrowserRuntime'),raw.indexOf('function getSessionId'));vm.runInContext(stripTypeScriptTypes(source)+'\nglobalThis.start=ensureBrowserRuntime;',scope);await assert.rejects(scope.start({}),/incompatible/);assert.equal(allocated,0);});
test('actual command wrapper passes updated arguments and disables dotenv loading',async()=>{let args,options;const scope=vm.createContext({resolveBrowseBinary:async()=>'/synthetic/browse',browseArguments,process:{env:{}},getAnthropicApiKey:()=>null,getBrowserbaseApiKey:()=>null,getBrowserbaseProjectId:()=>null,BROWSE_STDOUT_MAX_BUFFER:10000,BROWSE_COMMAND_TIMEOUT_MS:30000,execFileAsync:async(_binary,a,o)=>{args=a;options=o;return {stdout:'{"tabs":[]}'};}});const source=raw.slice(raw.indexOf('async function runBrowseCommand'),raw.indexOf('async function ensureBrowseAttached'));vm.runInContext(stripTypeScriptTypes(source)+'\nglobalThis.run=runBrowseCommand;',scope);await scope.run({browserbaseSessionId:'synthetic',browserbaseConnectUrl:'wss://synthetic.invalid/cdp',browseSessionName:'synthetic'},'tab:list');assert.equal(args[0],'tab');assert.ok(!args.includes('--connect'));assert.ok(!args.includes('--json'));assert.equal(options.env.BROWSE_LOAD_DOTENV,'0');});
test('installed CLI metadata supports the documented contract',{skip:!process.env.BROWSE_TEST_BIN},async()=>{assert.ok(await resolveBrowseBinary(process.env.BROWSE_TEST_BIN));});
test('installed tab and full snapshot handlers satisfy actual inspection consumer',{skip:!process.env.BROWSE_TEST_BIN},async()=>{
 const binary=await resolveBrowseBinary(process.env.BROWSE_TEST_BIN),root=path.dirname(path.dirname(binary));
 const {pathToFileURL}=await import('node:url');
 const {tabHandlers}=await import(pathToFileURL(path.join(root,'dist/lib/driver/commands/tabs.js')));
 const {snapshotHandlers}=await import(pathToFileURL(path.join(root,'dist/lib/driver/commands/snapshot.js')));
 const manager={pageSummaries:async()=>[{index:0,url:'https://synthetic.invalid',targetId:'synthetic-target'}],activePage:async()=>({snapshot:async()=>({formattedTree:'button Synthetic',xpathMap:{'@0-1':'//button'},urlMap:{'@0-1':'https://synthetic.invalid/link'}})}),setRefMaps(){}};
 const scope=vm.createContext({runBrowseCommand:async(_session,command,args)=>{
  if(command==='snapshot'){assert.deepEqual(Array.from(args),['--full']);return snapshotHandlers.snapshot(manager,{full:true});}
  if(command==='tab:list')return tabHandlers['tab.list'](manager);
  if(command==='get')return {[args[0]]:args[0]==='url'?'https://synthetic.invalid':'Synthetic'};
  throw Error('Unexpected command '+command);
 }});
 const functions=raw.slice(raw.indexOf('function normalizeStringRecord'),raw.indexOf('async function runBrowseCommand'))+
 raw.slice(raw.indexOf('async function listPages'),raw.indexOf('function isInspectionEmpty'))+
 raw.slice(raw.indexOf('async function inspectBrowserOnce'),raw.indexOf('async function inspectBrowser('));
 vm.runInContext(stripTypeScriptTypes(functions)+'\nglobalThis.inspect=inspectBrowserOnce;',scope);
 const result=await scope.inspect({});assert.equal(result.pages[0].targetId,'synthetic-target');assert.equal(result.xpathMap['@0-1'],'//button');assert.equal(result.urlMap['@0-1'],'https://synthetic.invalid/link');
});
test('child-process errors redact endpoint and API key before surfacing',async()=>{
 const endpoint='wss://synthetic.invalid/?apiKey=synthetic-key';
 const scope=vm.createContext({resolveBrowseBinary:async()=>'/synthetic/browse',browseArguments,process:{env:{}},getAnthropicApiKey:()=>null,getBrowserbaseApiKey:()=> 'synthetic-key',getBrowserbaseProjectId:()=>null,BROWSE_STDOUT_MAX_BUFFER:10000,BROWSE_COMMAND_TIMEOUT_MS:30000,execFileAsync:async()=>{throw Error('failed '+endpoint+' synthetic-key');}});
 const source=raw.slice(raw.indexOf('async function runBrowseCommand'),raw.indexOf('async function ensureBrowseAttached'));
 vm.runInContext(stripTypeScriptTypes(source)+'\nglobalThis.run=runBrowseCommand;',scope);
 await assert.rejects(scope.run({browserbaseSessionId:'synthetic',browserbaseConnectUrl:endpoint,browseSessionName:'synthetic'},'tab:list'),error=>!error.message.includes(endpoint)&&!error.message.includes('synthetic-key')&&error.message.includes('[redacted]'));
});
