import test from 'node:test';
import assert from 'node:assert/strict';
import { WRITER_CYCLE_MS, writerColors, writerParticles, writerFrame, writerKeyframes } from '../src/design/writer-particles.ts';

for (const screen of ['home', 'focus']) {
  test(`${screen}: halved laptop rate retains all side emissions and bounded coordinates`, () => {
    const particles = writerParticles(screen);
    assert.equal(particles.filter(p => p.aboveLaptop).length, 7);
    assert.equal(particles.filter(p => !p.aboveLaptop).length, 14);
    assert.equal(WRITER_CYCLE_MS, 18200);
    for (const p of particles) {
      assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
      const { inputRange, frames } = writerKeyframes(p, screen);
      assert.equal(inputRange[0], 0);
      assert.equal(inputRange.at(-1), 1);
      assert.deepEqual(frames[0], frames.at(-1));
      assert.ok(inputRange.every((v, i) => !i || v > inputRange[i - 1]));
      assert.ok(frames.every(f => Object.values(f).every(Number.isFinite) && f.opacity >= 0 && f.opacity <= 1));
    }
  });
  test(`${screen}: dot becomes yellow star and vanishes before the next emission`, () => {
    const p = writerParticles(screen).find(p => p.kind === 'magic');
    assert.equal(writerFrame(p, p.start + 400, screen).starOpacity, 0);
    assert.equal(writerFrame(p, p.start + 2400, screen).starOpacity, 1);
    assert.equal(writerFrame(p, p.start + 4000, screen).opacity, 0);
    assert.equal(writerColors.star, '#F6CA35');
  });
}
