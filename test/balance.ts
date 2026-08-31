// Difficulty sanity check: AI vs a competent scripted human, 60 matches each tier.
import { StateMachine } from '/home/claude/soda-pop-123/src/game/stateMachine';
import { AiController } from '/home/claude/soda-pop-123/src/game/ai';
import type { Difficulty } from '/home/claude/soda-pop-123/src/types';

const W = 402, H = 874;
function playMatch(diff: Difficulty, humanReaction: number): 'p1' | 'p2' {
  const sm = new StateMachine('normal', 0);
  sm.setLayout(W, H); sm.startMatch(0);
  const ai = new AiController(sm, 'p2', diff);
  let now = 0, plan: number | null = null, guard = 0;
  while (sm.match.matchWinner === null && guard++ < 200000) {
    now += 16; ai.tick(now); sm.update(now);
    const me = sm.thumbs.p1, foe = sm.thumbs.p2;
    // Human chases the opponent's thumb to stay aligned.
    sm.aim('p1', me.pos.x + Math.sign(foe.pos.x - me.pos.x) * Math.min(Math.abs(foe.pos.x - me.pos.x), 5));
    if (sm.phase === 'strike') {
      if (plan === null) plan = now + humanReaction;
      if (now >= plan && sm.aligned) {
        sm.press('p1', { x: me.pos.x, y: me.pos.y }, now);
        sm.move('p1', { x: me.pos.x, y: me.pos.y + 60 }, now, 24);
        sm.release('p1'); plan = null;
      }
    } else if (sm.phase === 'pin' && sm.round.pinner === 'p2') {
      if (now % 128 === 0) { sm.press('p1', { x: me.pos.x, y: me.pos.y }, now); sm.release('p1'); }
    } else plan = null;
  }
  return sm.match.matchWinner ?? 'p2';
}
for (const d of ['rookie', 'contender', 'champ'] as Difficulty[]) {
  let humanWins = 0;
  for (let i = 0; i < 60; i++) if (playMatch(d, 260) === 'p1') humanWins++;
  console.log(`${d.padEnd(10)} human win rate: ${((humanWins / 60) * 100).toFixed(0)}%`);
}
