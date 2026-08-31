import type { Skin, Stage } from '../types';

/**
 * Cosmetics and arenas. Skins are deliberately COSMETIC ONLY — the mockup
 * floated stat perks per thumb, but the difficulty sweep in test/tune.ts
 * already balances on a single dial (AI reaction/accuracy). Adding per-skin
 * multipliers would multiply that matrix by eight and make every tier reading
 * meaningless. Perks can come back once the base tiers hold up in playtesting.
 */
export const SKINS: Skin[] = [
  {
    id: 'fizzy-fred',
    name: 'Fizzy Fred',
    blurb: 'The house thumb',
    deep: '#f0c49a',
    base: '#ffe0c2',
    nail: '#ffd0d8',
    pip: '#e07b3a',
    cost: 0,
  },
  {
    id: 'cherry-bomb',
    name: 'Cherry Bomb',
    blurb: 'Loud and sticky',
    deep: '#c23a3a',
    base: '#ff7b6b',
    nail: '#fff1f1',
    pip: '#c23a3a',
    cost: 0,
  },
  {
    id: 'cream-soda',
    name: 'Cream Soda',
    blurb: 'Smooth operator',
    deep: '#d9c39a',
    base: '#fff6e8',
    nail: '#ffe9c9',
    pip: '#fff6e8',
    cost: 0,
  },
  {
    id: 'root-beer',
    name: 'Root Beer',
    blurb: 'Old barrel, older grudge',
    deep: '#7a4a2c',
    base: '#b87447',
    nail: '#ffe9c9',
    pip: '#6b3d20',
    cost: 0,
  },
  {
    id: 'lime-rickey',
    name: 'Lime Rickey',
    blurb: 'Zesty little menace',
    deep: '#4f9a3a',
    base: '#9ede77',
    nail: '#f2ffe3',
    pip: '#4f9a3a',
    cost: 300,
  },
  {
    id: 'blue-cap',
    name: 'Blue Cap',
    blurb: 'Cool under pressure',
    deep: '#2a5bd7',
    base: '#7fa4ff',
    nail: '#eaf1ff',
    pip: '#2a5bd7',
    cost: 500,
  },
  {
    id: 'grape-ape',
    name: 'Grape Ape',
    blurb: 'Purple and unbothered',
    deep: '#6b3ea8',
    base: '#b184e8',
    nail: '#f4ecff',
    pip: '#6b3ea8',
    cost: 500,
  },
  {
    id: 'gold-foil',
    name: 'Gold Foil',
    blurb: 'For closers only',
    deep: '#b98a1e',
    base: '#ffd977',
    nail: '#fffbe8',
    pip: '#ffc53d',
    cost: 1200,
  },
];

export const DEFAULT_SKIN = SKINS[0].id;

/** The computer's thumb. Always the same walnut tone so "not you" reads instantly. */
export const FOE_SKIN: Skin = {
  id: 'foe',
  name: 'Opponent',
  blurb: '',
  deep: '#8a5a3b',
  base: '#c08457',
  nail: '#ffe9c9',
  pip: '#c23a3a',
  cost: 0,
};

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export const STAGES: Stage[] = [
  {
    id: 'corner-store',
    name: 'The Corner Store',
    blurb: 'Sticky counter, low stakes',
    opponent: 'Pinky Pete',
    opponentTitle: 'Runs the register',
    difficulty: 'rookie',
    lidTop: '#d8a86c',
    lidBottom: '#b3824f',
    plank: 'rgba(59,42,29,.16)',
    hole: '#3b2a1d',
    ring: '#8a5a3b',
    reward: 80,
    stars: 1,
  },
  {
    id: 'bottling-room',
    name: 'The Bottling Room',
    blurb: 'Syrup underfoot — misses slide',
    opponent: 'Ruby Knuckle',
    opponentTitle: 'Champ of the Bottling Room',
    difficulty: 'contender',
    lidTop: '#c99257',
    lidBottom: '#a97445',
    plank: 'rgba(59,42,29,.18)',
    hole: '#3b2a1d',
    ring: '#8a5a3b',
    reward: 180,
    stars: 2,
  },
  {
    id: 'loading-dock',
    name: 'The Loading Dock',
    blurb: 'Cold hands, colder crowd',
    opponent: "Ol' Splinter",
    opponentTitle: 'Never lost a crate',
    difficulty: 'contender',
    lidTop: '#a8845c',
    lidBottom: '#7f6140',
    plank: 'rgba(24,18,12,.22)',
    hole: '#2b1d13',
    ring: '#6f4a30',
    reward: 320,
    stars: 2,
  },
  {
    id: 'rooftop-cooler',
    name: 'The Rooftop Cooler',
    blurb: 'Last crate standing',
    opponent: 'Gold Foil Gus',
    opponentTitle: 'Undisputed',
    difficulty: 'champ',
    lidTop: '#c8a06a',
    lidBottom: '#8e6a41',
    plank: 'rgba(59,42,29,.2)',
    hole: '#33231a',
    ring: '#a97445',
    reward: 600,
    stars: 3,
  },
];

/** The crate used for two-player matches — neutral, no opponent attached. */
export const VERSUS_STAGE: Stage = {
  ...STAGES[1],
  id: 'versus',
  name: 'One Crate, Two Thumbs',
  blurb: 'Same phone, no computer',
  opponent: 'Blue',
  opponentTitle: '',
  difficulty: 'contender',
  reward: 0,
};
