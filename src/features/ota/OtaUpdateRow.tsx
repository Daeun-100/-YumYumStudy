import { useOtaUpdate } from './OtaUpdateProvider';
import { OtaUpdateRowView } from './OtaUpdateRowView';

export function OtaUpdateRow() {
  const update = useOtaUpdate();
  if (!update.enabled) return null;
  return <OtaUpdateRowView pending={update.pending} busy={update.phase !== 'idle'}
    onPress={() => { void (update.pending ? update.apply() : update.check()); }} />;
}
