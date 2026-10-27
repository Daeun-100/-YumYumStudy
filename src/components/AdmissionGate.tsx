import { TestRoomSelector } from './RoomBuildBoundary';
import { CharacterPicker } from '../features/profile/CharacterPicker';
import type { CharacterId } from '../lib/characters';
import { saveProfile } from '../data/profile';
import { useRef, useState, type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIdentity } from './IdentityProvider';
import { Button, Card } from '../design/components';
import { colors, typography } from '../design/theme';
import { joinRoom } from '../data/onboarding';
import { isTestRoom } from '../lib/room';
import { toStudyError } from '../lib/contracts';

export function AdmissionGate({ children }: PropsWithChildren) {
  const identity = useIdentity();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [character, setCharacter] = useState<CharacterId>('bunny');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const [accepted, setAccepted] = useState(false);
  const nameStep = accepted || identity.step === 'name';
  async function submit() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (nameStep) { await saveProfile(name, character); identity.retry(); return; }
      const result = await joinRoom(code);
      setCode('');
      if (result.step === 'ready') identity.retry();
      else if (result.step === 'name') setAccepted(true);
    } catch (failure) { setError(toStudyError(failure).message); }
    finally { lock.current = false; setBusy(false); }
  }
  // Render the app shell immediately. Only a confirmed invitation/name step
  // needs a gate; login and network failures belong in the screen's status UI.
  if (identity.loading || identity.error || (identity.profile && identity.step === 'ready')) return <View style={{ flex: 1 }}>{children}</View>;
  return <View style={styles.background}>
    <Text style={styles.brand}>YUMYUM STUDY</Text>
    {<Modal visible transparent animationType="fade" onRequestClose={() => {}}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
            <Card style={styles.card} accessibilityViewIsModal>
              <TestRoomSelector onboarding />
              <Text style={styles.brand}>{isTestRoom ? '테스트 방 · 0번' : 'YUMYUM STUDY'}</Text>
              <Text accessibilityRole="header" style={styles.title}>{nameStep ? '친구들에게 어떤 이름으로 보일까요?' : '얌얌스터디에 초대받았나요?'}</Text>
              <Text style={styles.description}>{nameStep ? '함께 공부할 친구들이 알아볼 수 있는 이름을 입력해 주세요.' : isTestRoom ? '테스트 입장으로 처음 참여하는 과정을 확인해 보세요.' : '친구에게 받은 초대 코드를 입력해 주세요.'}</Text>
              {nameStep ? <TextInput key="name" autoFocus accessibilityLabel="이름" placeholder="이름 (1~12자)" value={name} onChangeText={setName} editable={!busy} style={styles.input} autoCorrect={false} returnKeyType="done" onSubmitEditing={() => { void submit(); }} /> :
                !isTestRoom && <TextInput key="code" autoFocus accessibilityLabel="초대 코드" placeholder="초대 코드" value={code} onChangeText={setCode} editable={!busy} style={styles.input} autoCapitalize="none" autoCorrect={false} secureTextEntry maxLength={128} returnKeyType="go" onSubmitEditing={() => { void submit(); }} />}
              {nameStep && <CharacterPicker value={character} onChange={setCharacter} disabled={busy} />}
              {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              <Button label={nameStep ? '시작하기' : isTestRoom ? '테스트로 입장하기' : '입장하기'} loading={busy}
                disabled={nameStep ? !name.trim() : !isTestRoom && !code} onPress={() => { void submit(); }} />
              {nameStep && <Text style={styles.description}>이름은 나중에도 변경할 수 있어요.</Text>}
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>}
  </View>;
}
const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  overlay: { flex: 1, backgroundColor: 'rgba(31, 40, 32, 0.35)' },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, gap: 20 },
  brand: { ...typography.eyebrow, color: colors.primary },
  title: { ...typography.title, color: colors.text },
  description: { ...typography.small, color: colors.secondary },
  input: { ...typography.body, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, minHeight: 52, color: colors.text, backgroundColor: colors.surface },
  error: { ...typography.small, color: colors.error },
});
