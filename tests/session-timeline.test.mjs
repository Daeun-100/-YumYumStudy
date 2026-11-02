import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionTimeline, projectTimeline, approvedGoal } from '../src/lib/session-timeline.ts';
import { createServerClock } from '../src/lib/clock.ts';
import { createStopOutbox } from '../src/lib/study-stop-core.ts';
import { monotonicNow, refreshClockOnResume } from '../src/lib/monotonic.web.ts';
import { displayedSeconds } from '../src/features/study/presentation.ts';
const base = Date.parse('2026-10-31T18:14:05.821Z');
const id = '22222222-2222-4222-8222-222222222222';
const snapshot = (serverNow = base) => ({ serverNow: new Date(serverNow).toISOString(), data: {
  day: { studyDate: '2026-10-31', closedSeconds: 8650, runningSeconds: 2135, goalMinutes: 180, goalAchieved: false, confirmedGoalAchieved: false },
  activeSession: { id, startedAt: '2026-10-31T17:38:29.860124Z', endedAt: null },
} });

test('processing and native queue delay do not replace the receipt instant', () => {
  let mono = 1000;
  const live = createSessionTimeline(id, new Date(base).toISOString(), { sentAt: 500, receivedAt: 1000 }, () => mono);
  mono += 26000;
  assert.equal(live.now(), base + 26000);
  const clock = createServerClock(new Date(base).toISOString(), () => mono, 1000);
  assert.equal(clock(), base + 26000);
  assert.equal(live.now(), clock());
});
test('fresh server reads cannot advance a running session onto a different clock', () => {
  let mono = 1000;
  const live = createSessionTimeline(id, new Date(base).toISOString(), { sentAt: 500, receivedAt: mono }, () => mono);
  mono += 10000;
  const projected = projectTimeline(snapshot(base + 26000), live);
  assert.equal(Date.parse(projected.serverNow), base + 10000);
  assert.equal(projected.data.day.runningSeconds, 2145);
  assert.equal(displayedSeconds(projected.data.day, projected.data.activeSession, projected.serverNow, live.now()), 10795);
  assert.equal(approvedGoal(projected.data.day), false);
});
test('local boundary and optimistic stop cannot activate an unapproved aura', () => {
  const day = { ...snapshot().data.day, runningSeconds: 2200, closedSeconds: 10800, goalAchieved: true };
  assert.equal(approvedGoal(day), false);
  assert.equal(approvedGoal({ ...day, confirmedGoalAchieved: true }), true);
  assert.equal(approvedGoal({ ...day, confirmedGoalAchieved: undefined }), true);
  assert.equal(approvedGoal({ ...day, confirmedGoalAchieved: undefined, goalMinutes: 0 }), false);
});
test('timeline clips at 06:00 and never mutates another session', () => {
  let mono=1000;
  const live=createSessionTimeline(id,'2026-10-31T20:59:59Z',{sentAt:500,receivedAt:1000},()=>mono);
  mono+=10000;
  const projected=projectTimeline(snapshot(),live);
  assert.equal(projected.data.day.runningSeconds,12090);
  const other=snapshot();other.data.activeSession.id='other';
  assert.equal(projectTimeline(other,live),other);
  assert.throws(()=>createSessionTimeline(id,'bad',{sentAt:0,receivedAt:0},()=>1));
  assert.throws(()=>createSessionTimeline(id,new Date(base).toISOString(),{sentAt:2,receivedAt:1},()=>2));
});
test('installed web clock uses real browser-compatible performance and exposes resume recovery', () => {
  const first=monotonicNow();
  assert.ok(Number.isFinite(first));
  assert.ok(monotonicNow()>=first);
  assert.equal(refreshClockOnResume,true);
});
test('offline stop survives a new outbox instance with exactly the original timestamp', async () => {
  const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const event={sessionId:id,stoppedAt:new Date(base).toISOString()};
  const first=createStopOutbox(storage,'owner:room');await first.save(event);
  await assert.rejects(first.flush(async()=>{throw Error('offline')}));
  const restarted=createStopOutbox(storage,'owner:room');
  await restarted.save({...event,stoppedAt:new Date(base+26000).toISOString()});
  await restarted.flush(async value=>assert.deepEqual(value,event));
  assert.equal(await restarted.read(),null);
  assert.equal(await createStopOutbox(storage,'another-owner:room').read(),null);
});
test('storage failure blocks submission, and an older acknowledgement cannot erase an earlier stop', async () => {
  const broken=createStopOutbox({getItem:()=>null,setItem:()=>{throw Error('quota')},removeItem:()=>{}},'key');
  await assert.rejects(broken.save({sessionId:id,stoppedAt:new Date(base).toISOString()}));
  const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const box=createStopOutbox(storage,'key');const late={sessionId:id,stoppedAt:new Date(base+1000).toISOString()};await box.save(late);
  await box.save({...late,stoppedAt:new Date(base).toISOString()});await box.acknowledge(late);
  assert.equal((await box.read()).stoppedAt,new Date(base).toISOString());
});
