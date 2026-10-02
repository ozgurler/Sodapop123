# Soda Pop 1, 2, 3 — Thumb War Version

A two-player, one-device thumb war built on the schoolyard chant "Soda Pop, one, two,
three!" Fully offline. **Portrait**. Capacitor 7 + TypeScript + HTML5 canvas, targeting
Google Play and the App Store.

## How it plays

The screen is a crate lid with a seam across the middle and a bottle-hole on each side.
Your thumb pushes up through the bottom hole; your opponent's comes up through the top.

1. **Round intro** — "1, 2, 3, 4 — I declare a thumb war!" Once per match.
2. **Chant** — six beats: *So · da · Pop · 1 · 2 · 3!* Slide sideways to line your thumb
   up with your opponent's. The guide between the tips turns solid gold when you're in
   range and stays dashed red when you're not.
3. **Strike** — on "3!", swipe toward the seam. A strike only pins if the thumb tips
   actually overlap; miss and you **whiff**, leaving yourself open to a counter until you
   recover. Two aligned strikes within 80ms clash and the chant replays. The window does
   **not** time out: once the chant has been said, the standoff runs until someone lands
   a pin. The chant is re-counted for the next attempt, which a clash, an escape or a
   round win all trigger.
4. **Pin** — your thumb presses down across theirs. The trapped player taps their own
   half to fill the FREE gauge before the PIN gauge fills. About 6 taps/sec breaks out;
   each escape you use in a round raises the bar for your next one, so a round always
   resolves rather than stalemating.
5. Best of 5. Striking early is a fault; two faults within three chants forfeit the round.

Two players share the crate — bottom half is P1, top half is P2. In one-player mode the
whole screen is yours and the computer drives the top thumb through the same input API.

## Screens

`title` → `thumbs` (cosmetics) → `stages` (one-player only) → `battle` → result card,
plus a `settings` screen off the title. Two-player skips the stage picker and drops
straight into a neutral crate.

A match can be paused from the button at the top of the crate (Resume / Quit match), and
it pauses itself when the app goes to the background. Resuming shifts every pending
deadline forward by however long the game was stopped — without that, a phone call
mid-pin came back as an instant round loss and every chant beat firing at once.

Winning a stage pays **bottle caps**, which unlock thumb skins. Caps are earned in-game
only: no purchases, no currency top-ups, no network. That keeps the under-13 store
listing clear of in-app-purchase disclosures.

## Quick start

```bash
npm install
npm run dev          # play in the browser (Chrome device mode, portrait)
npm run build        # type-check + production bundle → dist/
npm run preview      # render every screen to preview/*.png for layout review

# Native shells (first time)
npx cap add ios
npx cap add android

npm run cap:ios      # build, sync, open Xcode
npm run cap:android  # build, sync, open Android Studio
```

### TestFlight, with no Mac

`npx cap add ios` and `npx cap sync ios` don't touch Xcode or CocoaPods — they're just
file copying, and both already ran once to generate the `ios/` project committed here.
The two steps that genuinely need a Mac are `pod install` and `xcodebuild`. Rather than
buy one, `.github/workflows/ci.yml` runs those on GitHub's own macOS runner and pushes
straight to TestFlight via Fastlane, triggered manually from the Actions tab (`CI` →
`Run workflow`) — not on every push, since a TestFlight upload is worth a deliberate
click.

Signing is automatic: `xcodebuild -allowProvisioningUpdates` plus an App Store Connect
API key creates and refreshes the certificate and provisioning profile itself, so
there's no `fastlane match` repo and no `.p12` file to keep in sync.

`ios/App/fastlane/` sits as a sibling of `App.xcodeproj`, not at `ios/fastlane/` — that
placement isn't cosmetic. Fastlane treats the parent of wherever `fastlane/` lives as
the project root, and every path in the `Fastfile` (`"App.xcodeproj"`,
`"App.xcworkspace"`) is a bare filename resolved against that root. Move the folder
without updating the CI job's `working-directory: ios/App` (or vice versa) and the
build fails with "Could not find Xcode project" even though both files clearly exist.

The generated Xcode project also has no `DEVELOPMENT_TEAM` set — Capacitor can't know your team ID
at project-generation time, and `team_id()` in the `Appfile` only scopes Fastlane's own API calls,
not the actual `xcodebuild` archive step. The `Fastfile` passes it in explicitly via `xcargs`,
reading the same `ASC_TEAM_ID` secret used everywhere else, which is what lets automatic signing
pick a team to request a certificate and profile for.

One-time setup, all in the *existing* App Store Connect account:

1. **App Store Connect → Users and Access → Integrations → App Store Connect API →
   Generate API Key.** Role: *App Manager*. Download the `.p8` — Apple only shows it
   once.
2. **App Store Connect → My Apps → +** → register the bundle ID
   (`com.emre.sodapop123`, or whatever you changed it to in
   `capacitor.config.ts` + `ios/App/App.xcodeproj`) if it isn't registered yet.
