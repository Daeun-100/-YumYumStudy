import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { PostitArtwork } from './designs';
import { artworkUrl } from '../../lib/artwork-content';
export const postitImageUrl = (artwork: PostitArtwork) => artworkUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', artwork.paper);
function PaperImage({ uri, onFailure }: { uri: string; onFailure?(): void }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <Image accessible={false} source={{ uri }} resizeMode="contain" style={StyleSheet.absoluteFill} onError={() => { setFailed(true); onFailure?.(); }} />;
}
/** An image is decoration only: missing bytes never hide text or controls. */
export function PostitPaper({ artwork, color, imageUrl = postitImageUrl, onImageError }: { artwork?: PostitArtwork; color: string; imageUrl?(a: PostitArtwork): string; onImageError?(): void }) {
  let uri: string | undefined;
  try { if (artwork) uri = imageUrl(artwork); } catch { /* Unsupported origin: use the basic paper. */ }
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: artwork?.fallbackColor ?? color }]}>{uri && <PaperImage key={uri} uri={uri} onFailure={onImageError} />}</View>;
}
