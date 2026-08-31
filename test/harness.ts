/**
 * Headless smoke test: drives the StateMachine (and the AI) with a fake clock.
 * No canvas, no Capacitor. Run: npm test
 */
import { StateMachine } from '../src/game/stateMachine';
import { AiController } from '../src/game/ai';
import type { GameEvent } from '../src/game/stateMachine';
import type { GamePhase } from '../src/types';
import { hitboxPx, swingBounds, thumbTip } from '../src/game/geometry';

const W = 402;
const H = 874;
const CX = W / 2;
const CY = H * 0.78;

// Deterministic RNG so AI scenarios are reproducible run to run.
let seed = 1337;
Math.random = (): number => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

let failures = 0;
function expect(cond: boolean, label: string, extra = ''): void {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ FAIL: ${label} ${extra}`);
  }
}

function makeSm(): { sm: StateMachine; log: string[] } {
  const sm = new StateMachine('normal', 0);
  sm.setLayout(W, H);
  sm.startMatch(0);
  const log: string[] = [];
  sm.on((e: GameEvent) => log.push(e.type));
  return { sm, log };
}

// ── Scenario A: alignment gates the strike ────────────────────────────
{
  console.log('— A: strikes only connect when the thumbs overlap —');
  const { sm, log } = makeSm();
  let now = 0;
  const tick = (ms: number): void => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(now + 16, end);
      sm.update(now);
    }
  };
  const until = (p: GamePhase): void => {
    const cap = now + 20000;
    while (sm.phase !== p && now < cap) tick(16);
  };
  const swipe = (pl: 'p1' | 'p2'): void => {
    const t = sm.thumbs[pl];
    sm.press(pl, { x: t.pos.x, y: t.pos.y }, now);
    sm.move(pl, { x: t.pos.x, y: t.pos.y + 60 }, now, 24);
    sm.release(pl);
  };

  until('strike');
  // Park the thumbs at opposite ends of their swing, then strike: should whiff.
  const { min, max } = swingBounds(W, H);
  sm.aim('p1', min);
  sm.aim('p2', max);
  expect(!sm.aligned, `thumbs at opposite swing limits are not aligned (gap=${sm.alignmentGap.toFixed(0)}px)`);
  swipe('p1');
  tick(120);
  expect(log.includes('whiff'), 'misaligned strike whiffs');
  expect(sm.phase === 'strike', 'no pin awarded on a whiff', `(phase=${sm.phase})`);

  // Now line them up and strike: should pin.
  sm.aim('p1', CX);
  sm.aim('p2', CX + hitboxPx(H) * 0.5);
  expect(sm.aligned, 'thumbs within half a hitbox are aligned');
  // And just outside the hitbox must NOT connect — this was the "it still
  // catches you when the thumbs aren't across each other" bug.
  sm.aim('p2', CX + hitboxPx(H) * 1.2);
  expect(!sm.aligned, 'thumbs just outside the hitbox are not aligned');
  sm.aim('p2', CX + hitboxPx(H) * 0.5);
  sm.thumbs.p1.strikeAt = null;
  swipe('p1');
  tick(120);
  expect(sm.phase === 'pin' && sm.round.pinner === 'p1', 'aligned strike pins');
}

// ── Scenario B: thumbs visually overlap during a pin ──────────────────
{
  console.log('— B: pinned thumbs physically overlap on screen —');
  const { sm } = makeSm();
  let now = 0;
  const tick = (ms: number): void => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(now + 16, end);
      sm.update(now);
    }
  };
  while (sm.phase !== 'strike' && now < 20000) tick(16);
  sm.aim('p1', CX);
  sm.aim('p2', CX);
  sm.press('p1', { x: CX, y: CY }, now);
  sm.move('p1', { x: CX, y: CY + 60 }, now, 24);
  sm.release('p1');
  tick(400); // let the reach animation settle

  const t1 = thumbTip(sm.thumbs.p1, 'p1', W, H);
  const t2 = thumbTip(sm.thumbs.p2, 'p2', W, H);
  expect(sm.thumbs.p1.reach > 0.6, `pinner reaches across (${sm.thumbs.p1.reach.toFixed(2)})`);
  expect(t1.y < t2.y, 'pinner tip crosses past the pinned tip — the thumbs overlap',
    `(p1TipY=${t1.y.toFixed(0)} p2TipY=${t2.y.toFixed(0)})`);
  expect(Math.abs(t1.x - t2.x) < 1, 'thumbs share a column during the pin');
  // Thumb length must stay anatomically sane, not stretch across the screen.
  const len = Math.abs(t1.y - H * 0.63);
  expect(len < H * 0.3, `thumb stays thumb-length (${len.toFixed(0)}px of ${H}px height)`);
}

// ── Scenario C: the computer attacks ──────────────────────────────────
{
  console.log('— C: the computer attacks on its own —');
  const { sm, log } = makeSm();
  const ai = new AiController(sm, 'p2', 'contender');
  let now = 0;
  // Human does nothing at all. The AI should still strike and win rounds.
  let guard = 0;
  while (sm.match.matchWinner === null && guard++ < 400000) {
    now += 16;
    ai.tick(now);
    sm.update(now);
  }
  expect(log.includes('strikeLanded'), 'computer lands strikes unprompted');
  expect(sm.match.matchWinner === 'p2', `computer wins against a passive human (${sm.match.matchWinner})`);
}

// ── Scenario D: the computer defends ──────────────────────────────────
{
  console.log('— D: the computer defends (dodges and escapes) —');
  // D1: dodging — the AI moves laterally away from a stationary human thumb.
  const { sm } = makeSm();
  const ai = new AiController(sm, 'p2', 'champ');
  let now = 0;
  sm.aim('p1', CX);
  let sawUnaligned = false;
  let moved = 0;
  let prevX = sm.thumbs.p2.pos.x;
  let chantFrames = 0;
  for (let i = 0; i < 4000; i++) {
    now += 16;
    if (sm.match.matchWinner !== null) sm.startMatch(now); // keep chants coming
    sm.aim('p1', CX); // human parks dead centre and never strikes
    ai.tick(now);
    sm.update(now);
    moved += Math.abs(sm.thumbs.p2.pos.x - prevX);
    prevX = sm.thumbs.p2.pos.x;
    // Only judge alignment while aiming — a pin deliberately snaps them together.
    if (sm.phase === 'chant' || sm.phase === 'strike') {
      chantFrames++;
      if (!sm.aligned) sawUnaligned = true;
    }
  }
  expect(chantFrames > 200, `observed enough aiming frames (${chantFrames})`);
  expect(moved > 100, `computer moves its thumb laterally (${moved.toFixed(0)}px travelled)`);
  expect(sawUnaligned, 'computer breaks alignment to dodge strikes');

  // D2: escaping — pin the AI and confirm it taps its way out.
  const { sm: sm2, log: log2 } = makeSm();
  const ai2 = new AiController(sm2, 'p2', 'champ');
  let t2 = 0;
  while (sm2.phase !== 'strike' && t2 < 20000) {
    t2 += 16;
    sm2.update(t2);
  }
  sm2.aim('p1', CX);
  sm2.aim('p2', CX);
  sm2.press('p1', { x: CX, y: CY }, t2);
  sm2.move('p1', { x: CX, y: CY + 60 }, t2, 24);
  sm2.release('p1');
  t2 += 120;
  sm2.update(t2);
  expect(sm2.phase === 'pin' && sm2.round.pinner === 'p1', 'human pins the computer');
  const startMeter = sm2.round.pinMeter;
  for (let i = 0; i < 200 && sm2.phase === 'pin'; i++) {
    t2 += 16;
    ai2.tick(t2);
    sm2.update(t2);
  }
  expect(log2.includes('escapeTap'), 'computer fights the pin by tapping');
  expect(
    sm2.phase !== 'pin' || sm2.round.pinMeter < startMeter + 0.5,
    'computer meaningfully resists the pin',
  );
}

// ── Scenario E: core loop still intact ────────────────────────────────
{
  console.log('— E: chant, clash, faults, best-of-5 still work —');
  const { sm, log } = makeSm();
  let now = 0;
  const tick = (ms: number): void => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(now + 16, end);
      sm.update(now);
    }
  };
  const until = (p: GamePhase): void => {
    const cap = now + 20000;
    while (sm.phase !== p && now < cap) tick(16);
  };
  const swipe = (pl: 'p1' | 'p2'): void => {
    const t = sm.thumbs[pl];
    sm.press(pl, { x: t.pos.x, y: t.pos.y }, now);
    sm.move(pl, { x: t.pos.x, y: t.pos.y + 60 }, now, 24);
    sm.release(pl);
  };

  until('strike');
  sm.aim('p1', CX);
  sm.aim('p2', CX);
  swipe('p1');
  tick(32);
  swipe('p2');
  expect(sm.phase === 'clash', 'simultaneous aligned strikes clash');
  until('chant');
  expect(sm.phase === 'chant', 'clash returns to the chant');

  const p2Before = sm.match.roundsWon.p2;
  swipe('p1');
  expect(sm.thumbs.p1.faults === 1, 'early swipe is a fault');
  tick(48);
  swipe('p1');
  expect(sm.match.roundsWon.p2 === p2Before + 1, 'second fault forfeits the round');

  let guard = 0;
  while (sm.match.matchWinner === null && guard++ < 40) {
    until('strike');
    sm.aim('p1', CX);
    sm.aim('p2', CX);
    swipe('p1');
    tick(3600);
  }
  expect(sm.match.matchWinner !== null, `match reaches a winner (${sm.match.matchWinner})`);
  expect(log.includes('matchWon'), 'matchWon event fired');
}

// ── Scenario F: escape fatigue guarantees rounds end ──────────────────
{
  console.log('— F: repeated escapes get harder, so a round always resolves —');
  const sm = new StateMachine('normal', 0);
  sm.setLayout(W, H);
  sm.startMatch(0);
  let now = 0;
  const reqs: number[] = [];
  let guard = 0;
  // Both sides mash as fast as a human plausibly can (12/sec).
  while (sm.round.winner === null && guard++ < 60000) {
    now += 16;
    if (sm.phase === 'strike') {
      sm.aim('p1', W / 2);
      sm.aim('p2', W / 2);
      sm.press('p1', { x: W / 2, y: 300 }, now);
      sm.move('p1', { x: W / 2, y: 360 }, now, 24);
      sm.release('p1');
    } else if (sm.phase === 'pin') {
      const trapped = sm.round.pinner === 'p1' ? 'p2' : 'p1';
      if (now % 80 < 16) {
        sm.press(trapped, { x: W / 2, y: 200 }, now);
        sm.release(trapped);
      }
      if (reqs[reqs.length - 1] !== sm.escapeRequirement) reqs.push(sm.escapeRequirement);
    }
    sm.update(now);
  }
  expect(sm.round.winner !== null, 'round resolves even with relentless mashing');
  expect(reqs.length > 1 && reqs[reqs.length - 1] > reqs[0],
    `escape bar rises with each escape (${reqs.map((r) => r.toFixed(1)).join(' → ')})`);
}


// --- G: the open-ended strike window must not deadlock ---------------------
console.log('— G: an open strike window still resolves —');
{
  const sm = new StateMachine('fast', 0);
  sm.setLayout(W, H);
  sm.startMatch(0);
  let now = 0;
  // Both players swing wildly out of line, over and over. Every one whiffs.
  const wild = (id: 'p1' | 'p2', x: number) => {
    sm.aim(id, x);
    sm.press(id, { x, y: CY }, now);
    sm.move(id, { x, y: CY - 90 }, now, 24);
    sm.release(id);
  };
  let struck = 0;
  while (now < 40000 && sm.phase !== 'matchEnd') {
    now += 16;
    sm.update(now);
    if (sm.phase === 'strike' && now % 320 < 16) {
      // Far apart, so neither can connect — pure whiff spam.
      wild('p1', W * 0.2);
      wild('p2', W * 0.8);
      struck += 1;
    }
    // Eventually one of them lines up and lands it.
    if (struck > 6 && sm.phase === 'strike') {
      sm.aim('p2', W / 2);
      wild('p1', W / 2);
    }
  }
  expect(struck > 6, 'players can keep swinging after a whiff recovers', `(${struck} volleys)`);
  expect(sm.phase === 'matchEnd', 'round still reaches a result', `(phase=${sm.phase})`);
}


console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
