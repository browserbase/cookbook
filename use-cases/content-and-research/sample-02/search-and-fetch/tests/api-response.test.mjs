import test from "node:test";
import assert from "node:assert/strict";
import { readApiResponse } from "../api-response.js";
const response = (data, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => data});
test("search rejects transport, API and shape failures while preserving empty success", async () => {
  for (const status of [401, 500]) await assert.rejects(readApiResponse(response({}, status), "search"), new RegExp(`HTTP ${status}`));
  for (const data of [{error: "no"}, {success: false}, {}, {results: null}, {results: [{}]}, {results: [{url:"javascript:bad"}]}]) {
    await assert.rejects(readApiResponse(response(data), "search"));
  }
  assert.deepEqual(await readApiResponse(response({results: []}), "search"), {results: []});
  await assert.rejects(readApiResponse({ok:true, json:async()=>{throw new Error("decode");}}, "search"), /invalid JSON/);
});
test("extraction distinguishes operational failure from a valid negative signal", async () => {
  for (const data of [{}, {content: []}, {content:{is_relevant:"false"}}, {statusCode:403, content:{is_relevant:false}}]) await assert.rejects(readApiResponse(response(data), "fetch"));
  assert.equal((await readApiResponse(response({content:{is_relevant:false}}), "fetch")).content.is_relevant, false);
});

test("actual CLIs fail on HTTP errors and search CLIs accept empty results", async () => {
  const {spawnSync} = await import('node:child_process');
  for (const name of ['01-search.js', '03-extract-signal.js', '04-search-to-signal.js']) {
    const fixture = 'globalThis.fetch = async () => ({ok:false,status:401,json:async()=>({error:"fixture"})});';
    const result = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(fixture), new URL('../'+name, import.meta.url).pathname], {encoding:'utf8', env:{PATH:process.env.PATH}});
    assert.equal(result.status, 1, name + result.stderr);
    assert.match(result.stderr, /HTTP 401/);
    assert.doesNotMatch(result.stdout, /0 ranked pages|SEARCH → 0|0 signals/);
  }
  for (const name of ['01-search.js', '04-search-to-signal.js']) {
    const fixture = 'globalThis.fetch = async () => ({ok:true,status:200,json:async()=>({results:[]})});';
    const result = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(fixture), new URL('../'+name, import.meta.url).pathname], {encoding:'utf8', env:{PATH:process.env.PATH}});
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /0 ranked pages|SEARCH → 0/);
  }
});

test("loop reports deferred browser work and does not invent sessions", async () => {
  const {spawnSync} = await import('node:child_process');
  const fixture = `globalThis.fetch = async (url) => {
    if (!url.endsWith('/search')) throw new Error('unexpected request');
    return {ok:true,status:200,json:async()=>({results:[{url:'https://example.invalid/portal/'}]})};
  };`;
  const result = spawnSync(process.execPath, ['--import','data:text/javascript,'+encodeURIComponent(fixture),new URL('../04-search-to-signal.js',import.meta.url).pathname], {encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/1 pages deferred for browser review/);
  assert.doesNotMatch(result.stdout,/1 browser sessions|most of/);
});

test("actual loop rejects string false, preserves boolean false, and accepts true", async () => {
  const {spawnSync} = await import('node:child_process');
  for (const relevance of ['false',false,true]) {
    const fixture = `globalThis.fetch = async url => ({ok:true,status:200,json:async()=>url.endsWith('/search')?{results:[{url:'https://example.invalid/bid'}]}:{content:{is_relevant:${JSON.stringify(relevance)}}}});`;
    const result = spawnSync(process.execPath, ['--import','data:text/javascript,'+encodeURIComponent(fixture),new URL('../04-search-to-signal.js',import.meta.url).pathname], {encoding:'utf8',env:{PATH:process.env.PATH}});
    assert.equal(result.status,typeof relevance === 'string'?1:0,result.stderr);
    if (typeof relevance === 'string') {
      assert.match(result.stderr,/invalid signal content/);
      assert.doesNotMatch(result.stdout,/✅ SIGNAL/);
    } else assert.match(result.stdout,new RegExp(`${relevance?1:0} signals`));
  }
});

test("fetch preview labels source and bounded request count", async () => {
  const {spawnSync} = await import('node:child_process');
  for (const success of [true,false]) {
    const fixture = `let calls=0; globalThis.fetch=async(url,options)=>{calls++; const format=JSON.parse(options.body).format; return {ok:true,status:200,json:async()=>format==='raw'?{statusCode:200,content:'<p>fixture raw text</p>'}:{statusCode:${success?200:500},content:${success?'"fixture markdown"':'""'}}};}; process.on('exit',()=>console.error('REQUEST_COUNT='+calls));`;
    const result = spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(fixture),new URL('../02-fetch.js',import.meta.url).pathname],{encoding:'utf8',env:{PATH:process.env.PATH}});
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stderr,new RegExp('REQUEST_COUNT='+(success?2:3)));
    assert.match(result.stdout,success?/Markdown content/:/Raw HTML text fallback/);
    assert.match(result.stdout,new RegExp((success?2:3)+' API requests'));
    assert.doesNotMatch(result.stdout,/Full markdown|in one call/);
  }
});
