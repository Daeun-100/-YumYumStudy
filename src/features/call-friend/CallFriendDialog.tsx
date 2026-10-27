import { useState } from 'react';
import { AlarmClock, X } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Dialog } from '../../design/Dialog';
import { Button, Card } from '../../design/components';
import { colors, typography } from '../../design/theme';
import { callService, CallServiceError, type CallResult } from './api';

export function CallFriendDialog({ friend, onClose }: { friend: { id: string; name: string }; onClose(): void }) {
  const [message, setMessage] = useState('같이 공부하자! 🍀');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);
  const [request, setRequest] = useState<{ id: string; message: string } | null>(null);
  async function send() {
    if (busy) return;
    const currentRequest = request ?? { id: randomUUID(), message: message.trim() };
    setRequest(currentRequest);
    setBusy(true); setNotice('');
    try {
      const result = await callService<CallResult>({ action: 'send', id: currentRequest.id, recipientId: friend.id, message: currentRequest.message });
      if (result.status === 'accepted') { setDone(true); setNotice('알림 전송을 요청했어요. 친구의 기기 설정에 따라 표시가 늦어질 수 있어요.'); }
      else if (result.status === 'failed') { setRequest(null); setNotice('알림을 보내지 못했어요. 친구의 알림 설정을 확인해 주세요.'); }
      else { setNotice('전송 결과를 확인하고 있어요. 다시 눌러 같은 요청의 결과를 확인할 수 있어요.'); }
    } catch (e) {
      if (e instanceof CallServiceError && e.rejected) setRequest(null);
      setNotice(e instanceof Error ? e.message : '전송 결과를 확인하지 못했어요.');
    }
    finally { setBusy(false); }
  }
  return <Dialog visible label="친구 부르기" busy={busy} onClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Card style={{ gap: 16, padding: 24, paddingTop: 36, backgroundColor: colors.surface }}>
        <Pressable accessibilityRole="button" accessibilityLabel="부르기 창 닫기" disabled={busy} onPress={onClose} style={{ position: 'absolute', right: 4, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={20} color={colors.secondary} /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}><AlarmClock size={24} color={colors.primary} /><Text style={{ ...typography.title, color: colors.text, flexShrink: 1 }}>{done ? '친구를 불렀어요!' : `${friend.name}님을 부를까요?`}</Text></View>
        {!done && <>
          <TextInput accessibilityLabel="부르기 메시지" value={message} editable={!busy && !request} onChangeText={text => setMessage(Array.from(text.replace(/[\u0000-\u001f\u007f]/g, ' ')).slice(0, 40).join(''))} multiline placeholder="친구에게 한마디 남겨요" placeholderTextColor={colors.secondary} style={{ ...typography.body, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, minHeight: 88, textAlignVertical: 'top' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ ...typography.caption, color: colors.secondary, flexShrink: 1 }}>보낼 메시지를 작성해 주세요</Text><Text style={{ ...typography.caption, color: colors.secondary }}>{Array.from(message).length}/40</Text></View>
        </>}
        {!!notice && <Text accessibilityRole="alert" style={{ ...typography.secondary, color: colors.secondary }}>{notice}</Text>}
        <Button label={done ? '확인' : request ? '전송 결과 다시 확인' : '부르기 보내기'} loading={busy} disabled={!message.trim()} onPress={done ? onClose : () => void send()} />
      </Card>
    </KeyboardAvoidingView>
  </Dialog>;
}
