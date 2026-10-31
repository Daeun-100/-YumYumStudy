import { prepareImage } from '../src/lib/prepare-image';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useMemo } from 'react';
import { Image, Text, View } from 'react-native';
import { ArtworkContext } from '../src/features/artwork/ArtworkContext';
import { createArtworkResources } from '../src/lib/artwork-resources';
import type { ArtworkManifest } from '../src/lib/artwork-content';
import { HomeArtwork } from '../src/features/study/HomeArtwork';
import { FocusView } from '../src/features/study/FocusView';
import { SkinsView } from '../src/features/profile/SkinsView';
import skinHome from '../assets/characters/bunny/bunny-home-bungeoppang.png';
import skinFocus from '../assets/characters/bunny/bunny-focus-bungeoppang.png';
import bgHome from '../assets/backgrounds/home-background-halloween.png';
import bgFocus from '../assets/backgrounds/focus-background-halloween.png';
const skinId='remote-only-preview-bunny'; // Deliberately absent from the app's local skin registry.
function definition(kind:'skin'|'background'):ArtworkManifest{
 const id=kind==='skin'?skinId:'remote-preview-room',theme=kind==='skin'?'winter':'halloween';
 const asset=(screen:'home'|'focus')=>({path:`${theme}/${kind==='skin'?`skins/${id}`:'backgrounds'}/${screen}.png`,sha256:'a'.repeat(64),bytes:100,width:screen==='home'?1536:kind==='skin'?1254:1024,height:screen==='home'?1024:kind==='skin'?1254:1536});
 const pos={x:.5,y:.2,width:.12,opacity:.5};
 return {schemaVersion:2,theme,kind,id,name:kind==='skin'?'서버 스킨 미리보기':'서버 배경 미리보기',...(kind==='skin'?{character:'bunny' as const}:{}),home:asset('home'),focus:asset('focus'),effects:kind==='skin'?[{kind:'warmSteam',home:pos,focus:pos}]:[]};
}
const previewUri=(path:string)=>{
 const source=path.includes('/skins/')?(path.endsWith('/home.png')?skinHome:skinFocus):(path.endsWith('/home.png')?bgHome:bgFocus);
 if(typeof source==='string')return source;
 const resolved=Image.resolveAssetSource(source);if(!resolved)throw Error('Missing preview image');return resolved.uri;
};
function Preview({screen,fail}:{screen:'home'|'focus'|'skins';fail:boolean}){
 const store=useMemo(()=>createArtworkResources({now:Date.now,url:a=>previewUri(a.path),fetchSkins:async()=>[definition('skin')],prepare:async m=>{
  if(fail)throw Error('Preview download failure');
  await Promise.all([m.home,m.focus].map(a=>prepareImage(Image,previewUri(a.path),a)));
 }}),[fail]);
 useEffect(()=>{store.activate();void store.ingest(definition('background'));return()=>store.dispose();},[store]);
 return <ArtworkContext.Provider value={store}><View style={{width:390,height:800,backgroundColor:'#FCFCF9',overflow:'hidden'}}>
  {screen==='home'?<><Text>HTTP 이미지 · 로컬 목록에 없는 스킨</Text><View style={{height:430}}><HomeArtwork character="bunny" activeSkinId={skinId} backgroundId={`remote:asset-remote-preview-room:home`} width={390} height={430}/></View></>
   :screen==='focus'?<FocusView backgroundId={`remote:asset-remote-preview-room:focus`} initialSceneSize={{width:390,height:450}} members={[{id:'preview',name:'친구',time:'30분',active:true,character:'bunny',activeSkinId:skinId,self:true}]} memberCount={1} seconds={1800} goalMinutes={120} running onBack={()=>{}} onFriends={()=>{}} onToggle={()=>{}}/>
   :<SkinsView profile={{id:'preview',displayName:'친구',character:'bunny'}} skins={[{id:skinId,name:'서버 스킨 미리보기',character:'bunny',grantedAt:'2026-10-29T00:00:00Z'}]} onBack={()=>{}} onRetry={()=>{void store.refresh();}} onApply={()=>{}}/>}
 </View></ArtworkContext.Provider>;
}
const meta={title:'Events/RemoteArtwork',component:Preview,args:{screen:'home',fail:false}} satisfies Meta<typeof Preview>;
export default meta;
type Story=StoryObj<typeof meta>;
export const RemoteHome:Story={};
export const RemoteFocus:Story={args:{screen:'focus'}};
export const RemoteSkins:Story={args:{screen:'skins'}};
export const DownloadFailure:Story={args:{fail:true}};
