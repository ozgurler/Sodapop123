/** Shared types for Soda Pop 1, 2, 3 — Thumb War Version. */

export type PlayerId = 'p1' | 'p2';

export type GamePhase =
  | 'intro' // "1, 2, 3, 4 — I declare a thumb war!"
  | 'chant' // "So-da Pop, one, two, three!"
  | 'strike' // window open: swipe to strike
  | 'clash' // simultaneous strike → replay chant
  | 'pin' // one thumb is pinned; escape by rapid tapping
  | 'resolve' // round result shown
  | 'matchEnd'; // best-of-5 decided

/** Which full-screen view is up. Battle owns the GamePhase above. */
export type Screen = 'title' | 'thumbs' | 'stages' | 'battle';

export type ChantSpeed = 'slow' | 'normal' | 'fast';

export type Difficulty = 'rookie' | 'contender' | 'champ';

/** Single-player vs the computer, or two humans on one device. */
export type GameMode = { kind: 'solo'; difficulty: Difficulty } | { kind: 'versus' };

/** A cosmetic thumb. Purely visual — no stat perks, so balance stays one dial. */
export interface Skin {
  id: string;
  name: string;
  /** Flavour line shown under the name. Cosmetic only. */
  blurb: string;
  /** Barrel gradient: edge → centre → edge. */
  deep: string;
  base: string;
  nail: string;
  /**
   * Colour used for this player's score pips and name pill. Kept separate from
   * the barrel tones: Cream Soda and Fizzy Fred are near-invisible against a
   * wooden lid, so the HUD needs a guaranteed-legible stand-in.
   */
  pip: string;
  /** Bottle caps to unlock. 0 = owned from the start. */
  cost: number;
}

/** A crate arena. In solo play the stage also picks the opponent and tier. */
export interface Stage {
  id: string;
  name: string;
  blurb: string;
  opponent: string;
  opponentTitle: string;
  difficulty: Difficulty;
  /** Crate lid gradient, top → bottom. */
  lidTop: string;
  lidBottom: string;
  plank: string;
  hole: string;
  ring: string;
  /** Caps awarded for taking the match. */
  reward: number;
  stars: number;
}

export interface Settings {
  chantSpeed: ChantSpeed;
  leftHanded: boolean;
  colorblindSafe: boolean;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
}

/** Local progression. No account, no network, no purchases. */
export interface SaveData {
  caps: number;
  unlocked: string[];
  skin: string;
  stageIndex: number;
  /** Highest stage index cleared, for the stage-select lock state. */
  cleared: number;
  wins: number;
  losses: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface ThumbState {
  /** Design-space position of the thumb base. */
  pos: Vec2;
  /** Position at the start of the current strike swipe, if any. */
  strikeStart: Vec2 | null;
  /** Timestamp (ms) when this player's strike landed in the strike window. */
  strikeAt: number | null;
  /** True while the player's finger is down in their zone. */
  holding: boolean;
  /** Squash-and-stretch factor for playful animation (1 = rest). */
  squash: number;
  /**
   * How far the thumb extends toward the seam: 0 = resting in its own
   * bottle-hole, 1 = fully lunged across the lid. This is what makes a pin
   * read as two thumbs actually touching.
   */
  reach: number;
  /** Target reach, eased toward each frame. */
  reachTarget: number;
  /** Chant indices on which this player faulted — only recent ones count. */
  faultChants: number[];
  /** Faults still inside the memory window (what the HUD shows). */
  faults: number;
  /** True for the swing-and-miss beat after an unaligned strike. */
  whiffed: boolean;
}

export interface RoundState {
  phase: GamePhase;
  /** Beat index within the chant (0..BEATS-1). */
  beat: number;
  /** How many chants this round has run — faults expire relative to this. */
  chantCount: number;
  /** ms timestamp when the current phase began. */
  phaseStart: number;
  /** Who pinned whom, when in 'pin' phase. */
  pinner: PlayerId | null;
  /** 0..1 — fills as the pin holds; escape taps drain it. */
  pinMeter: number;
  /** Escape taps registered by the pinned player this pin (for stats/FX). */
  escapeTaps: number;
  /** Decaying escape credit — sustained tapping keeps this high. */
  escapeCredit: number;
  /** Escapes each player has already used this round (raises the next bar). */
  escapesUsed: Record<PlayerId, number>;
  winner: PlayerId | null;
}

export interface MatchState {
  roundsWon: Record<PlayerId, number>;
  roundNumber: number;
  matchWinner: PlayerId | null;
}

export interface Profile {
  id: string;
  name: string;
  wins: number;
  losses: number;
}
