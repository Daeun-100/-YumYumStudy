import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { PostitArtwork } from './designs';
import { PostitPaper, type PostitImagePart } from './PostitPaper';

export const POSTIT_PAPER_ASPECT_RATIO = 1;

type Props = PropsWithChildren<{ artwork?: PostitArtwork; color: string; imageUrl?(a: PostitArtwork, part?: PostitImagePart): string; onImageError?(): void }>;
/** Writing and reading use the same compact paper bounds and padding. */
export function PostitSheet({ artwork, color, imageUrl, onImageError, children }: Props) {
  return <ScrollView keyboardShouldPersistTaps="handled" style={s.scroller} contentContainerStyle={{ width: '100%' }}>
    <View testID="postit-paper-sheet" style={[s.paper, { backgroundColor: color }]}>
      <PostitPaper artwork={artwork} color={color} imageUrl={imageUrl} resizeMode="cover" onImageError={onImageError} />
      <View style={s.content}>{children}</View>
    </View>
  </ScrollView>;
}
const s = StyleSheet.create({
  scroller: { flexShrink: 1, width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 6 },
  paper: { width: '100%', aspectRatio: POSTIT_PAPER_ASPECT_RATIO, borderRadius: 6, overflow: 'hidden' },
  content: { flex: 1, position: 'relative', zIndex: 1, padding: 16, gap: 12 },
});
