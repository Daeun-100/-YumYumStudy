import { withRoomOperation } from '../lib/room';
import { randomUUID } from 'expo-crypto';
import type { LeaveStatus, Snapshot } from '../lib/contracts';
import { decodeLeaveStatus, decodeSnapshot } from './decode';
import { callRpc } from './rpc';
import { createLeaveRequester } from '../lib/leave-request-core';
import { ensureAuthIdentity } from '../lib/identity';
import { sessionStorage } from '../lib/session-storage';

export async function getLeaveStatus(): Promise<Snapshot<LeaveStatus>> {
  return decodeSnapshot(await callRpc('get_leave_status'), decodeLeaveStatus);
}
const requester = createLeaveRequester({
  uid: ensureAuthIdentity, newId: randomUUID, storage: sessionStorage,
  send: async r => decodeSnapshot(await callRpc('mutate_leave', {
    p_request_id: r.requestId, p_revision: r.revision, p_action: r.action,
    p_date: r.date, p_grant_id: r.grantId,
  }), decodeLeaveStatus),
});
// Omit grantId to choose the earliest-expiring grant valid on the requested date.
export function scheduleLeave(date: string, revision: number, grantId: string | null = null): Promise<Snapshot<LeaveStatus>> {
  return withRoomOperation(() => requester.submit({ action: 'schedule', date, revision, grantId }));
}
export function cancelLeave(grantId: string, date: string, revision: number): Promise<Snapshot<LeaveStatus>> {
  return withRoomOperation(() => requester.submit({ action: 'cancel', date, revision, grantId }));
}
export const resumePendingLeave = () => withRoomOperation(() => requester.resume());
