import { useSkinArtwork } from '../artwork/useSkinArtwork';
import { ArtworkImage } from '../artwork/ArtworkImage';
import { resolveCharacterArtwork as defaultArtwork } from '../../design/skin-artwork';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../design/components';
import { colors, typography } from '../../design/theme';
import { characterArtwork } from '../../design/character-artwork';
import { characterIds } from '../../lib/characters';
import type { Profile } from '../../lib/contracts';
import type { OwnedSkin } from '../../lib/skins';

export type SkinsViewProps = { profile: Profile; skins: OwnedSkin[]; initialSelectedId?: string; loading?: boolean; busy?: boolean; error?: string; notice?: string; onBack(): void; onRetry(): void; onApply(id: string | null): void };
export function SkinsView({ profile, skins, initialSelectedId, loading, busy, error, notice, onBack, onRetry, onApply }: SkinsViewProps) {
  const { resolveCharacterArtwork, hasSkinArtwork, status, retry } = useSkinArtwork([profile.activeSkinId,...skins.map(skin=>skin.id)]);
  const [selected, setSelected] = useState<string | null>(initialSelectedId ?? profile.activeSkinId ?? null);
  const choice = skins.find(skin => skin.id === selected);
  const character = profile.character ?? 'bunny';
  const art = resolveCharacterArtwork(character, profile.activeSkinId);
  const cross = choice && choice.character !== character;
  const currentName = skins.find(skin => skin.id === profile.activeSkinId)?.name ?? (profile.activeSkinId ? '적용 중인 스킨' : `기본 ${characterArtwork[character].label}`);
  const supported = choice && hasSkinArtwork(choice.character, choice.id);
  const applied = choice?.id === profile.activeSkinId;
  return <View style={{ flex: 1 }}>
    <View style={s.header}><Button label="‹" size="icon" variant="ghost" disabled={busy} accessibilityLabel="프로필로 돌아가기" onPress={onBack} /><Text accessibilityRole="header" style={s.heading}>보유 스킨</Text></View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
      <View style={s.summary}><ArtworkImage fallbackSource={defaultArtwork(character).focus} source={art.focus} resizeMode="contain" style={s.avatar} /><View style={{ flex: 1, gap: 5 }}><Text style={s.caption}>지금 나의 모습</Text><Text style={s.title}>{currentName}</Text><Text style={s.secondary}>오늘은 어떤 모습으로 함께할까요?</Text></View></View>
      {skins.some(skin => status(skin.id) === 'failed') && <Button label="이미지 다시 불러오기" variant="secondary" onPress={retry} />}
      {!!error && <View style={{ gap: 12 }}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button label="다시 불러오기" variant="secondary" disabled={busy} onPress={() => { retry(); onRetry(); }} /></View>}
      {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="보유 스킨 불러오는 중" />}
      {!loading && <>
        <View style={{ gap: 6 }}><Text style={s.group}>선물 받은 스킨 {skins.length}개</Text><Text style={s.secondary}>다른 캐릭터의 스킨도 바로 입을 수 있어요.</Text></View>
        {!skins.length && !error && <View style={{ paddingVertical: 40, gap: 12 }}><Text style={s.title}>아직 선물 받은 스킨이 없어요</Text><Text style={s.secondary}>선물 받은 특별한 모습들이 여기에 모여요.</Text></View>}
        {characterIds.filter(id => skins.some(skin => skin.character === id)).map(id => <View key={id} style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={s.group}>{characterArtwork[id].label} <Text style={s.caption}>{skins.filter(skin => skin.character === id).length}</Text></Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={`${characterArtwork[id].label} 스킨`} style={s.grid}>{skins.filter(skin => skin.character === id).map(skin => {
            const available = hasSkinArtwork(skin.character, skin.id);
            const state = status(skin.id);
            const unavailable = state === 'loading' ? '이미지 준비 중' : state === 'failed' ? '이미지를 불러오지 못했어요' : '업데이트 필요';
            return <Pressable key={skin.id} accessibilityRole="radio" accessibilityLabel={`${skin.name}${available ? '' : `, ${unavailable}`}`} accessibilityState={{ checked: selected === skin.id, disabled: !!busy || !available }} disabled={busy || !available} onPress={() => setSelected(skin.id)} style={({ pressed }) => [s.card, selected === skin.id && s.selected, pressed && { backgroundColor: colors.surfacePressed }]}>
              <View style={s.line}><Text style={s.tag}>선물</Text><Text style={{ color: colors.primary }}>{selected === skin.id ? '●' : '○'}</Text></View>
              <ArtworkImage fallbackSource={defaultArtwork(skin.character).focus} source={resolveCharacterArtwork(skin.character, skin.id).focus} resizeMode="contain" style={s.art} accessibilityLabel={available ? `${skin.name} 집중 모습 미리보기` : '업데이트 전 기본 모습으로 표시'} />
              <Text style={s.cardName}>{skin.name}</Text><Text style={s.caption}>{!available ? `${unavailable} · 기본 이미지` : profile.activeSkinId === skin.id ? '지금 적용 중' : '선물 받은 스킨'}</Text>
              {!available && <Text style={s.caption}>{state === 'failed' ? '다시 불러오기를 눌러 주세요.' : state === 'loading' ? '홈·집중 이미지를 준비하고 있어요.' : '앱을 다시 실행해 업데이트를 확인해 주세요.'}</Text>}
            </Pressable>;
          })}</View>
        </View>)}
      </>}
    </ScrollView>
    {!!notice && <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
    {(!!skins.length || !!profile.activeSkinId) && !loading && <View style={s.footer}>
      {choice ? <><View style={s.line}><Text style={s.title}>{choice.name}</Text><Text style={s.caption}>{characterArtwork[choice.character].label}</Text></View><Text style={s.secondary}>{cross ? `적용하면 캐릭터도 ${characterArtwork[choice.character].label}로 바뀌어요.` : '홈과 집중 화면에 함께 적용돼요.'}</Text></> : <Text style={s.secondary}>마음에 드는 스킨을 골라보세요.</Text>}
      {!!skins.length && <Button label={!choice ? '스킨을 선택해 주세요' : applied ? '적용 중이에요' : !supported ? status(choice.id) === 'loading' ? '이미지 준비 중이에요' : '이미지를 확인해 주세요' : cross ? `${characterArtwork[choice.character].label}로 변경하고 적용` : '적용'} loading={busy} disabled={!choice || !supported || applied} onPress={() => choice && onApply(choice.id)} />}
      {!!profile.activeSkinId && <Button label="스킨 해제 · 기본 모습으로" variant="ghost" disabled={busy} onPress={() => onApply(null)} />}
    </View>}
  </View>;
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 20, minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8 }, heading: { ...typography.heading, color: colors.text }, content: { padding: 24, paddingTop: 8, gap: 24, paddingBottom: 28 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.track }, avatar: { width: 72, height: 78 },
  title: { ...typography.title, color: colors.text }, secondary: { ...typography.secondary, color: colors.secondary }, caption: { ...typography.caption, color: colors.secondary }, group: { ...typography.body, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { width: '47%', padding: 12, gap: 4, borderWidth: 1, borderColor: colors.track, borderRadius: 20, backgroundColor: colors.surface }, selected: { borderColor: colors.primary, backgroundColor: colors.soft },
  art: { width: '100%', height: 104 }, line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, tag: { ...typography.label, color: colors.leave }, cardName: { ...typography.link, color: colors.text },
  footer: { padding: 20, gap: 10, borderTopWidth: 1, borderColor: colors.track, backgroundColor: colors.surface }, notice: { ...typography.secondary, paddingVertical: 10, paddingHorizontal: 24, color: colors.primary, backgroundColor: colors.soft }, error: { ...typography.secondary, color: colors.error },
});
