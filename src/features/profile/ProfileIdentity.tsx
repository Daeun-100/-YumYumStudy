import { Pencil } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Profile } from '../../lib/contracts';
import { resolveCharacterArtwork } from '../../design/skin-artwork';
import { colors, typography } from '../../design/theme';

export function ProfileIdentity({ profile, count, onEdit, onSkins }: { profile: Profile | null; count?: number; onEdit(): void; onSkins(): void }) {
  const artwork = resolveCharacterArtwork(profile?.character, profile?.activeSkinId);
  return <View style={s.row}>
    <View style={s.avatar}><Image source={artwork.focus} resizeMode="contain" style={{ width: 76, height: 84 }} accessibilityLabel={`내 ${artwork.label} 캐릭터`} /></View>
    <View style={{ flex: 1 }}>
      <View style={s.action}><Text style={s.name}>{profile?.displayName ?? '나'}</Text><Pressable accessibilityRole="button" accessibilityLabel="프로필 수정, 이름과 캐릭터 변경" onPress={onEdit} style={({ pressed }) => [s.edit, pressed && { backgroundColor: colors.surfacePressed }]}><Pencil size={12} strokeWidth={1.5} color={colors.inactiveLabel} /></Pressable></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`보유 스킨${count === undefined ? '' : ` ${count}개`}, 목록 열기`} onPress={onSkins} style={({ pressed }) => [s.action, pressed && { backgroundColor: colors.surfacePressed }]}><Text style={s.label}>보유 스킨 {count !== undefined && <Text style={s.count}>{count}개</Text>}</Text><Text style={s.chevron}>›</Text></Pressable>
    </View>
  </View>;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.soft, overflow: 'hidden', alignItems: 'center' },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8 }, name: { ...typography.title, color: colors.text },
  edit: { width: 28, height: 28, alignItems: 'flex-start', justifyContent: 'center', borderRadius: 6 }, label: { ...typography.secondary, color: colors.secondary, flex: 1 }, count: { color: colors.primary, fontWeight: '600' }, chevron: { ...typography.link, color: colors.secondary },
});
