import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { StudyLayout } from '../screens/StudyLayouts';
import { RoomBanner } from './RoomBanner';
import { colors, typography } from '../../src/design/theme';
import homeSample from './banner-samples/home.png';
import focusSample from './banner-samples/focus.png';

type Props = { description: string; screen: 'comparison' | 'home' | 'focus'; width: number; height: number; visible: boolean };
/** Files stay in this browser; choosing them never uploads or publishes them. */
function Preview({ description, screen, width, height, visible }: Props) {
 const viewport = useWindowDimensions();
 const padding = viewport.width < 600 ? 12 : 24;
 const phoneWidth = Math.min(width, viewport.width - padding * 2);
 const screens = screen === 'comparison' ? ['home','focus'] as const : [screen];
 const [images, setImages] = useState<Partial<Record<'home' | 'focus', string>>>({});
 const [error, setError] = useState('');
 const urls = useRef(new Set<string>());
 const pending = useRef({ home: 0, focus: 0 });
 useEffect(() => {
  const values = urls.current;
  const requests = pending.current;
  return () => { requests.home++; requests.focus++; values.forEach(url => URL.revokeObjectURL(url)); values.clear(); };
 }, []);
 function choose(target: 'home' | 'focus', file?: File) {
  if (!file) return;
  const request = ++pending.current[target];
  if (file.type !== 'image/png' || file.size > 2 * 1024 * 1024) { setError('2MB 이하 PNG 파일을 선택해 주세요.'); return; }
  const url = URL.createObjectURL(file);
  urls.current.add(url);
  const image = new window.Image();
  const discard = () => { urls.current.delete(url); URL.revokeObjectURL(url); };
  image.onload = () => {
   if (request !== pending.current[target]) { discard(); return; }
   if (image.width !== (target === 'home' ? 1200 : 1000) || image.height !== 300) { discard(); setError(`${target === 'home' ? '홈은 1200 × 300' : '집중은 1000 × 300'} 크기의 PNG를 선택해 주세요.`); return; }
   setError(''); setImages(previous => ({ ...previous, [target]: url }));
  };
  image.onerror = () => { discard(); if (request === pending.current[target]) setError('이미지를 읽지 못했어요. 다른 PNG를 선택해 주세요.'); };
  image.src = url;
 }
 return <View style={{ padding, gap: 24, alignItems: 'center', backgroundColor: '#F3F0E7', minHeight: '100%' }}>
  <View style={{ width: '100%', maxWidth: 804, gap: 8 }}>
   <Text style={{ ...typography.heading, color: colors.text }}>내가 만든 현수막 걸어보기</Text>
   <Text style={{ ...typography.body, color: colors.secondary }}>홈과 집중에 맞춰 만든 이미지 두 장을 한 세트로 걸어요.</Text>
   <View style={{ gap: 10, padding: 16, borderRadius: 16, backgroundColor: colors.surface }}>
    <label style={{ fontSize: 13, color: colors.text }}>홈 · 투명 PNG 1200 × 300<input aria-label="홈 현수막 이미지" type="file" accept="image/png" onChange={event => choose('home',event.currentTarget.files?.[0])} style={{ display: 'block', marginTop: 6, maxWidth: '100%' }} /></label>
    <label style={{ fontSize: 13, color: colors.text }}>집중 · 투명 PNG 1000 × 300<input aria-label="집중 현수막 이미지" type="file" accept="image/png" onChange={event => choose('focus',event.currentTarget.files?.[0])} style={{ display: 'block', marginTop: 6, maxWidth: '100%' }} /></label>
    <Text style={{ ...typography.caption, color: colors.secondary }}>글씨·천·집게까지 포함한 완성 이미지를 선택해 주세요. 여기서는 미리보기만 하며 서버에 게시되지 않아요.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ ...typography.caption, color: colors.text }}>{error}</Text>}
   </View>
  </View>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
   {screens.map(current => <View key={current} style={{ gap: 12 }}>
    <Text style={{ ...typography.label, color: colors.text }}>{current === 'home' ? '홈 · 햇살 드는 공부방' : '집중 · 함께 공부하는 저녁'}</Text>
    <StudyLayout key={`${current}-${phoneWidth}-${height}`} screen={current} width={phoneWidth} height={height} sceneMinHeight={height < 740 ? 320 : undefined} homeEntryPreview running={false} character="blackcat" activeFriendCount={3}
     renderHomeOverlay={scene => visible ? <RoomBanner screen="home" scene={scene} source={images.home ? { uri: images.home } : homeSample} description={description} /> : null}
     renderFocusOverlay={scene => visible ? <RoomBanner screen="focus" scene={scene} source={images.focus ? { uri: images.focus } : focusSample} description={description} /> : null} />
   </View>)}
  </View>
 </View>;
}
const meta = {
 title: '화면 시안/공부방 현수막', component: Preview,
 parameters: { layout: 'fullscreen' },
 args: { description: '이번 주도 우리 같이 달려요!', screen: 'comparison', width: 390, height: 844, visible: true },
 argTypes: { description: { description: '스크린리더 설명. 이미지 위에 글씨를 추가하지 않아요.' }, screen: { control: 'select', options: ['comparison','home','focus'] } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Comparison: Story = { name: '홈·집중 이미지 세트' };
export const Home: Story = { name: '홈', args: { screen: 'home' } };
export const Focus: Story = { name: '집중', args: { screen: 'focus' } };
export const Small: Story = { name: '작은 화면 · 320', args: { width: 320, height: 640 } };
export const Hidden: Story = { name: '게시하지 않은 상태', args: { visible: false } };
