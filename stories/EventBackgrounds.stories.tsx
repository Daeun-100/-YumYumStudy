import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { HomeArtwork } from '../src/features/study/HomeArtwork';
import { FocusView } from '../src/features/study/FocusView';
function Preview({ screen, background, width }: { screen: 'home' | 'focus'; background: string; width: number }) {
 return <View style={{ width, height: 800, backgroundColor: '#FCFCF9', overflow: 'hidden' }}>
  {screen === 'home' ? <View style={{ height: 430 }}><HomeArtwork character="bunny" backgroundId={background} width={width} height={430} /></View>
   : <FocusView backgroundId={background} initialSceneSize={{ width, height: 450 }} members={[{id:'sample',name:'친구',time:'30분',active:true,character:'bunny',self:true}]} memberCount={1} seconds={1800} goalMinutes={120} running onBack={()=>{}} onFriends={()=>{}} onToggle={()=>{}} />}
 </View>;
}
const meta={title:'Events/Backgrounds',component:Preview,args:{screen:'home',background:'halloween-home',width:390}} satisfies Meta<typeof Preview>;
export default meta;
type Story=StoryObj<typeof meta>;
export const HalloweenHome: Story={};
export const HalloweenFocus: Story={args:{screen:'focus',background:'halloween-focus'}};
export const UnsupportedFallback: Story={args:{background:'future-unknown'}};
export const NarrowHome: Story={args:{width:320}};
