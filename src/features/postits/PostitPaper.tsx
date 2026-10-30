import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { PostitArtwork } from './designs';
import { artworkUrl } from '../../lib/artwork-content';
export type PostitImagePart = 'paper' | 'preview';
export const postitImageUrl = (artwork: PostitArtwork, part: PostitImagePart = 'paper') => artworkUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', part === 'preview' ? artwork.preview ?? artwork.paper : artwork.paper);
function PaperImage({ uri, onFailure, resizeMode }: { uri: string; onFailure?(): void; resizeMode: 'contain' | 'cover' | 'stretch' }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <Image accessible={false} source={{ uri }} resizeMode={resizeMode} style={StyleSheet.absoluteFill} onError={() => { setFailed(true); onFailure?.(); }} />;
}
/** An image is decoration only: missing bytes never hide text or controls. */
export function PostitPaper({ artwork, color, imageUrl = postitImageUrl, onImageError, part = 'paper', resizeMode = 'contain' }: { artwork?: PostitArtwork; color: string; imageUrl?(a: PostitArtwork, part?: PostitImagePart): string; onImageError?(): void; part?: PostitImagePart; resizeMode?: 'contain' | 'cover' | 'stretch' }) {
  let uri: string | undefined;
  try { if (artwork) uri = imageUrl(artwork, part); } catch { /* Unsupported origin: use the basic paper. */ }
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: part === 'preview' ? 'transparent' : artwork?.fallbackColor ?? color }]}>{uri && <PaperImage key={uri} uri={uri} onFailure={onImageError} resizeMode={resizeMode} />}</View>;
}
