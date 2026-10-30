import type { RefObject, ComponentRef } from 'react';
import { View } from 'react-native';
import { useOtaUpdate } from './OtaUpdateProvider';
import { OtaUpdateRowView } from './OtaUpdateRowView';

export function OtaUpdateRow({ targetRef }: { targetRef?: RefObject<ComponentRef<typeof View> | null> }) {
  const update = useOtaUpdate();
  if (!update.enabled) return null;
  return <OtaUpdateRowView targetRef={targetRef} pending={update.pending} busy={update.phase !== 'idle'}
    onPress={() => { void (update.pending ? update.apply() : update.check()); }} />;
}
