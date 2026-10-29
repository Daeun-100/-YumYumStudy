import { Image } from 'react-native';
import type { PostitArtwork } from '../../src/features/postits/designs';
import type { PostitImagePart } from '../../src/features/postits/PostitPaper';
import paperPng from '../../assets/postits/halloween-paper-square.png';
import previewPng from '../../assets/postits/halloween-preview.png';
const source = (value: number | string) => typeof value === 'string' ? { uri: value } : value;
export const halloweenPaperSource = source(paperPng);
export const halloweenPreviewSource = source(previewPng);
export const halloweenPostit: PostitArtwork = {
  schemaVersion: 2, theme: 'halloween', kind: 'postit', id: 'halloween-ghost', revision: '00000000-0000-4000-8000-000000000001',
  name: '할로윈 유령 포스트잇', fallbackColor: '#F7CED4', textColor: '#503454',
  paper: { path: 'halloween/postits/ghost/paper-square.png', width: 1254, height: 1254, bytes: 1846205, sha256: 'a831c94915e7640266095be03dcf1c9dce0652681d58831e866581bdeb1dbdf6' },
  preview: { path: 'halloween/postits/ghost/preview.png', width: 1254, height: 1254, bytes: 1717079, sha256: 'a0a7a8dd52953b770db019ac326f1cf2d9352111bc5f6e80c591894aec57a0a4' },
};
export function halloweenPostitUrl(_artwork: PostitArtwork, part: PostitImagePart = 'paper'): string {
  const value = part === 'preview' ? previewPng : paperPng;
  return typeof value === 'string' ? value : Image.resolveAssetSource(value)?.uri ?? '';
}
