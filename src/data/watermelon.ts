import type { Snapshot, WatermelonBalance } from '../lib/contracts';
import { decodeSnapshot, decodeWatermelonBalance } from './decode';
import { callRpc } from './rpc';

// Own balance only. No history scan, grant, debit or arbitrary user parameter.
export async function getWatermelonBalance(): Promise<Snapshot<WatermelonBalance>> {
  return decodeSnapshot(await callRpc('get_watermelon_balance'), decodeWatermelonBalance);
}
