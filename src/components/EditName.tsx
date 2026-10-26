import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput } from 'react-native';
import { Button, Card } from '../design/components';
import { colors, typography } from '../design/theme';
import { useIdentity } from './IdentityProvider';
import { setDisplayName } from '../data/onboarding';
import { toStudyError } from '../lib/contracts';

export function EditName() {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await setDisplayName(name); setOpen(false); identity.retry(); }
    catch (failure) { setError(toStudyError(failure).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <Button label="이름 변경" variant="secondary" onPress={() => { setName(identity.profile?.displayName ?? ''); setError(null); setOpen(true); }} />
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: 'rgba(31,40,32,0.35)' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
          <Card style={{ width: '100%', maxWidth: 420 }} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={typography.title}>어떤 이름으로 바꿀까요?</Text>
            <TextInput accessibilityLabel="변경할 이름" autoFocus value={name} onChangeText={setName} editable={!busy} autoCorrect={false}
              placeholder="이름 (1~12자)" style={{ ...typography.body, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.text }}
              returnKeyType="done" onSubmitEditing={() => { void save(); }} />
            {error && <Text accessibilityRole="alert">{error}</Text>}
            <Button label="저장하기" loading={busy} disabled={!name.trim()} onPress={() => { void save(); }} />
            <Button label="취소" variant="secondary" disabled={busy} onPress={() => setOpen(false)} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
