import test from 'node:test';
import assert from 'node:assert/strict';
import { createExitReporter } from '../src/features/exit-diagnostics/report-core.ts';

test('offline report remains queued and is acknowledged after retry only', async () => {
  let fail = true; const ack = []; const sent = [];
  const report = createExitReporter({ pending: async () => '[{"id":"a"}]',
    send: async e => { if (fail) throw Error('offline'); sent.push(e.id); }, acknowledge: async ids => ack.push(...ids) });
  await assert.rejects(report(), /offline/); assert.deepEqual(ack, []);
  fail = false; await report(); assert.deepEqual(sent, ['a']); assert.deepEqual(ack, ['a']);
});
test('concurrent foreground requests share one upload and failed acknowledgement retries same event', async () => {
  let acknowledgeFails = true; let sends = 0; let reads = 0;
  const report = createExitReporter({ pending: async () => { reads++; return '[{"id":"a"}]'; },
    send: async () => { sends++; }, acknowledge: async () => { if (acknowledgeFails) throw Error('disk'); } });
  const first = report(); assert.equal(report(), first); await assert.rejects(first, /disk/);
  assert.equal(reads, 1); acknowledgeFails = false; await report(); assert.equal(sends, 2);
});
test('successful prefix is acknowledged before a later upload fails', async () => {
  const ack = [];
  const report = createExitReporter({ pending: async () => '[{"id":"a"},{"id":"b"}]',
    send: async e => { if (e.id === 'b') throw Error('offline'); }, acknowledge: async ids => ack.push(...ids) });
  await assert.rejects(report()); assert.deepEqual(ack, ['a']);
});
