// Sweep AI reaction/jitter per tier and report human win rate vs an optimal script.
import { StateMachine } from '/home/claude/soda-pop-123/src/game/stateMachine';
import { AiController } from '/home/claude/soda-pop-123/src/game/ai';
import type { Difficulty } from '/home/claude/soda-pop-123/src/types';
const W=402,H=874;
// Real players jump the gun sometimes; a script that never faults makes the
// fault rule a one-sided penalty on the AI and skews every result.
function match(diff:Difficulty,hr:number,tapMs:number,faultChance:number):'p1'|'p2'|'stalemate'{
  const sm=new StateMachine('normal',0); sm.setLayout(W,H); sm.startMatch(0);
  const ai=new AiController(sm,'p2',diff);
  let now=0,plan:number|null=null,g=0,lastPhase='',faultAt:number|null=null;
  while(sm.match.matchWinner===null&&g++<200000){
    now+=16; ai.tick(now); sm.update(now);
    const me=sm.thumbs.p1,foe=sm.thumbs.p2;
    if(sm.phase==='chant'&&lastPhase!=='chant')
      faultAt = Math.random()<faultChance ? now+200+Math.random()*1400 : null;
    lastPhase=sm.phase;
    if(sm.phase==='chant'&&faultAt!==null&&now>=faultAt){
      faultAt=null;
      sm.press('p1',{x:me.pos.x,y:me.pos.y},now);
      sm.move('p1',{x:me.pos.x,y:me.pos.y+60},now,24);
      sm.release('p1');
    }
    sm.aim('p1',me.pos.x+Math.sign(foe.pos.x-me.pos.x)*Math.min(Math.abs(foe.pos.x-me.pos.x),5));
    if(sm.phase==='strike'){ if(plan===null)plan=now+hr;
      if(now>=plan&&sm.aligned){sm.press('p1',{x:me.pos.x,y:me.pos.y},now);sm.move('p1',{x:me.pos.x,y:me.pos.y+60},now,24);sm.release('p1');plan=null;} }
    else if(sm.phase==='pin'&&sm.round.pinner==='p2'){ if(now%tapMs<16){sm.press('p1',{x:me.pos.x,y:me.pos.y},now);sm.release('p1');} }
    else plan=null;
  }
  return sm.match.matchWinner??'stalemate';
}
for(const d of ['rookie','contender','champ'] as Difficulty[]){
  for(const [label,hr,tap,fc] of [['sharp',260,128,0.05],['average',360,160,0.09],['casual',480,220,0.14]] as [string,number,number,number][]){
    let wins=0,stale=0; const N=80;
    for(let i=0;i<N;i++){const r=match(d,hr,tap,fc); if(r==='p1')wins++; else if(r==='stalemate')stale++;}
    const note = stale? `  ⚠ ${stale} STALEMATES`:'';
    console.log(`${d.padEnd(10)} vs ${label.padEnd(8)} human: ${((wins/N)*100).toFixed(0)}% human wins${note}`);
  }
}
