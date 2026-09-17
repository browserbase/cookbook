import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { inspectArchive, validateStatementUrls, STATEMENTS } from '../archive-validation.ts';

const pdfs=Object.fromEntries([1,2,3,4].map(q=>[q,Buffer.from(`%PDF-1.7\nsynthetic quarter ${q}\n%%EOF`)]));
const expected=Object.fromEntries(Object.entries(pdfs).map(([q,data])=>[q,{sha256:createHash('sha256').update(data).digest('hex')}]));
function archive(quarters=[],extra=[]) {
 const zip=new AdmZip();quarters.forEach((q,i)=>zip.addFile(`quarter-${i}-1719265797164.pdf`,pdfs[q]));
 for(const [name,data] of extra)zip.addFile(name,data);
 return zip.toBuffer();
}
for(const qs of [[],[1],[4,2,3],[4,1,3,2]])test(`identified quarters ${qs}`,()=>{
 assert.deepEqual([...inspectArchive(archive(qs),expected)].sort(),qs.map(String).sort());
});
for(const [name,payload] of [
 ['duplicate quarter',archive([1,1,2,3])],
 ['changed PDF',archive([1],[['changed.pdf',Buffer.from('%PDF-1.7 changed')]])],
 ['HTML instead of PDF',archive([],[['error.pdf',Buffer.from('<html>Error</html>')]])],
 ['not ZIP',Buffer.from('not zip')],
 ['truncated ZIP',archive([1,2,3,4]).subarray(0,-25)],
])test(name,()=>assert.throws(()=>inspectArchive(payload,expected)));
test('empty body remains incomplete',()=>assert.equal(inspectArchive(Buffer.alloc(0),expected).size,0));
test('URLs require four distinct quarters and preserve supported aliases',()=>{
 const urls=[1,2,3,4].map(q=>STATEMENTS[q].url.replace('www.apple.com','images.apple.com')+'?download=1');
 assert.deepEqual(validateStatementUrls(urls),urls.toReversed());
 for(const bad of [[],urls.slice(1),[urls[0],...urls.slice(0,3)],[urls[0].replace('images.apple.com','images.apple.com.evil.invalid'),...urls.slice(1)]])assert.throws(()=>validateStatementUrls(bad));
});
