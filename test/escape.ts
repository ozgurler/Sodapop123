// How fast must you tap to escape a pin? Sweeps realistic human tap rates.
import { StateMachine } from '/home/claude/soda-pop-123/src/game/stateMachine';
const W = 402, H = 874;

function tryEscape(tapsPerSec: number): { escaped: boolean; ms: number } {
  const sm = new StateMachine('normal', 0);
  sm.setLayout(W, H); sm.startMatch(0);
  let now = 0;
  while (sm.phase !== 'strike' && now < 20000) { now += 16; sm.update(now); }
  // p2 pins p1.
  sm.aim('p1', W / 2); sm.aim('p2', W / 2);
  sm.press('p2', { x: W / 2, y: 100 }, now);
  sm.move('p2', { x: W / 2, y: 160 }, now, 24);
  sm.release('p2');
  now += 100; sm.update(now);
  if (sm.phase !== 'pin') return { escaped: false, ms: -1 };

  const start = now;
  const interval = 1000 / tapsPerSec;
  let nextTap = now;
  while (sm.phase === 'pin' && now - start < 5000) {
    now += 16;
    if (now >= nextTap) { sm.press('p1', { x: W / 2, y: 300 }, now); sm.release('p1'); nextTap += interval; }
    sm.update(now);
  }
  const escaped = sm.phase !== 'pin' && sm.round.winner === null;
  return { escaped, ms: escaped ? now - start : -1 };
}

console.log('taps/sec  result');
for (const r of [3, 4, 5, 6, 7, 8, 10, 12]) {
  const { escaped, ms } = tryEscape(r);
  console.log(`${String(r).padStart(5)}     ${escaped ? `escaped after ${ms}ms` : 'pinned — no escape'}`);
}
