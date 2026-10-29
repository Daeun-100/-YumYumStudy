import { useUpdateReloadBlocker } from '../ota/useUpdateReloadBlocker';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StickyNote, Trash2 } from 'lucide-react-native';
import { Button } from '../../design/components';
import { Dialog, DialogCloseButton } from '../../design/Dialog';
import { colors, spacing, typography } from '../../design/theme';
import type { Postit } from './model';

type BoardProps = {
  createId(): string;
  scene: { width: number; height: number }; notes: Postit[]; error?: string | null;
  add(id: string, text: string, color: string, x: number, y: number): Promise<void>;
  remove(id: string): Promise<void>;
  noteBorder?: boolean; embedded?: boolean; initialOpen?: boolean; initialPlacement?: boolean;
};
/** Shared app and Storybook UI; the caller owns persistence and synchronization. */
export function PostitBoard({ createId, scene, notes, add, remove, error, noteBorder = true, embedded = false, initialOpen = false, initialPlacement = false }: BoardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialOpen ? notes[0]?.id ?? null : null);
  const selected = notes.find(note => note.id === selectedId) ?? null;
  const setSelected = (note: Postit | null) => { setSelectedId(note?.id ?? null); setActionError(null); };
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState(initialPlacement ? '오늘도 같이 힘내자!' : '');
  const [placing, setPlacing] = useState(initialPlacement);
  const [color, setColor] = useState('#F9E8A0');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false);
  useUpdateReloadBlocker(writing || placing || busy || selected !== null);
  const pending = useRef<string | null>(null);
  useEffect(() => { pending.current = null; }, [draft, color]);
  async function addAt(x: number, y: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setActionError(null);
    pending.current ??= createId();
    try { await add(pending.current, draft.trim(), color, x, y); setPlacing(false); setDraft(''); pending.current = null; }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : '다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function deleteSelected() {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setActionError(null);
    try { await remove(selected.id); setSelected(null); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : '다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {notes.map(note => <Pressable key={note.id} accessibilityRole="button" accessibilityLabel={`${note.author}의 포스트잇 열기`} disabled={placing} onPress={() => setSelected(note)} style={[s.noteTarget, { left: Math.max(0, Math.min(scene.width - 44, note.x * scene.width - 22)), top: Math.max(0, Math.min(scene.height - 44, note.y * scene.height - 22)) }]}>
        <View style={[s.note, noteBorder && s.noteBorder, { backgroundColor: note.color, transform: [{ rotate: note.id.charCodeAt(0) % 2 ? '-7deg' : '6deg' }] }]}><View style={s.fold} /></View>
      </Pressable>)}
      {placing ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="공부방에서 포스트잇을 붙일 위치 선택" disabled={busy} style={StyleSheet.absoluteFill} onPress={({ nativeEvent }) => {
          // Web Pressable supplies a MouseEvent; native supplies a touch event.
          const pointer = nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
          const localX = pointer.locationX ?? pointer.offsetX ?? scene.width / 2;
          const localY = pointer.locationY ?? pointer.offsetY ?? scene.height / 2;
          const x = Math.max(22, Math.min(scene.width - 22, localX)) / scene.width;
          const y = Math.max(22, Math.min(scene.height - 22, localY)) / scene.height;
          void addAt(x, y);
        }} />
        <View style={s.placeHint}><Text style={s.hint}>{busy ? '붙이고 있어요…' : '붙이고 싶은 곳을 눌러주세요'}</Text><Button label="취소" size="compact" variant="ghost" disabled={busy} onPress={() => setPlacing(false)} /></View>
      </> : <View style={s.add}><Pressable accessibilityRole="button" accessibilityLabel="포스트잇 쓰기" onPress={() => setWriting(true)} style={({ pressed }) => [s.quietAdd, pressed && { backgroundColor: 'rgba(255,253,246,0.94)' }]}><StickyNote size={17} color="#4B554C" strokeWidth={1.6} /><Text style={s.addLabel}>붙이기</Text></Pressable></View>}
    </View>
    <Dialog visible={selected !== null} label="공유 포스트잇" embedded={embedded} busy={busy} onClose={() => setSelected(null)}>
      <View style={[s.reading, { backgroundColor: selected?.color ?? '#F9E8A0' }]}>
        <View style={s.noteHeader}><View style={s.authorRow}><Text numberOfLines={1} style={s.author}>{selected?.author}</Text></View><DialogCloseButton label="×" accessibilityLabel="포스트잇 닫기" size="icon" variant="ghost" style={s.closeButton} /></View>
        <View style={s.paper}><Text style={s.message}>{selected?.text}</Text></View>
        {!!actionError && <Text accessibilityRole="alert" style={s.error}>{actionError}</Text>}
        <View style={s.noteFooter}><Pressable accessibilityRole="button" accessibilityLabel="포스트잇 지우기" disabled={busy} onPress={() => void deleteSelected()} style={({ pressed }) => [s.delete, pressed && { opacity: .6 }]}><Trash2 size={16} color="#BE6573" strokeWidth={1.5} /><Text style={[s.smallCaption, { color: '#BE6573' }]}>지우기</Text></Pressable></View>
      </View>
    </Dialog>
    <Dialog visible={writing} label="포스트잇 쓰기" embedded={embedded} busy={busy} onClose={() => setWriting(false)}>
      <View style={[s.editor, { backgroundColor: color }]}>
        <Text style={s.title}>포스트잇 쓰기</Text>
        <TextInput accessibilityLabel="포스트잇 내용" placeholder="짧은 한마디를 남겨주세요" multiline maxLength={50} value={draft} onChangeText={setDraft} style={[s.input, { backgroundColor: color }]} />
        <View style={s.between}><View accessibilityRole="radiogroup" accessibilityLabel="포스트잇 색상" style={{ flexDirection: 'row', gap: 8 }}>{['#F9E8A0', '#F7CED4', '#DAE8BE'].map((value, index) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={['노랑', '분홍', '연두'][index]} accessibilityState={{ checked: value === color }} onPress={() => setColor(value)} style={[s.swatch, { backgroundColor: value, borderColor: value === color ? colors.primary : 'transparent' }]} />)}</View><Text style={s.caption}>{draft.length}/50</Text></View>
        <Button label="붙일 위치 고르기" disabled={!draft.trim()} onPress={() => { setWriting(false); setPlacing(true); setActionError(null); }} />
        <DialogCloseButton label="취소" variant="ghost" size="compact" />
      </View>
    </Dialog>
    {!!(actionError && placing || error) && <View pointerEvents="none" style={{ position: 'absolute', bottom: 12, left: 16, right: 16 }}><Text accessibilityRole="alert" style={s.error}>{actionError && placing ? actionError : error}</Text></View>}
  </View>;
}
const s = StyleSheet.create({
  error: { ...typography.caption, color: '#A33F50' },
  title: { ...typography.title, color: colors.text }, caption: { ...typography.secondary, color: colors.secondary },
  noteTarget: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  note: { width: 30, height: 32, borderRadius: 2, boxShadow: '0px 2px 4px rgba(60, 40, 20, 0.20)', overflow: 'hidden' },
  noteBorder: { borderWidth: 1.5, borderColor: '#776745' },
  fold: { position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderLeftWidth: 8, borderBottomWidth: 8, borderLeftColor: 'rgba(0,0,0,0.10)', borderBottomColor: '#FFFBEF' },
  add: { position: 'absolute', top: 16, right: 16 },
  quietAdd: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 22, backgroundColor: 'rgba(255,253,246,0.70)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  addLabel: { ...typography.caption, fontWeight: '500', color: '#4B554C' },
  reading: { borderRadius: 6, padding: 24, paddingTop: 12, paddingBottom: 12, gap: 12 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  closeButton: { flexShrink: 0, marginRight: -12 },
  noteFooter: { alignItems: 'flex-end' },
  authorRow: { flex: 1, minWidth: 0, gap: 2 },
  author: { ...typography.link, color: colors.text },
  editor: { padding: 24, borderRadius: 6, gap: spacing.lg },
  paper: { minHeight: 140, paddingVertical: 12, justifyContent: 'center' },
  smallCaption: { ...typography.caption, color: colors.secondary, flexShrink: 1 },
  delete: { minHeight: 44, paddingHorizontal: 12, marginRight: -12, flexDirection: 'row', gap: 5, alignItems: 'center' },
  placeHint: { position: 'absolute', top: 12, left: 12, right: 12, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hint: { ...typography.secondary, color: colors.text, flexShrink: 1 },
  message: { ...typography.body, fontSize: 19, fontWeight: '500', lineHeight: 31, color: '#453F30' },
  input: { ...typography.body, color: colors.text, minHeight: 120, borderRadius: 8, padding: 0, textAlignVertical: 'top' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
});
