import type { ChantSpeed } from '../types';

/** All gameplay tuning lives here so designers can iterate without touching logic. */

/**
 * Chant: "So-da Pop, one, two, three!" → 6 beats, strike opens on the last.
 * The counts are numerals so each beat marker fits a square card.
 */
export const CHANT_BEATS = ['So', 'da', 'Pop', '1', '2', '3!'] as const;

/** Pre-match declaration, shown once per match over the crate. */
export const INTRO_COUNT = ['1', '2', '3', '4'] as const;
export const INTRO_LINE = 'I declare a thumb war!';
/** How long each intro card holds before the next lights up. */
export const INTRO_BEAT_MS = 340;
/** Total intro length: four cards plus a beat to read the line. */
export const INTRO_MS = INTRO_BEAT_MS * (INTRO_COUNT.length + 2);

/** Milliseconds per beat, by chant-speed setting. */
export const BEAT_MS: Record<ChantSpeed, number> = {
  slow: 700,
  normal: 500,
  fast: 340,
};

/** Two strikes landing within this window count as a clash (chant replays). */
export const CLASH_WINDOW_MS = 80;

/**
 * Pin phase duration: a full pin wins the round. Kept short deliberately —
 * the pin is a race against the escape bar, and a long fuse would let any
 * moderate tapper out every time, which makes pins meaningless.
 */
export const PIN_DURATION_MS = 1600;

/** Meter head start (0..1) the striker gets when the pin lands. */
export const PIN_INITIAL_ADVANTAGE = 0.25;

/**
 * ESCAPE: tapping builds "escape credit" which decays, so breaking out needs a
 * sustained fast tap — but reaching the threshold ALWAYS frees you, regardless
 * of how far the pin timer has run. Roughly: 5 taps/sec is the break-even rate,
 * 7+ gets you out in about a second, 3 never will.
 */
export const ESCAPE_TAP_VALUE = 0.22;
export const ESCAPE_DECAY_MS = 900;
export const ESCAPE_THRESHOLD = 1;

/**
 * Struggling tires your thumb: each escape you pull off in a round raises the
 * bar for your next one by this fraction. Without fatigue, two players who can
 * both tap above the threshold escape every pin forever and the round never
 * ends — a stalemate, not a game.
 */
export const ESCAPE_FATIGUE = 0.9;

/**
 * Faults: striking before "three!". Two faults forfeit the round — but only if
 * they land close together. A round can run many chants (escapes, clashes and
 * whiffs all restart it), and without a memory window a single stray twitch per
 * minute would eventually forfeit every long round.
 */
export const FAULTS_TO_FORFEIT = 2;
export const FAULT_MEMORY_CHANTS = 3;

/** Best-of-5: first to 3 round wins takes the match. */
export const ROUNDS_TO_WIN = 3;

/** Minimum swipe distance (fraction of screen height) to register a strike. */
export const STRIKE_SWIPE_FRACTION = 0.045;

/** After a whiff, the striker is exposed for this long — a free window for the opponent. */
export const WHIFF_RECOVERY_MS = 650;

/** How long the resolve screen shows before the next round starts. */
export const RESOLVE_MS = 2200;

/** How long the clash animation plays before the chant replays. */
export const CLASH_MS = 900;

/** Reach easing per frame (0..1). Higher = snappier lunges. */
export const REACH_EASE = 0.22;

/** Reach the winning thumb holds during a pin. */
export const PIN_REACH_PINNER = 1;
/** Reach the pinned thumb is forced back to. */
export const PIN_REACH_PINNED = 0.55;
/** Reach during the strike lunge, before contact resolves. */
export const LUNGE_REACH = 0.85;
