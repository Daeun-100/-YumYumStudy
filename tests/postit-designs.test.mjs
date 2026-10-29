import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePostitArtwork,decodeOwnedDesigns,decodePostitDefinition} from '../src/features/postits/designs.ts';
import {decodePostit} from '../src/features/postits/model.ts';
import {artworkUrl} from '../src/lib/artwork-content.ts';
import {preparePostit} from '../supabase/scripts/manage-postit-designs.mjs';
import {inspectPng} from '../supabase/scripts/artwork-png.mjs';
const revision='00000000-0000-4000-8000-000000000001';
const config={id:'remote-paper',name:'할로윈 종이',theme:'halloween',fallbackColor:'#F9E8A0',textColor:'#453F30'};
const bytes=readFileSync('stories/assets/postit-paper-preview.png');
const manifest={...preparePostit(config,bytes),revision};
test('single remote PNG is validated without inventing home/focus assets',()=>{
 assert.equal(manifest.kind,'postit');assert.equal(manifest.paper.width,1024);assert.equal(manifest.home,undefined);
 assert.equal(decodePostitArtwork(manifest).revision,revision);
 assert.ok(artworkUrl('https://x.supabase.co',manifest.paper).endsWith(`/halloween/postits/remote-paper/paper.png?hash=${manifest.paper.sha256}`));
 for(const change of [{schemaVersion:3},{revision:'bad'},{fallbackColor:'#FA8000'},{textColor:'url(evil)'},{paper:{...manifest.paper,path:'postit/other/paper.png'}},{paper:{...manifest.paper,bytes:2097153}}])assert.throws(()=>decodePostitArtwork({...manifest,...change}));
});
test('damaged PNG and wrong dimensions are rejected before upload',()=>{
 const broken=Buffer.from(bytes);broken[100]^=1;assert.throws(()=>preparePostit(config,broken));
 assert.throws(()=>inspectPng(readFileSync('assets/characters/bunny/bunny-home-bungeoppang.png'),{kind:'postit',screen:'preview'}),/square/);
 assert.throws(()=>preparePostit(config,Buffer.alloc(2097153)),/PNG/);
});
test('unsupported definitions do not hide supported owned designs',()=>{
 const row={grantId:revision,grantedAt:'2026-10-31T06:00:00+09:00',artwork:manifest};
 assert.equal(decodeOwnedDesigns([row,{...row,artwork:{...manifest,schemaVersion:99}}]).length,1);
 const note={id:'old',author:'친구',text:'메시지',room_id:0,color:'#F9E8A0',x:.2,y:.4,study_date:'2026-10-31',deleted_at:null,design_id:manifest.id,design_revision:revision};
 assert.equal(decodePostit(note).color,'#F9E8A0');
 assert.equal(decodePostit({...note,design_id:undefined,design_revision:undefined}).text,'메시지');
});

test('theme/path registration needs no revision UUID and uses a hash cache key',()=>{
 const themed=preparePostit({id:'halloween-paper',theme:'halloween',name:'종이',fallbackColor:'#F9E8A0',textColor:'#453F30'},bytes);
 assert.equal(themed.schemaVersion,2);assert.equal(themed.revision,undefined);
 assert.equal(themed.paper.path,'halloween/postits/halloween-paper/paper.png');
 assert.ok(artworkUrl('https://x.supabase.co',themed.paper).endsWith(`?hash=${themed.paper.sha256}`));
 assert.throws(()=>decodePostitDefinition({...themed,revision}),/not an image revision/);
 assert.throws(()=>decodePostitDefinition({...themed,paper:{...themed.paper,path:'winter/postits/paper.png'}}));
});

test('approved portrait paper and circular preview retain original PNG bytes',()=>{
 const paperBytes=readFileSync('assets/postits/halloween-paper.png'), previewBytes=readFileSync('assets/postits/halloween-preview.png');
 const definition=preparePostit({id:'halloween-ghost',theme:'halloween',name:'할로윈 유령 포스트잇',fallbackColor:'#F7CED4',textColor:'#503454'},paperBytes,previewBytes);
 assert.equal(definition.paper.width,1122);assert.equal(definition.paper.height,1402);assert.equal(definition.preview.width,1254);assert.equal(definition.preview.height,1254);
 assert.equal(definition.paper.sha256,'ed44fdace93c1bac479017b4ae478a0a22fc2a0a83d7476ad193ef292a5769a6');
 assert.equal(definition.preview.sha256,'a0a7a8dd52953b770db019ac326f1cf2d9352111bc5f6e80c591894aec57a0a4');
 assert.throws(()=>decodePostitDefinition({...definition,preview:{...definition.preview,height:1402}}));
 assert.throws(()=>preparePostit({...definition},paperBytes),/Preview PNG file required/);
});

 test('landscape Halloween redraw is accepted with unchanged circular preview',()=>{
 const paper=readFileSync('assets/postits/halloween-paper-landscape.png');
 const preview=readFileSync('assets/postits/halloween-preview.png');
 const definition=preparePostit(config,paper,preview);
 assert.equal(definition.paper.width,1437);assert.equal(definition.paper.height,1095);
 assert.ok(Math.abs(definition.paper.width/definition.paper.height-420/320)<0.001);
 assert.equal(decodePostitDefinition(definition).paper.sha256,definition.paper.sha256);
 assert.throws(()=>decodePostitDefinition({...definition,paper:{...definition.paper,width:2048,height:512}}));
 });
