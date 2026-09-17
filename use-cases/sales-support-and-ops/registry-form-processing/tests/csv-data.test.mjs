import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const csv=require(process.env.FAST_CSV_MODULE_PATH || 'fast-csv');
const root=new URL('../',import.meta.url);
const scope=vm.createContext({parseString:csv.parseString,writeToString:csv.writeToString});
const source=fs.readFileSync(new URL('csv-data.ts',root),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
vm.runInContext(stripTypeScriptTypes(source)+'\nglobalThis.parse=parseLookupInput;globalThis.write=tableCsv;',scope);
const plain=value=>JSON.parse(JSON.stringify(value));
test('quoted commas, quotes, multiline and Unicode input preserve exact values',async()=>{
 const value=await scope.parse('\uFEFFName,Notes,Empty\r\n"Example, Inc.","Line 1\nLine 2 ""quoted"" 日本",\r\n');
 assert.deepEqual(plain(value),{Name:'Example, Inc.',Notes:'Line 1\nLine 2 "quoted" 日本',Empty:''});
});
test('writer follows columns rather than object insertion order and roundtrips',async()=>{
 const output=await scope.write(['Name','Notes'],[{Notes:'A\r\nB "quoted"',Name:'Example, Inc.'}]);
 assert.deepEqual(plain(await scope.parse(output)),{Name:'Example, Inc.',Notes:'A\r\nB "quoted"'});
});
test('empty fields and whitespace remain data',async()=>{
 assert.deepEqual(plain(await scope.parse('A,B,C\r\n,  ,\r\n')),{A:'',B:'  ',C:''});
 assert.deepEqual(plain(await scope.parse(await scope.write(['A'],[{A:''}]))),{A:''});
});
test('empty result writes a valid quoted header',async()=>{
 assert.equal(await scope.write(['Name, full','Notes'],[]),'"Name, full","Notes"\r\n');
});
for(const input of ['', 'Name\n', 'Name,Name\na,b\n', ',Name\na,b\n', 'A,B\nx\n', 'A\nx,y\n','A\nx\ny\n','A\n"unclosed'])test(`invalid or ambiguous input rejects: ${JSON.stringify(input)}`,async()=>{
 await assert.rejects(scope.parse(input));
});
for(const rows of [[{}],[{Name:1}],null])test('output rejects missing or non-string cells',async()=>{await assert.rejects(scope.write(['Name'],rows));});
test('actual pull_data uses parsed variables and header-ordered quoted output',async()=>{
 const z=require(process.env.ZOD_MODULE_PATH || 'zod').z;
 const dir=await mkdtemp(join(tmpdir(),'cookbook-r190-csv-'));
 try{
  const input=join(dir,'input.csv'),output=join(dir,'output.csv');
  await writeFile(input,'Name,Note\r\n"Example, Inc.","first\nsecond"\r\n');
  const acts=[];let extracted=0,navigated=0;
  const subject=vm.createContext({fs,z,parseLookupInput:scope.parse,tableCsv:scope.write,validateColumns:scope.validateColumns,console:{log(){}}});
  const code=fs.readFileSync(new URL('pull_data.ts',root),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
  vm.runInContext(stripTypeScriptTypes(code)+'\nglobalThis.run=pull_data;',subject);
  await subject.run({page:{goto:async()=>navigated++},stagehand:{act:async(...args)=>acts.push(args),extract:async()=>({data:extracted++===0?{columns:['Name','Note']}:{results:[{Note:'A "quote"\nB',Name:'Example, Inc.'}]}})},url:'https://example.invalid',user_input_csv:input,output_csv:output});
  assert.equal(navigated,1);assert.deepEqual(plain(acts[0][1].variables),{Name:'Example, Inc.',Note:'first\nsecond'});
  assert.deepEqual(plain(await scope.parse(await readFile(output,'utf8'))),{Name:'Example, Inc.',Note:'A "quote"\nB'});
  await writeFile(input,'A\nx\ny\n');
  await assert.rejects(subject.run({page:{goto:async()=>navigated++},stagehand:{},url:'https://example.invalid',user_input_csv:input,output_csv:output}));
  assert.equal(navigated,1,'invalid input fails before navigation');
 }finally{await rm(dir,{recursive:true,force:true});}
});
