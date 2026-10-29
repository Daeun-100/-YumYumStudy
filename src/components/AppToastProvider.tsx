import type { PropsWithChildren } from 'react';
import { useIdentity } from './IdentityProvider';
import { useStartupVisible } from './StartupBoundary';
import { ToastProvider } from '../design/toast';
import { studyRoomId } from '../lib/room';

export function AppToastProvider({ children }: PropsWithChildren) {
  const identity = useIdentity();
  const startupVisible = useStartupVisible();
  return <ToastProvider scope={`${studyRoomId}:${identity.uid ?? ''}`} enabled={startupVisible && !!identity.uid && !identity.loading && !identity.error}>{children}</ToastProvider>;
}
