import { useEffect } from 'react';
import { usePostitDesigns } from '../postits/PostitDesignProvider';
import { HalloweenEventView } from './HalloweenEventView';
import { HALLOWEEN_EVENT, halloweenStudyMinutes, isHalloweenEventActive } from './halloween-event';

type Props = { now: number; focused: boolean; studyDate?: string; seconds: number | null };
/** The local date window controls UI only; the server controls grants and ownership. */
export function HalloweenEvent({ now, focused, studyDate, seconds }: Props) {
  const { owned, refresh } = usePostitDesigns();
  const visible = focused && isHalloweenEventActive(now);
  useEffect(() => { if (visible) void refresh(); }, [visible, refresh]);
  if (!visible) return null;
  const received = owned.some(item => item.artwork.id === HALLOWEEN_EVENT.designId);
  return <HalloweenEventView minutes={received ? 30 : halloweenStudyMinutes(studyDate, seconds)} received={received} onOpen={() => { void refresh(); }} />;
}
