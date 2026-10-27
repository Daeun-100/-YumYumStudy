import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { AlarmClock, Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FocusView, type FocusMember } from '../src/features/study/FocusView';
import { Button, Card } from '../src/design/components';
import { Dialog } from '../src/design/Dialog';
import { colors, typography } from '../src/design/theme';

function WakePreview({ initial = 'idle' }: { initial?: 'idle' | 'confirm' | 'sent' }) {
  const friend: FocusMember = { id: 'minji', name: '민지', time: '32분', active: false, character: 'bear' };
  const [selected, setSelected] = useState<FocusMember | null>(initial === 'confirm' ? friend : null);
  const [message, setMessage] = useState('같이 공부하자! 🍀');
  const [result, setResult] = useState(initial === 'sent');
  const [sent, setSent] = useState<string[]>(initial === 'sent' ? ['minji'] : []);
  return <View style={{ width: 390, height: 844, maxWidth: '100%', backgroundColor: colors.background }}>
    <FocusView members={[
      { id: 'self', name: '다이앤', time: '나', active: true, character: 'bunny', self: true },
      friend,
      { id: 'suhyun', name: '수현', time: '53분', active: true, character: 'cat' },
      { id: 'jihoon', name: '지훈', time: '17분', active: false, character: 'puppy' },
    ]} memberCount={4} seconds={5400} sessionSeconds={1680} goalMinutes={180} running onBack={() => {}} onFriends={() => {}} onToggle={() => {}} onWake={member => { setResult(false); setMessage('같이 공부하자! 🍀'); setSelected(member); }} wakeSentIds={sent} />
    <Dialog visible={!!selected || result} label="친구 부르기" embedded onClose={() => { setSelected(null); setResult(false); }}>
      <Card style={{ gap: 16, padding: 24, paddingTop: 32, alignItems: 'center', backgroundColor: colors.surface }}>
        <Pressable accessibilityRole="button" accessibilityLabel="부르기 창 닫기" onPress={() => { setSelected(null); setResult(false); }} style={{ position: 'absolute', right: 4, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={20} strokeWidth={1.8} color={colors.secondary} /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 8 }}>
          {result ? <Check size={24} strokeWidth={1.8} color={colors.primary} /> : <AlarmClock size={24} strokeWidth={1.8} color={colors.primary} />}
          <Text style={{ ...typography.title, color: colors.text, textAlign: 'center', flexShrink: 1 }}>{result ? '부르기 알림을 보냈어요' : `${selected?.name}님을 부를까요?`}</Text>
        </View>
        {result && <Text style={{ ...typography.secondary, color: colors.secondary, textAlign: 'center' }}>{message.trim()}</Text>}
        {result ? <Button label="확인" onPress={() => setResult(false)} style={{ width: '100%' }} /> : <>
          <View style={{ width: '100%', gap: 8 }}>
            <TextInput accessibilityLabel="부르기 메시지" value={message} onChangeText={setMessage} maxLength={40} multiline placeholder="친구에게 한마디 남겨요" placeholderTextColor={colors.secondary} style={{ ...typography.body, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, minHeight: 88, textAlignVertical: 'top' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ ...typography.caption, color: colors.secondary, flexShrink: 1 }}>보낼 메시지를 작성해 주세요</Text>
              <Text style={{ ...typography.caption, color: colors.secondary }}>{message.length}/40</Text>
            </View>
          </View>
          <Button label="부르기 보내기" disabled={!message.trim()} onPress={() => { if (selected) setSent(ids => [...ids, selected.id]); setSelected(null); setResult(true); }} style={{ width: '100%' }} />
        </>}
      </Card>
    </Dialog>
  </View>;
}
const meta = { title: '화면/친구 부르기', component: WakePreview, parameters: { screenLayout: true, layout: 'fullscreen' }, render: args => <WakePreview key={args.initial} {...args} /> } satisfies Meta<typeof WakePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = { name: '쉬는 친구 이름을 눌러 부르기', args: { initial: 'idle' } };
export const Confirm: Story = { name: '부르기 메시지 작성', args: { initial: 'confirm' } };
export const Sent: Story = { name: '부른 뒤', args: { initial: 'sent' } };
