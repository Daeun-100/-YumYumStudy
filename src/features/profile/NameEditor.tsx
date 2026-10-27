import { useState, type ReactNode } from 'react';
import { validateDisplayName } from '../../lib/onboarding';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../design/components';
import { colors, spacing, typography } from '../../design/theme';

export function NameEditor({ name, onSave, onCancel, busy = false, error: saveError, changed = false, children }: { name: string; onSave(name: string): void; onCancel(): void; busy?: boolean; error?: string; changed?: boolean; children?: ReactNode }) {
  const [draft, setDraft] = useState(name);
  const [checked, setChecked] = useState(false);
  const trimmed = draft.trim();
  const length = Array.from(trimmed).length;
  let error = '';
  try { validateDisplayName(draft); } catch (failure) { error = failure instanceof Error ? failure.message : '이름을 확인해 주세요.'; }
  function save() {
    setChecked(true);
    if (!busy && !error && (trimmed !== name || changed)) onSave(trimmed);
  }
  return <View style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.description}>친구들에게 보여줄 이름을 정해주세요.</Text>
      <Text style={s.label}>이름</Text>
      <View style={[s.field, { borderBottomColor: checked && error ? colors.error : colors.primary }]}>
        <TextInput autoFocus accessibilityLabel="새 이름" accessibilityHint="1자부터 12자까지 입력할 수 있어요" editable={!busy} value={draft}
          onChangeText={setDraft} onBlur={() => setChecked(true)} onSubmitEditing={save}
          autoCapitalize="none" autoCorrect={false} returnKeyType="done" placeholder="이름을 입력해 주세요"
          placeholderTextColor={colors.inactiveLabel} underlineColorAndroid="transparent" style={s.input} />
        {draft !== '' && <Button disabled={busy} label="×" accessibilityLabel="이름 지우기" size="icon" variant="raised" onPress={() => { setDraft(''); setChecked(true); }} />}
      </View>
      <View style={s.help}><Text accessibilityLiveRegion="polite" style={[s.caption, { flex: 1, color: checked && error ? colors.error : colors.secondary }]}>{checked && error ? error : '앞뒤 공백을 제외한 1~12자'}</Text><Text style={s.caption}>{length}/12</Text></View>
      {children}
      {!!saveError && <Text accessibilityRole="alert" style={[s.caption, { color: colors.error }]}>{saveError}</Text>}
    </ScrollView>
    <View style={s.footer}><Button label="저장하기" loading={busy} disabled={!!error || (trimmed === name && !changed)} onPress={save} /><Button label="취소" variant="raised" disabled={busy} onPress={onCancel} /></View>
  </View>;
}
const s = StyleSheet.create({
  content: { padding: spacing.xxl, gap: spacing.lg },
  description: { ...typography.body, color: colors.secondary, paddingBottom: spacing.xxl },
  label: { ...typography.link, color: colors.text },
  field: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, paddingBottom: spacing.sm },
  input: { ...typography.title, color: colors.text, flex: 1, minWidth: 0, minHeight: 52, paddingVertical: spacing.md },
  help: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  caption: { ...typography.caption, color: colors.secondary },
  footer: { padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.background },
});
