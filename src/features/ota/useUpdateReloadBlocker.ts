import { useLayoutEffect } from 'react';
import { blockUpdateReload } from './reload-gate';

/** Keep drafts and dialogs intact even when the keyboard has been dismissed. */
export function useUpdateReloadBlocker(blocked: boolean) {
  useLayoutEffect(() => {
    if (blocked) return blockUpdateReload();
  }, [blocked]);
}
