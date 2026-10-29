import { useId } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Polygon } from 'react-native-svg';
import { designAssets } from './assets';
import { AchievementIcon } from './components';
import { watermelonFillPoints } from './watermelon-fill';

/** Date-level progress only. AchievementBadge keeps the complete watermelon. */
export function AchievementProgressIcon({ percent, size = 18 }: { percent: number; size?: number }) {
  const id = `watermelon-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const progress = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  return <View accessible accessibilityLabel={`목표 ${Math.floor(progress)}%`} style={{ width: size, height: size, flexShrink: 0 }}>
    {progress >= 100 ? <AchievementIcon size={size} /> : progress > 0 ? <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Defs><ClipPath id={id}><Polygon points={watermelonFillPoints(progress)} /></ClipPath></Defs>
      <SvgImage href={designAssets.watermelon} width={100} height={100} preserveAspectRatio="xMidYMid meet" clipPath={`url(#${id})`} />
    </Svg> : null}
  </View>;
}
