import { GameLoop } from './game/gameLoop';
import { StateMachine } from './game/stateMachine';
import { TouchInput } from './game/input';
import { AiController } from './game/ai';
import { Renderer } from './render/renderer';
import { matchEndButtons, pauseButton, pauseButtons } from './render/hud';
import type { BattleView } from './render/hud';
import type { MenuView } from './render/screens';
import { settingsLayout, stagesLayout, thumbsLayout, titleLayout } from './render/screens';
import { hit, type Rect } from './render/theme';
import { GameAudio } from './audio/audio';
import { GameHaptics } from './audio/haptics';
import { loadSettings, saveSettings } from './data/settings';
import { SaveStore } from './data/save';
import { FOE_SKIN, SKINS, STAGES, VERSUS_STAGE, opponentSkin, skinById } from './game/content';
import { seamY } from './game/geometry';
import type { ChantSpeed, GameMode, Screen, Skin, Stage } from './types';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';

/**
 * Composition root.
 *   StateMachine (pure logic) ← TouchInput and/or AiController
 *   StateMachine events → GameAudio + GameHaptics + particle effects
 * Solo and versus differ only in who drives P2.
 */
async function boot(): Promise<void> {
  // The crate is stacked vertically, so portrait is the only sensible frame.
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
    } catch {
      /* older devices may refuse the lock — the layout still stretches */
    }
  }

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const settings = await loadSettings();
  const save = new SaveStore();
  await save.load();

  const renderer = new Renderer(canvas);
  const sm = new StateMachine(settings.chantSpeed, performance.now());
  const audio = new GameAudio(() => settings.soundEnabled);
  const haptics = new GameHaptics(() => settings.hapticsEnabled);
  const input = new TouchInput(canvas, sm, renderer.toDesign);
  input.setReserved((pt) => hit(pauseButton(renderer.width), pt.x, pt.y));

  let screen: Screen = 'title';
  let mode: GameMode = { kind: 'solo', difficulty: 'contender' };
  let stage: Stage = STAGES[save.data.stageIndex] ?? STAGES[0];
  let ai: AiController | null = null;
  let pressed: string | null = null;
  let helpOpen = false;
  let toast = '';
  let toastUntil = 0;
  let shout = '';
  let shoutUntil = 0;
  let capsEarned = 0;
  let matchRecorded = false;
  /** Match clock is frozen; the pause card is up. */
  let paused = false;
  let pausedAt = 0;
  let skinCursor = Math.max(0, SKINS.findIndex((s) => s.id === save.data.skin));
  let stageCursor = save.data.stageIndex;

  const flash = (text: string, now = performance.now()): void => {
    shout = text;
    shoutUntil = now + 620;
  };
  const say = (text: string): void => {
    toast = text;
    toastUntil = performance.now() + 1800;
  };

  // ---------------------------------------------------------------- battle

  function startMatch(next: GameMode, s: Stage): void {
    mode = next;
    stage = s;
    capsEarned = 0;
    matchRecorded = false;
    input.setMode(next);
    ai = next.kind === 'solo' ? new AiController(sm, 'p2', next.difficulty) : null;
    sm.setLayout(renderer.width, renderer.height);
    sm.startMatch(performance.now());
    screen = 'battle';
  }

  function pause(now = performance.now()): void {
    if (paused || screen !== 'battle' || sm.phase === 'matchEnd') return;
    paused = true;
    pausedAt = now;
  }

  function resume(now = performance.now()): void {
    if (!paused) return;
    paused = false;
    // Every deadline moves forward by however long we were stopped, so
    // the match carries on from exactly where it was.
    const gap = now - pausedAt;
    sm.shiftClock(gap);
    ai?.shiftClock(gap);
  }

  function quitMatch(): void {
    paused = false;
    screen = 'title';
  }

  async function finishMatch(): Promise<void> {
    if (matchRecorded) return;
    matchRecorded = true;
    const won = sm.match.matchWinner === 'p1';
    if (mode.kind === 'solo') {
      capsEarned = won ? stage.reward : 0;
      await save.recordMatch(won, stageCursor, stage.reward);
    }
  }

  sm.on((evt) => {
    const now = performance.now();
    const mid = { x: renderer.width / 2, y: seamY(renderer.height) };
    switch (evt.type) {
      case 'introBeat':
        audio.introBeat(evt.index);
        void haptics.beat();
        break;
      case 'beat':
        audio.beat(evt.beat);
        void haptics.beat();
        break;
      case 'strikeOpen':
        void haptics.strikeOpen();
        break;
      case 'strikeLanded':
        audio.strike();
        renderer.effects.fizz(sm.thumbs[evt.by].pos.x, mid.y, 10);
        break;
      case 'whiff':
        audio.whiff();
        flash('MISS!', now);
        break;
      case 'clash':
        audio.clash();
        void haptics.strikeOpen();
        flash('CLASH!', now);
        renderer.effects.clash(mid.x, mid.y);
        break;
      case 'fault':
        audio.fault();
        void haptics.fault();
        flash('TOO SOON!', now);
        break;
      case 'pinStart':
        audio.pinThud();
        void haptics.pin();
        flash('POW!', now);
        renderer.effects.fizz(sm.thumbs[evt.pinner].pos.x, mid.y, 22);
        break;
      case 'escapeTap':
        audio.escapeTap();
        break;
      case 'escaped':
        flash('FREE!', now);
        renderer.effects.fizz(mid.x, mid.y, 16);
        break;
      case 'roundWon':
        void haptics.pin();
        break;
      case 'matchWon':
        audio.jingle();
        void haptics.celebrate();
        renderer.effects.clash(mid.x, mid.y);
        void finishMatch();
        break;
      case 'forfeit':
        break;
    }
  });

  // ----------------------------------------------------------------- input

  /** Which tappable regions are live on the current screen. */
  function regions(): Record<string, Rect> {
    const w = renderer.width;
    const h = renderer.height;
    if (screen === 'title') {
      const L = titleLayout(w, h);
      // The help card is modal: nothing behind it should be tappable.
      return helpOpen ? { helpClose: L.helpClose } : L;
    }
    if (screen === 'thumbs') return thumbsLayout(w, h);
    if (screen === 'stages') return stagesLayout(w, h);
    if (screen === 'settings') return settingsLayout(w, h);
    if (sm.phase === 'matchEnd') return matchEndButtons(w, h, canAdvance());
    if (paused) return pauseButtons(w, h);
    return { pause: pauseButton(w) };
  }

  function canAdvance(): boolean {
    return (
      mode.kind === 'solo' &&
      sm.match.matchWinner === 'p1' &&
      stageCursor < STAGES.length - 1
    );
  }

  function keyAt(x: number, y: number): string | null {
    const p = renderer.toDesign(x, y);
    const r = regions();
    for (const [key, rect] of Object.entries(r)) {
      if (hit(rect, p.x, p.y)) return key;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock(); // iOS WebView needs a gesture before audio can play
    pressed = keyAt(e.offsetX, e.offsetY);
  });

  canvas.addEventListener('pointerup', (e) => {
    const key = keyAt(e.offsetX, e.offsetY);
    const was = pressed;
    pressed = null;
    if (key && key === was) void activate(key);
  });

  canvas.addEventListener('pointercancel', () => {
    pressed = null;
  });

  async function activate(key: string): Promise<void> {
    if (screen === 'title') {
      if (key === 'solo') {
        stageCursor = Math.min(save.data.cleared + 1, STAGES.length - 1);
        if (stageCursor < 0) stageCursor = 0;
        screen = 'stages';
      } else if (key === 'versus') {
        startMatch({ kind: 'versus' }, VERSUS_STAGE);
      } else if (key === 'thumbs') {
        screen = 'thumbs';
      } else if (key === 'settings') {
        screen = 'settings';
      } else if (key === 'help') {
        helpOpen = true;
      } else if (key === 'helpClose') {
        helpOpen = false;
      }
      return;
    }

    if (screen === 'thumbs') {
      if (key === 'back') {
        screen = 'title';
      } else if (key.startsWith('skin')) {
        skinCursor = Number(key.slice(4));
      } else if (key === 'use') {
        const skin = SKINS[skinCursor];
        if (save.owns(skin.id)) {
          await save.selectSkin(skin.id);
          screen = 'title';
        } else if (await save.unlock(skin.id, skin.cost)) {
          say(`${skin.name} unlocked`);
        } else {
          say(`Need ${skin.cost - save.data.caps} more caps`);
        }
      }
      return;
    }

    if (screen === 'settings') {
      if (key === 'back') {
        screen = 'title';
      } else if (key === 'sound') {
        settings.soundEnabled = !settings.soundEnabled;
      } else if (key === 'haptics') {
        settings.hapticsEnabled = !settings.hapticsEnabled;
        if (settings.hapticsEnabled) void haptics.beat(); // feel it land
      } else if (key === 'leftHanded') {
        settings.leftHanded = !settings.leftHanded;
      } else if (key === 'colorblind') {
        settings.colorblindSafe = !settings.colorblindSafe;
      } else if (key.startsWith('speed:')) {
        settings.chantSpeed = key.slice(6) as ChantSpeed;
        // Takes effect on the next chant. The constructor only reads this
        // once, so without this call the setting would save but never apply.
        sm.setChantSpeed(settings.chantSpeed);
      }
      if (key !== 'back') await saveSettings(settings);
      return;
    }

    if (screen === 'stages') {
      if (key === 'back') screen = 'title';
      else if (key === 'prev') stageCursor = Math.max(0, stageCursor - 1);
      else if (key === 'next') stageCursor = Math.min(STAGES.length - 1, stageCursor + 1);
      else if (key === 'fight') {
        if (stageCursor > save.data.cleared + 1) return;
        const s = STAGES[stageCursor];
        await save.selectStage(stageCursor);
        startMatch({ kind: 'solo', difficulty: s.difficulty }, s);
      }
      return;
    }

    // Battle.
    if (key === 'pause') {
      pause();
      return;
    }
    if (paused) {
      if (key === 'resume') resume();
      else if (key === 'quit') quitMatch();
      return;
    }
    if (sm.phase !== 'matchEnd') return;
    if (key === 'menu') {
      screen = 'title';
    } else if (key === 'rematch' || (key === 'primary' && !canAdvance())) {
      startMatch(mode, stage);
    } else if (key === 'primary') {
      stageCursor = Math.min(STAGES.length - 1, stageCursor + 1);
      const s = STAGES[stageCursor];
      await save.selectStage(stageCursor);
      startMatch({ kind: 'solo', difficulty: s.difficulty }, s);
    }
  }

  // ------------------------------------------------------------- lifecycle

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
    } else {
      // The loop clock kept running while hidden. If we were already paused
      // (by the user) that gap is absorbed on resume; if the match wasn't
      // pausable (menus, match end) there's nothing to shift. Either way the
      // audio context has probably been suspended by the OS — reopen it on
      // the next gesture, which audio.unlock() on pointerdown already does.
    }
  });

  // ------------------------------------------------------------------ loop

  const loop = new GameLoop(
    (now) => {
      sm.setLayout(renderer.width, renderer.height);
      if (screen === 'battle') {
        // The end-of-match card and the pause card each own the screen; stop
        // feeding the state machine so a tap there never lands as a strike.
        input.setLive(sm.phase !== 'matchEnd' && !paused);
        if (!paused) {
          ai?.tick(now); // the computer plays through the same input API you do
          sm.update(now);
        }
      } else {
        input.setLive(false);
      }
      if (now > toastUntil) toast = '';
    },
    (now) => {
      if (screen === 'battle') {
        const view: BattleView = {
          sm,
          settings,
          mode,
          stage,
          skin: skinById(save.data.skin),
          foeSkin: mode.kind === 'versus' ? versusFoeSkin(save.data.skin) : opponentSkin(stage, save.data.skin),
          shout,
          shoutUntil,
          capsEarned,
        };
        renderer.drawBattle(view, now, 16.67, canAdvance(), pressed, paused);
      } else {
        const view: MenuView = {
          save: save.data,
          skinCursor,
          stageCursor,
          settings,
          helpOpen,
          pressed,
          toast,
        };
        renderer.drawMenu(screen, view, now);
      }
    },
  );
  loop.start();
}

/**
 * In two-player mode both thumbs are human, so P2 needs a thumb that is
 * obviously not P1's. Walks a fixed preference order of the free skins and
 * takes the first one P1 is not already wearing.
 */
function versusFoeSkin(p1SkinId: string): Skin {
  const order = ['cherry-bomb', 'root-beer', 'fizzy-fred', 'cream-soda'];
  for (const id of order) {
    if (id === p1SkinId) continue;
    const s = SKINS.find((k) => k.id === id);
    if (s) return s;
  }
  return FOE_SKIN;
}

void boot();
