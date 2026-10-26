import type { LeaveStatus, Snapshot } from '../lib/contracts';
import { decodeLeaveStatus, decodeSnapshot } from './decode';
import { callRpc } from './rpc';

// Also records missing earned entitlements; use RPC rather than reading the table directly.
export async function getLeaveStatus(): Promise<Snapshot<LeaveStatus>> {
  return decodeSnapshot(await callRpc('get_leave_status'), decodeLeaveStatus);
}
