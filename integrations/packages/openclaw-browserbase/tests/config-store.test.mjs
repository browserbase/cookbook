import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const JSON5 = createRequire(import.meta.url)(process.env.COOKBOOK_JSON5_MODULE || 'json5');
function fixture(t, contents = '{plugins:{entries:{browserbase:{enabled:false,config:{keep:1}}}},other:{value:42}}') {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cookbook-config-test-'));
  t.after(() => fs.rmSync(base, {recursive:true,force:true}));
  const file = path.join(base, 'openclaw.json');
  if (contents !== null) fs.writeFileSync(file, contents);
  const localFs = {...fs};
  const source = fs.readFileSync(process.env.COOKBOOK_R167_BASELINE || new URL('../src/config-store.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  const context = vm.createContext({fs:localFs, os:{homedir:()=>base}, path, JSON5, randomUUID, process:{cwd:()=>base}});
  vm.runInContext(stripTypeScriptTypes(source), context);
  return {file,base,localFs,context,read:()=>JSON5.parse(fs.readFileSync(file,'utf8')),write:()=>context.writePluginConfig(file,'browserbase',{added:'synthetic'})};
}
test('JSON5 syntax reads and updates without losing unrelated values', t => {
  const f=fixture(t, `{// comment\n unquoted:'hello', hex:0xff, nan:NaN, infinity:Infinity, negative:-Infinity, refs:{key:'\u0024{SYNTHETIC_KEY}'}, plugins:{entries:{browserbase:{enabled:false,config:{keep:1,},},other:{config:{value:'kept'}}}},}`);
  assert.equal(f.context.readPluginConfig(f.file,'browserbase').keep,1);
  f.write(); const x=f.read(); assert.equal(x.unquoted,'hello'); assert.equal(x.hex,255); assert.ok(Number.isNaN(x.nan)); assert.equal(x.infinity,Infinity); assert.equal(x.negative,-Infinity); assert.equal(x.refs.key,'${SYNTHETIC_KEY}'); assert.equal(x.plugins.entries.other.config.value,'kept'); assert.equal(x.plugins.entries.browserbase.enabled,false); assert.equal(x.plugins.entries.browserbase.config.keep,1); assert.equal(x.plugins.entries.browserbase.config.added,'synthetic');
});
test('new config is created with restrictive permissions', t=>{const f=fixture(t,null);f.write();assert.equal(fs.statSync(f.file).mode & 0o777,0o600);assert.equal(f.read().plugins.entries.browserbase.enabled,true);});
for(const contents of ['{broken','[]','', '{plugins:[]}','{plugins:{entries:null}}','{plugins:{entries:{browserbase:[]}}}','{plugins:{entries:{browserbase:{config:null}}}}','{plugins:{entries:{browserbase:{enabled:"yes"}}}}']) {
  test(`invalid config stays byte-identical: ${contents}`,t=>{const f=fixture(t,contents);assert.throws(f.write);assert.equal(fs.readFileSync(f.file,'utf8'),contents);assert.deepEqual(fs.readdirSync(f.base),['openclaw.json']);});
}
for(const operation of ['writeFileSync','fsyncSync','renameSync']) test(`${operation} failure preserves original and removes temporary files`,t=>{const f=fixture(t);const before=fs.readFileSync(f.file); f.localFs[operation]=()=>{throw Error('synthetic failure')};assert.throws(f.write,/synthetic failure/);assert.deepEqual(fs.readFileSync(f.file),before);assert.deepEqual(fs.readdirSync(f.base),['openclaw.json']);});
test('external edit before commit is preserved and reported',t=>{const f=fixture(t);f.localFs.fsyncSync=(fd)=>{fs.fsyncSync(fd);fs.writeFileSync(f.file,'{external:true}');};assert.throws(f.write,/changed/);assert.equal(f.read().external,true);assert.deepEqual(fs.readdirSync(f.base),['openclaw.json']);});
test('symlink config cannot modify its destination',t=>{const f=fixture(t);const original=path.join(f.base,'original');fs.renameSync(f.file,original);fs.symlinkSync(original,f.file);const before=fs.readFileSync(original);assert.throws(f.write,/regular file/);assert.deepEqual(fs.readFileSync(original),before);});
test('existing lock is preserved and prevents update',t=>{const f=fixture(t);fs.writeFileSync(f.file+'.browserbase.lock','other writer');assert.throws(f.write);assert.equal(fs.readFileSync(f.file+'.browserbase.lock','utf8'),'other writer');assert.equal(f.read().other.value,42);});
for(const id of ['__proto__','constructor','prototype','']) test(`reserved plugin ID rejected: ${id}`,t=>{const f=fixture(t);assert.throws(()=>f.context.writePluginConfig(f.file,id,{a:1}),/Invalid plugin/);assert.throws(()=>f.context.readPluginConfig(f.file,id),/Invalid plugin/);});
