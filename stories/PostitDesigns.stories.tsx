import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { PostitBoard } from '../src/features/postits/PostitBoard';
import type { Postit } from '../src/features/postits/model';
import type { PostitArtwork } from '../src/features/postits/designs';
import previewPaper from './assets/postit-paper-preview.png';
const revision='00000000-0000-4000-8000-000000000001';
const paper:PostitArtwork={schemaVersion:1,kind:'postit',id:'server-only-paper-preview',revision,name:'할로윈 포스트잇',fallbackColor:'#F9E8A0',textColor:'#453F30',paper:{path:`postit/server-only-paper-preview/${revision}/paper.png`,sha256:'a'.repeat(64),width:1024,height:1024,bytes:100}};
function Preview({width=390,height=844,reading=false,fail=false,owned=true}:{width?:number;height?:number;reading?:boolean;fail?:boolean;owned?:boolean}){
 const [notes,setNotes]=useState<Postit[]>([{id:'preview-note',author:'친구',room_id:0,study_date:'2026-10-31',deleted_at:null,color:'#F9E8A0',x:.3,y:.25,text:'오늘도 함께 공부해요!\n할로윈 한정 종이로 응원해요 🎃',design_id:paper.id,design_revision:paper.revision}]);
 const imageUrl=()=>fail?'http://127.0.0.1:6009/missing-paper.png':typeof previewPaper==='string'?previewPaper:Image.resolveAssetSource(previewPaper)?.uri ?? '';
 return <View style={{width,height,backgroundColor:'#E9E5D9',overflow:'hidden'}}><Text style={{padding:24,color:'#453F30'}}>우리 공부방</Text><PostitBoard key={`${width}:${reading}:${fail}:${owned}`} scene={{width,height}} notes={notes} designs={owned?[paper]:[]} visibleDesigns={[paper]} imageUrl={imageUrl} initialOpen={reading} embedded createId={()=>`preview-${Date.now()}`} add={async(id,text,color,x,y,designId)=>setNotes(old=>[...old,{id,text,color,x,y,design_id:designId,design_revision:designId?revision:null,room_id:0,author:'나',study_date:'2026-10-31',deleted_at:null}])} remove={async id=>setNotes(old=>old.filter(n=>n.id!==id))}/></View>;
}
const meta={title:'화면/포스트잇 디자인 보상',component:Preview,args:{width:390,height:844,reading:false,fail:false,owned:true},parameters:{screenLayout:true,docs:{description:{component:'실제 PostitBoard로 보유 디자인 선택·작성·배치·읽기·삭제를 확인합니다. PNG는 검증용 도형이며 실제 할로윈 보상이 아닙니다. 서버 접속·실제 지급은 없습니다.'}}}} satisfies Meta<typeof Preview>;
export default meta;
type Story=StoryObj<typeof meta>;
export const Editor:Story={name:'보유 디자인 선택'};
export const Reading:Story={name:'친구의 디자인 읽기',args:{reading:true,owned:false}};
export const Small:Story={name:'320px 작성과 선택',args:{width:320,height:640}};
export const ImageFailure:Story={name:'PNG 실패 시 기본 종이',args:{fail:true,reading:true}};
