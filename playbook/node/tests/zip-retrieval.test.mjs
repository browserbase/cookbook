import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const JSZip=createRequire(import.meta.url)('jszip');
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../playwright/_tools/download/cloud-download-retrieve.ts',import.meta.url),'utf8')).replace(/^import[^;]+;/gm,'').replace(/^export /gm,'');
async function zip(entries){const z=new JSZip();for(const [name,value,options] of entries)z.file(name,value,options);return z.generateAsync({type:'nodebuffer',compression:'STORE',platform:'UNIX'});}
async function run(bytes,change={}){
 const previous=process.cwd(),dir=fs.mkdtempSync(path.join(tmpdir(),'r149-zip-'));let fetches=0;const logs=[];
 try{process.chdir(dir);if(change.existing){fs.mkdirSync('downloads/files',{recursive:true});fs.writeFileSync('downloads/files/fixture.txt','existing');}if(change.symlink){fs.mkdirSync('elsewhere');fs.mkdirSync('downloads');fs.symlinkSync(path.join(dir,'elsewhere'),'downloads/files');}
 const context=vm.createContext({...fs,...path,path,JSZip,Buffer,URL,AbortSignal,Error,process:{env:{BROWSERBASE_API_KEY:'fixture-key',BROWSERBASE_SESSION_ID:'fixture-session',...change.env},cwd:()=>dir},console:{log:(...v)=>logs.push(v.join(' ')),error(){}},dotenv:{config(){}},fetch:async(url,options)=>{fetches++;return {ok:!change.httpError,status:change.httpError?401:200,arrayBuffer:async()=>bytes};}});
 const start=source.lastIndexOf('\nmain(');
 if(start>=0){vm.runInContext(source.slice(0,start)+'\nglobalThis.done='+source.slice(start+1),context);await context.done;}else{await vm.runInContext('(async()=>{'+source+'})()',context).catch(()=>{});}
 const target='downloads/files/fixture.txt';return {fetches,exit:context.process.exitCode,logs,data:fs.existsSync(target)?fs.readFileSync(target,'utf8'):null};
 }finally{process.chdir(previous);fs.rmSync(dir,{recursive:true,force:true});}
}
test('skips directory entries and saves nested regular file in created destination',async()=>{const r=await run(await zip([['folder/','',{dir:true}],['folder/fixture.txt','payload']]));assert.notEqual(r.exit,1);assert.equal(r.data,'payload');});
for(const entries of [[],[['folder/','',{dir:true}]], [['link','target',{unixPermissions:0o120777}]]])test(`empty or nonregular archive rejects ${JSON.stringify(entries)}`,async()=>{const r=await run(await zip(entries));assert.equal(r.exit,1);assert.equal(r.data,null);});
for(const name of ['../fixture.txt','/fixture.txt','folder\\fixture.txt','C:/fixture.txt'])test(`unsafe archive path rejects ${name}`,async()=>{const r=await run(await zip([[name,'payload']]));assert.equal(r.exit,1);assert.equal(r.data,null);});
for(const env of [{BROWSERBASE_SESSION_ID:''},{BROWSERBASE_SESSION_ID:'<session-id>'},{BROWSERBASE_API_KEY:''}])test(`explicit config required ${JSON.stringify(env)}`,async()=>{const r=await run(await zip([['fixture.txt','payload']]),{env});assert.equal(r.exit,1);assert.equal(r.fetches,0);});
for(const change of [{httpError:true},{existing:true},{symlink:true}])test(`failure preserves output ${JSON.stringify(change)}`,async()=>{const r=await run(await zip([['fixture.txt','payload']]),change);assert.equal(r.exit,1);assert.equal(r.data,change.existing?'existing':null);});
test('invalid and corrupt ZIPs reject',async()=>{const bytes=await zip([['fixture.txt','payload']]);bytes[30+'fixture.txt'.length]^=1;for(const data of [Buffer.from('{}'),bytes]){const r=await run(data);assert.equal(r.exit,1);assert.equal(r.data,null);}});
