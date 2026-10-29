import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { StudyLayout } from '../screens/StudyLayouts';
import { RoomBanner } from './RoomBanner';
import { colors, typography } from '../../src/design/theme';
import focusSample from './banner-samples/focus.png';
import geumDebut from './banner-samples/geum-debut-v3.png';

type Props = { description: string; width: number; height: number; visible: boolean; artwork: 'sample' | 'geum-debut' };
/** Files stay in this browser; choosing them never uploads or publishes them. */
function Preview({ description, width, height, visible, artwork }: Props) {
 const viewport = useWindowDimensions();
 const padding = viewport.width < 600 ? 12 : 24;
 const phoneWidth = Math.min(width, viewport.width - padding * 2);
 const [imageUrl, setImageUrl] = useState<string>();
 const [error, setError] = useState('');
 const urls = useRef(new Set<string>());
 const pending = useRef(0);
 useEffect(() => {
  const values = urls.current;
  return () => { pending.current++; values.forEach(url => URL.revokeObjectURL(url)); values.clear(); };
 }, []);
 function choose(file?: File) {
  if (!file) return;
  const request = ++pending.current;
  if (file.type !== 'image/png' || file.size > 2 * 1024 * 1024) { setError('2MB 이하 PNG 파일을 선택해 주세요.'); return; }
  const url = URL.createObjectURL(file);
  urls.current.add(url);
  const image = new window.Image();
  const discard = () => { urls.current.delete(url); URL.revokeObjectURL(url); };
  image.onload = () => {
   if (request !== pending.current) { discard(); return; }
   if (image.width !== 1000 || image.height !== 300) { discard(); setError('집중용 1000 × 300 크기의 PNG를 선택해 주세요.'); return; }
   setError(''); setImageUrl(url);
  };
  image.onerror = () => { discard(); if (request === pending.current) setError('이미지를 읽지 못했어요. 다른 PNG를 선택해 주세요.'); };
  image.src = url;
 }
 return <View style={{ padding, gap: 24, alignItems: 'center', backgroundColor: '#F3F0E7', minHeight: '100%' }}>
  <View style={{ width: '100%', maxWidth: 804, gap: 8 }}>
   <Text style={{ ...typography.heading, color: colors.text }}>내가 만든 현수막 걸어보기</Text>
   <Text style={{ ...typography.body, color: colors.secondary }}>집중 화면에 직접 만든 현수막 이미지를 걸어요.</Text>
   <View style={{ gap: 10, padding: 16, borderRadius: 16, backgroundColor: colors.surface }}>
    <label style={{ fontSize: 13, color: colors.text }}>집중 · 투명 PNG 1000 × 300<input aria-label="집중 현수막 이미지" type="file" accept="image/png" onChange={event => choose(event.currentTarget.files?.[0])} style={{ display: 'block', marginTop: 6, maxWidth: '100%' }} /></label>
    <Text style={{ ...typography.caption, color: colors.secondary }}>글씨·천·집게까지 포함한 완성 이미지를 선택해 주세요. 여기서는 미리보기만 하며 서버에 게시되지 않아요.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ ...typography.caption, color: colors.text }}>{error}</Text>}
   </View>
  </View>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
   <View style={{ gap: 12 }}>
    <Text style={{ ...typography.label, color: colors.text }}>집중 · 함께 공부하는 저녁</Text>
    <StudyLayout key={`${phoneWidth}-${height}`} screen="focus" width={phoneWidth} height={height} sceneMinHeight={height < 740 ? 320 : undefined} homeEntryPreview running={false} character="blackcat" activeFriendCount={3}
     renderFocusDecoration={scene => visible ? <RoomBanner scene={scene} source={imageUrl ? { uri: imageUrl } : artwork === 'geum-debut' ? geumDebut : focusSample} imageAspectRatio={!imageUrl && artwork === 'geum-debut' ? 1920 / 819 : 1000 / 300} description={description} /> : null} />
   </View>
  </View>
 </View>;
}
const meta = {
 title: '화면 시안/공부방 현수막', component: Preview,
 parameters: { layout: 'fullscreen' },
 args: { description: '이번 주도 우리 같이 달려요!', width: 390, height: 844, visible: true, artwork: 'sample' },
 argTypes: { description: { description: '스크린리더 설명. 이미지 위에 글씨를 추가하지 않아요.' }, artwork: { control: 'select', options: ['sample', 'geum-debut'] } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Comparison: Story = { name: '집중 현수막 이미지' };
export const GeumDebut: Story = { name: '금작가 데뷔 축하', args: { artwork: 'geum-debut', description: '금작가의 데뷔를 축하합니다' } };
export const Small: Story = { name: '작은 화면 · 320', args: { width: 320, height: 640 } };
export const Hidden: Story = { name: '게시하지 않은 상태', args: { visible: false } };
