const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../launch-fs.mjs'),'utf8');
const block=source.slice(source.indexOf('const server = http.createServer'),source.indexOf('\nawait new Promise((resolve, reject) => {'));
test('actual file handler rejects file and directory symlinks outside share',async()=>{
 const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'cookbook-share-'));
 try {
  const root=path.join(temp,'share');await fsp.mkdir(root);await fsp.mkdir(path.join(temp,'outside'));
  await fsp.writeFile(path.join(root,'allowed.txt'),'allowed');await fsp.writeFile(path.join(temp,'outside','private.txt'),'synthetic-outside');
  await fsp.symlink(path.join(temp,'outside','private.txt'),path.join(root,'file-link'));
  await fsp.symlink(path.join(temp,'outside'),path.join(root,'dir-link'));
  let handler;vm.runInNewContext(block,{http:{createServer:fn=>{handler=fn;return {};}},path,ROOT:root,HEADER:'X-Test',SECRET:'fixture',MIME:{},URL,decodeURIComponent,stat:fsp.stat,readdir:fsp.readdir,realpath:fsp.realpath,constants:fs.constants,open:fsp.open});
  for(const [url,status] of [['/allowed.txt',200],['/file-link',403],['/dir-link/private.txt',403],['/dir-link',403]]) {
   const res={writeHead(code){this.code=code;},end(){}};
   await handler({method:'HEAD',url,headers:{'x-test':'fixture'}},res);assert.equal(res.code,status,url);
  }
 } finally {await fsp.rm(temp,{recursive:true,force:true});}
});
test('GET streams checked descriptor and rejects replacement before open',async()=>{
 const {Writable}=require('node:stream');
 const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'cookbook-stream-'));
 try {
  const root=path.join(temp,'share');await fsp.mkdir(root);
  const target=path.join(root,'file.txt'),outside=path.join(temp,'outside.txt');
  await fsp.writeFile(outside,'outside-fixture');
  for(const replace of [false,true]) {
   await fsp.writeFile(target,'inside-fixture');let handler;
   const open=async(p,flags)=>{if(replace){await fsp.unlink(target);await fsp.symlink(outside,target);}return fsp.open(p,flags);};
   vm.runInNewContext(block,{http:{createServer:fn=>{handler=fn;return {};}},path,ROOT:root,HEADER:'X-Test',SECRET:'fixture',MIME:{},URL,decodeURIComponent,stat:fsp.stat,readdir:fsp.readdir,realpath:fsp.realpath,constants:fs.constants,open});
   let body='';const res=new Writable({write(chunk,encoding,done){body+=chunk.toString();done();}});
   res.writeHead=code=>{res.code=code;res.headersSent=true;};
   const done=new Promise((resolve,reject)=>{res.on('finish',resolve);res.on('error',reject);});
   await handler({method:'GET',url:'/file.txt',headers:{'x-test':'fixture'}},res);await done;
   assert.equal(res.code,replace?403:200);assert.doesNotMatch(body,/outside-fixture/);
   if(!replace)assert.equal(body,'inside-fixture');
  }
 }finally{await fsp.rm(temp,{recursive:true,force:true});}
});
test('directory listing is disabled, including through a symlinked root',async()=>{
 const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'cookbook-listing-'));
 try {
  const real=path.join(temp,'real'),root=path.join(temp,'alias');await fsp.mkdir(real);await fsp.symlink(real,root);
  await fsp.writeFile(path.join(real,'<img src=x onerror=fixture>'),'fixture');
  let handler;vm.runInNewContext(block,{http:{createServer:fn=>{handler=fn;return {};}},path,ROOT:root,HEADER:'X-Test',SECRET:'fixture',MIME:{},URL,decodeURIComponent,stat:fsp.stat,realpath:fsp.realpath,constants:fs.constants,open:fsp.open});
  const res={writeHead(code){this.code=code;},end(body){this.body=body;}};
  await handler({method:'GET',url:'/',headers:{'x-test':'fixture'}},res);
  assert.equal(res.code,403);assert.match(res.body,/directory listing is disabled/);assert.doesNotMatch(res.body,/<img|\.\.\/real/);
  await handler({method:'GET',url:'/%ZZ',headers:{'x-test':'fixture'}},res);assert.equal(res.code,400);
 }finally{await fsp.rm(temp,{recursive:true,force:true});}
});
test('ancestor replacement between validation and open cannot stream outside bytes',async()=>{
 const {Writable}=require('node:stream');
 const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'cookbook-parent-race-'));
 try {
  const root=path.join(temp,'share'),folder=path.join(root,'folder'),outside=path.join(temp,'outside');
  await fsp.mkdir(folder,{recursive:true});await fsp.mkdir(outside);
  await fsp.writeFile(path.join(folder,'file.txt'),'inside-fixture');await fsp.writeFile(path.join(outside,'file.txt'),'outside-fixture');
  let handler,swapped=false;
  const open=async(p,flags)=>{if(!swapped){swapped=true;await fsp.rename(folder,path.join(root,'old'));await fsp.symlink(outside,folder);}return fsp.open(p,flags);};
  vm.runInNewContext(block,{http:{createServer:fn=>{handler=fn;return {};}},path,ROOT:root,HEADER:'X-Test',SECRET:'fixture',MIME:{},URL,decodeURIComponent,stat:fsp.stat,realpath:fsp.realpath,constants:fs.constants,open});
  let body='';const res=new Writable({write(chunk,encoding,done){body+=chunk.toString();done();}});res.writeHead=code=>{res.code=code;res.headersSent=true;};
  const done=new Promise(resolve=>res.on('finish',resolve));await handler({method:'GET',url:'/folder/file.txt',headers:{'x-test':'fixture'}},res);await done;
  assert.equal(res.code,403);assert.doesNotMatch(body,/outside-fixture/);
 }finally{await fsp.rm(temp,{recursive:true,force:true});}
});
