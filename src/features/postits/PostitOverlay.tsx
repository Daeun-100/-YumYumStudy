import { usePostitDesigns } from './PostitDesignProvider';
import { randomUUID } from 'expo-crypto';
import { PostitBoard } from './PostitBoard';
import { usePostits } from './usePostits';

export function PostitOverlay({ scene }: { scene: { width: number; height: number } }) {
  const postits = usePostits();
  const designs = usePostitDesigns();
  const refreshDesigns = designs.refresh;
  return <PostitBoard designs={designs.owned.map(x => x.artwork)} visibleDesigns={designs.visible} designError={designs.error} onOpen={() => { void refreshDesigns(); }} createId={randomUUID} scene={scene} {...postits} />;
}