3. In the GitHub repo, **Settings → Secrets and variables → Actions**, add:

   | Secret | Value |
   |---|---|
   | `ASC_KEY_ID` | the Key ID shown next to the key you generated |
   | `ASC_ISSUER_ID` | the Issuer ID at the top of the same API Keys page |
   | `ASC_KEY_CONTENT` | `base64 -i AuthKey_XXXX.p8 \| pbcopy` (or `base64 -w0` on Linux) — the whole encoded file, not the raw `.p8` |
   | `ASC_TEAM_ID` | Apple Developer account → Membership → Team ID |
   | `ASC_BUNDLE_ID` | `com.emre.sodapop123` |

4. Actions tab → **CI** → **Run workflow** → pick `main`. The `ios-testflight` job takes
   a few minutes; when it finishes, the build shows up under App Store Connect →
   TestFlight, already processed for internal testers (no Beta App Review needed for
   those).

Every upload needs a higher build number than the last; the lane sets it to the CI run
number automatically, so re-running the workflow is always safe.


`main.ts` locks orientation at runtime via `@capacitor/screen-orientation`, but lock the
native projects too so the splash doesn't flash sideways (Xcode: Deployment Info →
portrait only; Android: `android:screenOrientation="portrait"` on the activity).

## Architecture

```
src/
├── main.ts                 Composition root — screens, input routing, wiring
├── types.ts                Shared types
├── game/                   PURE LOGIC — no canvas, no Capacitor, no DOM
│   ├── constants.ts        Every tunable number (beat timing, meters, fatigue)
│   ├── geometry.ts         Crate/thumb anatomy — hitbox derives from drawn width
│   ├── content.ts          Skins, stages, opponents
│   ├── stateMachine.ts     intro → chant → strike → clash/pin → resolve → matchEnd
│   ├── gameLoop.ts         60fps rAF loop
│   ├── input.ts            Multi-touch adapter; zone-claiming = palm rejection
│   └── ai.ts               Computer opponent — attack, dodge, and pin escape
├── render/
│   ├── renderer.ts         Design-space scaling + screen routing, DPR-aware
│   ├── theme.ts            Design tokens and the chunky-block primitives
│   ├── crate.ts            ★ PLACEHOLDER ART — crate, holes, thumbs; swap here
│   ├── screens.ts          Title, thumb picker, stage select
│   ├── hud.ts              Battle HUD, gauges, overlays, result card
│   └── effects.ts          Soda-fizz particles on a fixed pool
├── audio/
│   ├── audio.ts            ★ PLACEHOLDER AUDIO — Web Audio synth, swap for VO/foley
│   └── haptics.ts          Capacitor Haptics wrapper + web vibration fallback
└── data/
    ├── settings.ts         Chant speed, left-handed, colourblind-safe, sound/haptics
    ├── save.ts             Caps, unlocked skins, cleared stages
    └── profiles.ts         Local win/loss stats via Capacitor Preferences
```

**Design contract:** game logic emits events (`introBeat`, `beat`, `strikeLanded`,
`clash`, `pinStart`, `matchWon`, …); audio, haptics, and particles subscribe. The
renderer only *reads* state.

### Design space

Every screen is authored against a fixed **402 × 874** canvas and uniformly scaled to the
device, so the mockup's spacing survives every phone. Vertical layout stretches: screens
anchor content to the top and bottom rather than assuming 874px. Pointer coordinates are
converted to design space by `Renderer.toDesign` before the state machine ever sees them.

## Swapping placeholder assets

- **Art:** replace the bodies of `drawCrate` / `drawHole` / `drawThumb` in
  `src/render/crate.ts` with sprite rendering. Signatures are the contract.
- **Audio:** replace the synth methods in `src/audio/audio.ts` with `AudioBuffer`
  playback. Keep `unlock()` — iOS WebView requires a gesture before audio.

## App icon & splash

Both are rendered from the game's own art primitives (`scripts/make-icon.ts` and
`scripts/make-splash.ts`) rather than hand-drawn separately, so they can't drift from
what the app actually looks like. Regenerate after an art change:

```bash
npm run icons   # re-renders the sources, then writes every iOS + Android size
```

`assets/icon.png` (1024×1024, full bleed — iOS masks its own corners, so no
transparency or radius is baked in) and `assets/splash.png` (2732×2732) are the sources;
everything under `ios/App/App/Assets.xcassets` and `android/app/src/main/res` is
generated output, safe to delete and regenerate, and does not need hand-editing.

## Fonts

Baloo 2 (display) and Nunito (UI) are **bundled** in `public/fonts`, not fetched from
Google Fonts — the game has to work with no network. Both are SIL OFL. The subsets cover
Latin only, so UI icons (stars, the note, chevrons) are drawn as vector paths in
`theme.ts` rather than typed as glyphs; a glyph outside the subset would silently fall
back to the system face and look pasted in.

