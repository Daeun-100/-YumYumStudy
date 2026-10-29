import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePostitArtwork,decodeOwnedDesigns} from '../src/features/postits/designs.ts';
import {decodePostit} from '../src/features/postits/model.ts';
import {artworkUrl} from '../src/lib/artwork-content.ts';
import {preparePostit} from '../supabase/scripts/manage-postit-designs.mjs';
import {inspectPng} from '../supabase/scripts/artwork-png.mjs';
const revision='00000000-0000-4000-8000-000000000001';
const config={id:'remote-paper',name:'할로윈 종이',revision,fallbackColor:'#F9E8A0',textColor:'#453F30'};
const bytes=readFileSync('stories/assets/postit-paper-preview.png');
const manifest=preparePostit(config,bytes);
test('single remote PNG is validated without inventing home/focus assets',()=>{
 assert.equal(manifest.kind,'postit');assert.equal(manifest.paper.width,1024);assert.equal(manifest.home,undefined);
 assert.equal(decodePostitArtwork(manifest).revision,revision);
 assert.ok(artworkUrl('https://x.supabase.co',manifest.paper).endsWith(`/postit/remote-paper/${revision}/paper.png`));
 for(const change of [{schemaVersion:2},{revision:'bad'},{fallbackColor:'#FA8000'},{textColor:'url(evil)'},{paper:{...manifest.paper,path:'postit/other/paper.png'}},{paper:{...manifest.paper,bytes:2097153}}])assert.throws(()=>decodePostitArtwork({...manifest,...change}));
});
test('damaged PNG and wrong dimensions are rejected before upload',()=>{
 const broken=Buffer.from(bytes);broken[100]^=1;assert.throws(()=>preparePostit(config,broken));
 assert.throws(()=>inspectPng(readFileSync('assets/characters/bunny/bunny-home-bungeoppang.png'),{kind:'postit',screen:'paper'}),/1024x1024/);
 assert.throws(()=>preparePostit(config,Buffer.alloc(2097153)),/PNG/);
});
test('unsupported definitions do not hide supported owned designs',()=>{
 const row={grantId:revision,grantedAt:'2026-10-31T06:00:00+09:00',artwork:manifest};
 assert.equal(decodeOwnedDesigns([row,{...row,artwork:{...manifest,schemaVersion:99}}]).length,1);
 const note={id:'old',author:'친구',text:'메시지',room_id:0,color:'#F9E8A0',x:.2,y:.4,study_date:'2026-10-31',deleted_at:null,design_id:manifest.id,design_revision:revision};
 assert.equal(decodePostit(note).color,'#F9E8A0');
 assert.equal(decodePostit({...note,design_id:undefined,design_revision:undefined}).text,'메시지');
});
