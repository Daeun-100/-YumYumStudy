import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareDefinition,uploadDefinition,main} from '../supabase/scripts/manage-artwork.mjs';
import {inspectPng} from '../supabase/scripts/artwork-png.mjs';
const home=readFileSync('assets/characters/bunny/bunny-home-bungeoppang.png'),focus=readFileSync('assets/characters/bunny/bunny-focus-bungeoppang.png');
const config={schemaVersion:2,theme:'winter',kind:'skin',character:'bunny',id:'remote-bunny',name:'remote bunny'};
test('PNG inspection verifies real cutouts, dimensions, checksums and compressed data',()=>{
 assert.equal(inspectPng(home,{kind:'skin',screen:'home'}).width,1536);
 const broken=Buffer.from(home);broken[100]^=1;assert.throws(()=>inspectPng(broken,{kind:'skin',screen:'home'}),/checksum/);
 assert.throws(()=>inspectPng(home,{kind:'skin',screen:'focus'}),/1254x1254/);
 assert.throws(()=>inspectPng(home.subarray(0,50),{kind:'skin',screen:'home'}));
});
test('unknown effect parameters are rejected before uploading',async()=>{
 await assert.rejects(()=>prepareDefinition({...config,effects:[{kind:'execute'}]},home,focus),/Unsupported/);
});
test('upload verifies both theme files before registering',async()=>{
 const manifest=await prepareDefinition(config,home,focus);const calls=[];
 const request=async(url,options={})=>{const path=new URL(url).pathname;calls.push({path,method:options.method??'GET'});
  if(path.includes('/object/public/'))return new Response(path.endsWith('/home.png')?home:focus,{headers:{'content-type':'image/png'}});
  return Response.json({ok:true});};
 await uploadDefinition({base:'https://x.supabase.co',key:'test-only',manifest,homeBytes:home,focusBytes:focus,request});
 assert.equal(calls.filter(c=>c.path.endsWith('/admin_register_artwork')).length,1);assert.equal(calls.some(c=>c.path.includes('publish')),false);
 assert.equal(calls.findIndex(c=>c.path.endsWith('/admin_register_artwork')),4);
});
test('an existing path with different bytes stops before registration',async()=>{
 const manifest=await prepareDefinition(config,home,focus);let staged=false;
 const request=async(url,options={})=>{const path=new URL(url).pathname;if(path.includes('/rpc/'))staged=true;return options.method==='POST'?Response.json({exists:true},{status:409}):new Response('wrong',{headers:{'content-type':'image/png'}});};
 await assert.rejects(()=>uploadDefinition({base:'https://x.supabase.co',key:'test-only',manifest,homeBytes:home,focusBytes:focus,request}),/does not match/);assert.equal(staged,false);
});

test('retired UUID creation and publishing commands fail before any network request',async()=>{
 await assert.rejects(()=>main(['publish']),/Unknown artwork command/);
 await assert.rejects(()=>main(['list','--revision','00000000-0000-4000-8000-000000000001']),/Unknown option/);
 await assert.rejects(()=>prepareDefinition({...config,schemaVersion:1,revision:'00000000-0000-4000-8000-000000000001'},home,focus),/Only themed/);
 let sent=0;await assert.rejects(()=>uploadDefinition({base:'https://x.supabase.co',key:'test-only',manifest:{schemaVersion:1},homeBytes:home,focusBytes:focus,request:async()=>{sent++;}}),/Unsupported/);assert.equal(sent,0);
});

test('shared postit upload verifies paper and optional preview before registration and preserves files',async()=>{
 const {preparePostit}=await import('../supabase/scripts/manage-artwork.mjs');
 const paper=readFileSync('assets/postits/halloween-paper-square.png');
 const preview=readFileSync('assets/postits/halloween-preview-fullbleed.png');
 for(const previewBytes of [undefined,preview]){
  const manifest=preparePostit({kind:'postit',id:'ghost',theme:'halloween',name:'Ghost',fallbackColor:'#F9E8A0',textColor:'#453F30'},paper,previewBytes);
  const calls=[];
  const request=async(url,options={})=>{
   const path=new URL(url).pathname;calls.push({path,options});
   if(path.includes('/object/public/'))return new Response(path.endsWith('paper.png')?paper:preview,{headers:{'content-type':'image/png'}});
   return Response.json({ok:true});
  };
  await uploadDefinition({base:'https://x.supabase.co',key:'test-only',manifest,paperBytes:paper,previewBytes,request});
  assert.equal(calls.length,previewBytes?5:3);
  assert.ok(calls.at(-1).path.endsWith('/admin_register_artwork'));
  assert.deepEqual(JSON.parse(calls.at(-1).options.body),{p_definition:manifest,p_activate:false});
  assert.equal(calls[0].options.headers['x-upsert'],'false');
  const before=calls.length;
  await assert.rejects(()=>uploadDefinition({base:'https://x.supabase.co',key:'test-only',manifest,paperBytes:paper,previewBytes,replace:true,request}),/preserved/);
  assert.equal(calls.length,before);
 }
});
