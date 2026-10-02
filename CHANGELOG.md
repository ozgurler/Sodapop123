# Changelog

Version is set in three places and must agree: `MARKETING_VERSION` in
`ios/App/App.xcodeproj/project.pbxproj`, `versionName` / `versionCode` in
`android/app/build.gradle`, and `version` in `package.json`. The iOS *build*
number is separate and set automatically by CI from the run number.

## 1.1 — October 2026

What's New text for App Store Connect (4000 char max; this is the whole thing):

```
Every crate champ now has their own thumb — Pinky Pete is pink, Ruby Knuckle
is red, Ol' Splinter is root beer, Gold Foil Gus is gold.

The Bottling Room was too hard. Ruby has been retuned, and every stage now
steps up in difficulty instead of jumping. Escaping a pin is a little easier
for younger players, too.

Pause a match from the button at the top of the crate, or quit it. The game
pauses itself if you switch apps mid-match.

New Settings screen: chant speed, haptics, left-handed layout, and a
colourblind-safe mode. Everything stays on your phone.

Fixes: swiping your thumb backward no longer counts as a strike or a fault,
and tapping to escape no longer moves the thumbs around.
```

Internal detail:
- Four AI tiers, one per stage (new `scrapper` tier for stage 2)
- Escape break-even eased from ~5 to ~4.3 taps/sec
- Per-opponent skins via `Stage.opponentSkin`, with a walnut fallback if the
  player wears the same skin
- Pause / resume / quit, with clock shifting so a backgrounded match doesn't
  resolve itself
- Settings screen; `leftHanded` now actually mirrors the HUD
- Input: strikes must move toward the seam; aiming locked to chant/strike
  phases; one clock (`performance.now()`) for input and loop
- Minimum iOS raised to 15.0 (Apple's Spring 2027 requirement)

## 1.0 — September 2026

Initial release.
