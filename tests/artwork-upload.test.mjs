import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareDefinition,uploadDefinition} from '../supabase/scripts/manage-artwork.mjs';
import {inspectPng} from '../supabase/scripts/artwork-png.mjs';
const home=readFileSync('assets/characters/bunny/bunny-home-bungeoppang.png'),focus=readFileSync('assets/characters/bunny/bunny-focus-bungeoppang.png');
const config={schemaVersion:1,revision:'00000000-0000-4000-8000-000000000001',kind:'skin',character:'bunny',id:'remote-bunny',name:'remote bunny'};
test('PNG inspection verifies real cutouts, dimensions, checksums and compressed data',()=>{
 assert.equal(inspectPng(home,{kind:'skin',screen:'home'}).width,1536);
 const broken=Buffer.from(home);broken[100]^=1;assert.throws(()=>inspectPng(broken,{kind:'skin',screen:'home'}),/checksum/);
 assert.throws(()=>inspectPng(home,{kind:'skin',screen:'focus'}),/1254x1254/);
 assert.throws(()=>inspectPng(home.subarray(0,50),{kind:'skin',screen:'home'}));
});
test('unknown effect parameters are rejected before uploading',async()=>{
 await assert.rejects(()=>prepareDefinition({...config,effects:[{kind:'execute'}]},home,focus),/Unsupported/);
});
test('upload checks both immutable files before staging and never publishes implicitly',async()=>{
 const manifest=await prepareDefinition(config,home,focus);const calls=[];
 const request=async(url,options={})=>{const path=new URL(url).pathname;calls.push({path,method:options.method??'GET'});
  if(path.includes('/object/public/'))return new Response(path.endsWith('/home.png')?home:focus,{headers:{'content-type':'image/png'}});
  return Response.json({ok:true});};
 await uploadDefinition({base:'https://x.supabase.co',key:'test-only',manifest,homeBytes:home,focusBytes:focus,request});
 assert.equal(calls.filter(c=>c.path.endsWith('/admin_stage_artwork')).length,1);assert.equal(calls.some(c=>c.path.includes('publish')),false);
 assert.equal(calls.findIndex(c=>c.path.endsWith('/admin_stage_artwork')),4);
});
test('an existing immutable URL with different bytes stops before staging',async()=>{
 const manifest=await prepareDefinition(config,home,focus);let staged=false;
 const request=async(url,options={})=>{const path=new URL(url).pathname;if(path.includes('/rpc/'))staged=true;return options.method==='POST'?Response.json({exists:true},{status:409}):new Response('wrong',{headers:{'content-type':'image/png'}});};
 await assert.rejects(()=>uploadDefinition({base:'https://x.supabase.co',key:'test-only',manifest,homeBytes:home,focusBytes:focus,request}),/does not match/);assert.equal(staged,false);
});
