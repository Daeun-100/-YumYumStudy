import { useUpdateReloadBlocker } from '../ota/useUpdateReloadBlocker';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StickyNote, Trash2 } from 'lucide-react-native';
import { Button } from '../../design/components';
import { Dialog, DialogCloseButton } from '../../design/Dialog';
import { colors, typography } from '../../design/theme';
import { postitColors, type Postit } from './model';
import type { PostitArtwork } from './designs';
import { POSTIT_PAPER_ASPECT_RATIO, PostitSheet } from './PostitSheet';
import { PostitPaper, type PostitImagePart } from './PostitPaper';

type BoardProps = {
  createId(): string;
  scene: { width: number; height: number }; notes: Postit[]; error?: string | null;
  add(id: string, text: string, color: string, x: number, y: number, designId?: string): Promise<void>;
  designs?: PostitArtwork[]; visibleDesigns?: PostitArtwork[]; designError?: string | null; onOpen?(): void; imageUrl?(a: PostitArtwork, part?: PostitImagePart): string;
  remove(id: string): Promise<void>;
  noteBorder?: boolean; embedded?: boolean; initialOpen?: boolean; initialPlacement?: boolean;
};
/** Shared app and Storybook UI; the caller owns persistence and synchronization. */
export function PostitBoard({ createId, scene, notes, add, remove, error, noteBorder = true, embedded = false, initialOpen = false, initialPlacement = false, designs = [], visibleDesigns = [], designError, onOpen, imageUrl }: BoardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialOpen ? notes[0]?.id ?? null : null);
  const selected = notes.find(note => note.id === selectedId) ?? null;
  const setSelected = (note: Postit | null) => { setSelectedId(note?.id ?? null); setActionError(null); };
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState(initialPlacement ? '오늘도 같이 힘내자!' : '');
  const [placing, setPlacing] = useState(initialPlacement);
  const [color, setColor] = useState('#F9E8A0');
  const [designId, setDesignId] = useState<string | undefined>();
  const design = designs.find(d => d.id === designId);
  const lookup = (revision?: string | null) => [...designs, ...visibleDesigns].find(d => d.revision === revision);
  const selectedArtwork = lookup(selected?.design_revision);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const failImage = (artwork?: PostitArtwork) => { if (artwork) setFailedImages(old => new Set(old).add(artwork.revision)); };
  const textColor = (artwork?: PostitArtwork) => artwork && !failedImages.has(artwork.revision) ? artwork.textColor : colors.text;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false);
  useUpdateReloadBlocker(writing || placing || busy || selected !== null);
  const pending = useRef<string | null>(null);
  useEffect(() => { pending.current = null; }, [draft, color, designId]);
  async function addAt(x: number, y: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setActionError(null);
    pending.current ??= createId();
    try { await add(pending.current, draft.trim(), design?.fallbackColor ?? color, x, y, design?.id); setPlacing(false); setDraft(''); pending.current = null; }
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
        <View style={[s.note, !note.design_revision && noteBorder && s.noteBorder, { transform: [{ rotate: note.id.charCodeAt(0) % 2 ? '-7deg' : '6deg' }] }, { width: 30, height: 30 / POSTIT_PAPER_ASPECT_RATIO }]}><PostitPaper artwork={lookup(note.design_revision)} color={note.color} imageUrl={imageUrl} />{!note.design_revision && <View style={s.fold} />}</View>
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
      </> : <View style={s.add}><Pressable accessibilityRole="button" accessibilityLabel="포스트잇 쓰기" onPress={() => { onOpen?.(); setWriting(true); }} style={({ pressed }) => [s.quietAdd, pressed && { backgroundColor: 'rgba(255,253,246,0.94)' }]}><StickyNote size={17} color="#4B554C" strokeWidth={1.6} /><Text style={s.addLabel}>붙이기</Text></Pressable></View>}
    </View>
    <Dialog visible={selected !== null} label="공유 포스트잇" embedded={embedded} busy={busy} onClose={() => setSelected(null)}>
      <PostitSheet artwork={selectedArtwork} color={selected?.color ?? postitColors[0]} imageUrl={imageUrl} onImageError={() => failImage(selectedArtwork)}>
        <View style={s.noteHeader}><Text numberOfLines={1} style={[s.author, !!selectedArtwork && s.artworkHeading]}>{selected?.author}</Text><DialogCloseButton label="×" accessibilityLabel="포스트잇 닫기" size="icon" variant="ghost" /></View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.readingContent}><Text style={[s.message, { color: textColor(selectedArtwork) }]}>{selected?.text}</Text></ScrollView>
        {!!actionError && <Text accessibilityRole="alert" style={s.error}>{actionError}</Text>}
        <View style={s.noteFooter}><Pressable accessibilityRole="button" accessibilityLabel="포스트잇 지우기" disabled={busy} onPress={() => void deleteSelected()} style={({ pressed }) => [s.delete, pressed && { opacity: .6 }]}><Trash2 size={16} color="#BE6573" strokeWidth={1.5} /><Text style={[s.smallCaption, { color: '#BE6573' }]}>지우기</Text></Pressable></View>
      </PostitSheet>
    </Dialog>
    <Dialog visible={writing} label="포스트잇 쓰기" embedded={embedded} busy={busy} onClose={() => setWriting(false)}>
      <PostitSheet artwork={design} color={color} imageUrl={imageUrl} onImageError={() => failImage(design)}>
        <View style={s.noteHeader}><Text style={s.title}>포스트잇 쓰기</Text><DialogCloseButton label="×" accessibilityLabel="포스트잇 쓰기 창 닫기" size="icon" variant="ghost" /></View>
        <TextInput accessibilityLabel="포스트잇 내용" placeholder="짧은 한마디를 남겨주세요" placeholderTextColor={colors.secondary} multiline maxLength={50} value={draft} onChangeText={setDraft} style={[s.input, { color: textColor(design) }]} />
        <View style={s.between}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
          <View accessibilityRole="radiogroup" accessibilityLabel="종이 디자인" style={{ flexDirection: 'row', gap: 8 }}>
            {postitColors.map((value, index) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={['노랑', '분홍', '연두'][index]} accessibilityState={{ checked: !design && value === color }} aria-checked={!design && value === color} onPress={() => { setColor(value); setDesignId(undefined); }} style={[s.swatch, { backgroundColor: value, borderColor: !design && value === color ? colors.primary : 'transparent' }]} />)}
            {designs.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{ checked: design?.id === item.id }} aria-checked={design?.id === item.id} onPress={() => setDesignId(item.id)} style={[s.swatch, { backgroundColor: item.preview ? 'transparent' : item.fallbackColor, borderColor: design?.id === item.id ? colors.primary : 'transparent' }]}><View pointerEvents="none" style={s.designSwatch}><View style={item.preview ? s.previewCrop : s.designCrop}><PostitPaper artwork={item} color={item.fallbackColor} imageUrl={imageUrl} part={item.preview ? 'preview' : 'paper'} /></View></View></Pressable>)}
          </View>
        </ScrollView><Text style={s.caption}>{draft.length}/50</Text></View>
        {!!designError && <Pressable accessibilityRole="button" accessibilityLabel="종이 디자인 다시 불러오기" onPress={onOpen}><Text style={s.error}>{designError} 다시 불러오기</Text></Pressable>}
        <Button label="붙일 위치 고르기" disabled={!draft.trim()} onPress={() => { setWriting(false); setPlacing(true); setActionError(null); }} />
      </PostitSheet>
    </Dialog>
    {!!(actionError && placing || error) && <View pointerEvents="none" style={{ position: 'absolute', bottom: 12, left: 16, right: 16 }}><Text accessibilityRole="alert" style={s.error}>{actionError && placing ? actionError : error}</Text></View>}
  </View>;
}
const s = StyleSheet.create({
  error: { ...typography.caption, color: '#A33F50' },
  title: { ...typography.title, color: colors.text, flex: 1 }, caption: { ...typography.secondary, color: colors.secondary },
  noteTarget: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  note: { width: 30, height: 32, borderRadius: 2, boxShadow: '0px 2px 4px rgba(60, 40, 20, 0.20)', overflow: 'hidden' },
  noteBorder: { borderWidth: 1.5, borderColor: '#776745' },
  fold: { position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderLeftWidth: 8, borderBottomWidth: 8, borderLeftColor: 'rgba(0,0,0,0.10)', borderBottomColor: '#FFFBEF' },
  add: { position: 'absolute', top: 16, right: 16 },
  quietAdd: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 22, backgroundColor: 'rgba(255,253,246,0.70)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  addLabel: { ...typography.caption, fontWeight: '500', color: '#4B554C' },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  noteFooter: { alignItems: 'flex-end' },
  author: { ...typography.link, color: colors.text, flex: 1 },
  artworkHeading: { textAlign: 'center' },
  readingContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 12 },
  designSwatch: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  // Remove the supplied circular PNG's transparent outer padding inside the round clip.
  previewCrop: { position: 'absolute', width: 48, height: 48, left: -4, top: -4 },
  designCrop: { position: 'absolute', width: 88, height: 88, top: 0, left: 0 },
  smallCaption: { ...typography.caption, color: colors.secondary, flexShrink: 1 },
  delete: { minHeight: 44, paddingHorizontal: 12, marginRight: -12, flexDirection: 'row', gap: 5, alignItems: 'center' },
  placeHint: { position: 'absolute', top: 12, left: 12, right: 12, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hint: { ...typography.secondary, color: colors.text, flexShrink: 1 },
  message: { ...typography.body, fontSize: 19, fontWeight: '500', lineHeight: 31, color: '#453F30' },
  input: { position: 'relative', zIndex: 1, ...typography.body, color: colors.text, flex: 1, minHeight: 0, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, textAlignVertical: 'top' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
