import { randomUUID } from 'expo-crypto';
import { PostitBoard } from './PostitBoard';
import { usePostits } from './usePostits';

export function PostitOverlay({ scene }: { scene: { width: number; height: number } }) {
  const postits = usePostits();
  return <PostitBoard createId={randomUUID} scene={scene} {...postits} />;
}
