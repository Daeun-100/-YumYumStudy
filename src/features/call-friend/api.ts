import { getSupabase } from '../../lib/supabase';
import { studyRoomId, withRoomOperation } from '../../lib/room';
export class CallServiceError extends Error {
  constructor(message: string, readonly rejected: boolean) { super(message); }
}
export type CallResult = { id: string; status: 'pending' | 'accepted' | 'failed' | 'unknown'; acceptedCount: number };
export async function callService<T>(input: Record<string, unknown>): Promise<T> {
  return withRoomOperation(async () => {
    const { data, error } = await getSupabase().functions.invoke('call-friend', { body: { ...input, roomId: studyRoomId } });
    if (error) {
      let message = '서버에 연결하지 못했어요. 다시 시도해 주세요.';
      try { const body = await error.context?.json(); if (typeof body?.error === 'string') message = body.error; } catch { /* Network failure has no response. */ }
      const status = error.context?.status;
      throw new CallServiceError(message, typeof status === 'number' && status >= 400 && status < 500);
    }
    if (data?.error) throw new Error(data.error);
    return data as T;
  });
}
