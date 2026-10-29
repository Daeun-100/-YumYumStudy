/** Approved writer preview: 14 side emissions and 7 laptop emissions per cycle. */
export const WRITER_CYCLE_MS = 18200;
export const WRITER_LIFETIME_MS = 3600;
export const writerColors = { quote: '#672136', dot: '#93531C', star: '#F6CA35' };
export type WriterScreen = 'home' | 'focus';
export type WriterParticle = { start: number; kind: 'quote' | 'dot' | 'magic'; x: number; y: number; direction: number; aboveLaptop: boolean };

export function writerParticles(screen: WriterScreen): WriterParticle[] {
  return Array.from({ length: 28 }, (_, i): WriterParticle => {
    const aboveLaptop = i % 2 === 0;
    const direction = Math.floor(i / 2) % 2 ? -1 : 1;
    const lane = Math.floor(i / 4) % 4;
    const x = screen === 'home'
      ? aboveLaptop ? .205 + lane * .047 : (direction < 0 ? .158 : .635) + (i % 3 - 1) * .013
      : aboveLaptop ? .34 + (Math.floor(i / 2) % 4) * .115 : (direction < 0 ? .24 : .78) + (i % 3 - 1) * .02;
    const y = screen === 'home'
      ? aboveLaptop ? .565 + lane * .016 : (direction < 0 ? .785 : .855) - (i % 3) * .024
      : aboveLaptop ? .665 : .84 - (i % 3) * .045;
    return { start: i * 650, kind: i % 3 === 0 ? 'quote' : i % 3 === 1 ? 'dot' : 'magic', x, y, direction, aboveLaptop };
  }).filter((_, i) => i % 4 !== 2);
}

export function writerFrame(particle: WriterParticle, time: number, screen: WriterScreen) {
  const age = ((time - particle.start) % WRITER_CYCLE_MS + WRITER_CYCLE_MS) % WRITER_CYCLE_MS;
  const p = Math.min(1, age / WRITER_LIFETIME_MS);
  const opacity = age >= WRITER_LIFETIME_MS ? 0 : Math.max(0, Math.min(p / .06, 1, (1 - p) / .14));
  const morph = particle.kind === 'magic' ? Math.max(0, Math.min(1, (p - .36) / .2)) : 0;
  const dx = particle.direction * (particle.aboveLaptop ? 4 * p + 3 * Math.sin(p * 2.3) : 10 * p + 6 * Math.sin(p * 2.3));
  const rise = particle.aboveLaptop ? 30 : screen === 'home' && particle.direction > 0 ? 48 : 72;
  return { opacity, dx, dy: -rise * p, rotation: particle.direction * (-.12 + .25 * p) * 180 / Math.PI, dotOpacity: 1 - morph, starOpacity: morph, starScale: 1 + Math.sin(morph * Math.PI) * 3 / 17 };
}

/** Sample all fade/morph boundaries; one native Animated clock drives every fragment. */
export function writerKeyframes(particle: WriterParticle, screen: WriterScreen) {
  const points = [0, .03, .06, .18, .3, .36, .46, .56, .7, .86, .93, 1];
  const times = [...new Set([0, WRITER_CYCLE_MS, ...points.map(p => (particle.start + p * WRITER_LIFETIME_MS) % WRITER_CYCLE_MS)])].sort((a, b) => a - b);
  return { inputRange: times.map(t => t / WRITER_CYCLE_MS), frames: times.map(t => writerFrame(particle, t, screen)) };
}