## Testing and balance

```bash
npm test                 # headless logic suite
npx tsx test/escape.ts   # tap rate needed to break a pin
npx tsx test/tune.ts     # difficulty sweep vs scripted human profiles
npm run preview          # visual check — renders all screens to PNG
```

`test/harness.ts` runs the state machine against a fake clock with a seeded RNG, so AI
scenarios are reproducible. `test/tune.ts` plays 80 matches per tier against three
scripted opponents — each with its own reaction time, tap rate, and fault rate, since a
script that never jumps the gun makes the fault rule a one-sided penalty on the AI. It
flags stalemates loudly: an unresolvable round is a design bug, not a draw. Current
results, unchanged by the portrait rework:

| tier | stage | vs sharp (260ms) | vs average (360ms) | vs casual (480ms) |
|------|------|------|------|------|
| Rookie | 1 The Corner Store | 100% human | 100% human | 89% human |
| Scrapper | 2 The Bottling Room | 100% human | 100% human | 55% human |
| Contender | 3 The Loading Dock | 100% human | 100% human | 31% human |
| Champ | 4 The Rooftop Cooler | 100% human | 48% human | 0% human |

"Casual" (480ms, 4.5 taps/sec) is the closest profile to a 7–10 year old, and the one the
curve is shaped around: stage 2 winnable about half the time, stage 3 a stretch, champ is
for the adults. "Sharp" is an optimal script and clears everything; that's fine for a
family party game. Before this retune, stages 2 and 3 shared the Contender tier and the
Bottling Room beat the average profile 91% of the time.

These are scripted opponents with perfect aim, not people. Champ in particular is brutal
against a machine and needs real playtesting before launch — treat `TUNING` in
`src/game/ai.ts` as the dial and re-run the sweep after changes.

`npm run preview` renders every screen headlessly. It caught two bugs the type-checker
could not: the thumb capsule was capping the wrong way (flat tips, no round end) and the
fingernails were drawn outside the thumb entirely.

## Accessibility & settings

All reachable from the gear on the title screen, all saved on-device:

- Chant speed: slow / normal / fast (`constants.ts` → `BEAT_MS`). Applies from the
  next chant — `StateMachine.setChantSpeed`, since the constructor only reads it once.
- Left-handed layout mirrors every edge-anchored HUD element (name pills, round pill,
  PIN/FREE gauges), so the thumb holding the phone isn't covering what it needs to read
- Colourblind-safe mode adds shape badges (circle = P1, triangle = P2) on top of an
  already CVD-friendly palette, and the alignment guide changes *shape* (solid vs dashed)
  as well as colour
- Haptics and sound individually toggleable
- Every control is 56px+ on its short edge

## iOS deployment target

Set to **15.0** in both `ios/App/Podfile` and `ios/App/App.xcodeproj` — the two have to
agree or CocoaPods and the app target disagree at build time. Capacitor generates 14.0,
which Apple warns about (ITMS-90068) and refuses outright from Spring 2027. Nothing in
this game needs an API newer than 14, so raising it costs nothing; iOS 15 covers
essentially every device still in use.

## Input rules worth knowing

- A strike is a swipe **toward the seam** — up for P1 at the bottom, down for P2. Pulling
  the thumb back is neither a strike nor, during the chant, a fault. (It used to be both.)
- Thumbs can only be aimed during the chant and strike phases. During a pin, escape taps
  count but don't move anything — previously each tap teleported the trapped thumb, and
  the pinner drawn on top of it, to wherever the finger landed.
- Input timestamps come from `performance.now()` inside the pointer handler: later than
  the event itself by well under a millisecond, but on the same clock as the game loop.
  `event.timeStamp` isn't guaranteed to share that clock on every WebView, and a mismatch
  silently breaks every timer comparison in the state machine.

## Notes

- No network calls anywhere; settings, progress and profiles live on-device via Capacitor
  Preferences.
- `devicePixelRatio` is capped at 2 to hold 60fps on mid-range hardware.
- Each solo opponent has their own thumb, matched to their name (Pinky Pete is pink, Ruby
  Knuckle red, Ol' Splinter root-beer, Gold Foil Gus gold) via `Stage.opponentSkin`. If
  the player happens to be wearing the same skin, the opponent falls back to the neutral
  walnut so the two thumbs are never identical.
- In two-player mode both thumbs are named and coloured from the skins in play — P2 gets
  a contrasting free skin, and their name pill is rotated for the player holding the far
  end of the phone.
- Skins are **cosmetic only**. The mockup floated a stat perk per thumb; the difficulty
  sweep balances on a single dial, and eight perk multipliers would make every tier
  reading meaningless. The data model has room for perks once the base tiers hold up.
- The name intentionally avoids the "Pepsi" trademark; the chant is the public-domain
  playground version, and none of the art references a real cola's trade dress.
