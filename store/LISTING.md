# App Store listing — Soda Pop 1, 2, 3

Copy-paste source for App Store Connect. Character limits are Apple's.

---

## Name (30 max)

```
Soda Pop 123: Thumb War
```

*23 chars. The bundle ID and App Store Connect record already say "Soda Pop 123"; adding
"Thumb War" makes the listing searchable for the thing people actually look for.*

## Subtitle (30 max)

```
Two thumbs, one crate, no ads
```

*29 chars. "No ads" earns its place — parents scan for it.*

## Promotional text (170 max, editable without review)

```
Slide, wait for the chant, and pin your opponent's thumb. Play a friend on one phone or take on the crate champs. No ads, no purchases, works offline.
```

## Description (4000 max)

```
The playground thumb war, with a soda crate in the middle.

Two thumbs push up through the bottle-holes in a wooden crate lid. Slide yours side to
side to line up while the chant counts down — "So-da Pop, one, two, three!" — then swipe
on "3!" to strike. Land it and you pin them. Miss and you're wide open for a beat.

Pinned? Hammer your half of the screen to break free before the PIN gauge fills. Every
escape tires your thumb, so the next one is harder. Rounds always resolve. Best of five
takes the crate.

TWO PLAYERS, ONE PHONE
Lay the phone flat between you. Bottom half is yours, top half is theirs. No second
device, no Wi-Fi, no accounts — just two thumbs and a phone on a table.

PLAY THE CRATE CHAMPS
Four stages, from the sticky counter of The Corner Store to the Rooftop Cooler. Each has
an opponent who fights back: they track your thumb, dodge to spoil your aim, and mash
their way out of your pins. Rookie is gentle. Champ is not.

EARN BOTTLE CAPS
Win matches, collect caps, unlock eight thumbs — Cherry Bomb, Lime Rickey, Grape Ape,
Gold Foil and more. Caps are earned by playing. They can't be bought, because there's
nothing to buy.

BUILT TO BE FAIR
• No ads, ever
• No in-app purchases
• No accounts, no sign-in
• No internet connection required — it all runs on your phone
• Nothing is collected about you or your device

PLAYS THE WAY YOU DO
Chant speed slow, normal or fast. Left-handed layout. Colourblind-safe mode that changes
shapes as well as colours. Sound and haptics each toggle on their own.

Grab someone and settle it.
```

## Keywords (100 max, comma-separated, no spaces)

```
thumb,war,2player,twoplayer,local,multiplayer,party,kids,family,duel,reflex,offline,soda,arcade,couch
```

*99 chars. Don't repeat words from the app name — Apple already indexes those.*

## Support URL

```
https://ozgurler.github.io/Sodapop123/
```

## Privacy Policy URL

```
https://ozgurler.github.io/Sodapop123/privacy.html
```

*Published automatically by the CI workflow — see `scripts/bundle-demo.mjs`.*

## Category

Primary: **Games → Family**
Secondary: **Games → Action**

*Family fits the audience and is less crowded than Action alone.*

---

# Submission checklist

## iPad support — decide this first

The game is a portrait phone layout and has no iPad-specific design. Two options:

- **Turn off iPad in App Information → General Information** (recommended). This removes
  the iPad screenshot requirement entirely — nothing to upload, nothing to explain.
- **Leave iPad enabled.** Capacitor apps run on iPad by default via letterboxing, so
  nothing crashes — but the play area sits in the middle of the screen with large dark
  bars either side. Screenshots for this are in `store/screenshots-ipad/`, generated to
  show exactly that, since Guideline 2.3 requires screenshots to reflect the real app.

## In App Store Connect

- [ ] **iPhone screenshots** — upload all 7 from `store/screenshots/` (1284×2778 — one of
      the sizes App Store Connect's iPhone slot accepts for this listing). Order matters:
      most people only look at the first three.
- [ ] **iPad screenshots** — only required if iPad support is enabled (see the note
      above). Upload all 7 from `store/screenshots-ipad/` (2064×2752, the 13" class).
      These show the real letterboxed layout — the game is portrait-phone-shaped and was
      never designed for iPad's wider screen, so dark bars appear on both sides. That is
      genuinely how the shipping app looks on that size, not a rendering mistake.
- [ ] **Description, keywords, subtitle, promo text** — from above
- [ ] **Support URL and Privacy Policy URL** — from above
- [ ] **Age Rating** questionnaire — answer everything "None". The result should be 4+.
- [ ] **App Privacy** → "Data Not Collected". Accurate: no analytics, no network calls.
- [ ] **Pricing** — Free (or set a price; see the note below)
- [ ] **Build** — select the one from TestFlight
- [ ] **Export compliance** — already answered by `ITSAppUsesNonExemptEncryption` in
      Info.plist, so this shouldn't be asked

## Before you hit Submit

- [ ] Play it on a real phone, both one- and two-player
- [ ] Check nothing is hidden behind the notch or home indicator
- [ ] Confirm progress survives a force-quit
- [ ] Replace the contact email in `store/privacy.html` (it currently says
      `REPLACE@WITH.YOUR.EMAIL`) and push, so Pages republishes it

## Things that commonly cause rejection

**Kids Category.** Only opt in if you want it. It brings stricter requirements, and
"Family" as a category is not the same thing as the Kids Category. Since the app collects
nothing and has no ads or links, either is defensible — the plain listing is simpler.

**Screenshots must show the actual app.** These are rendered from the game's own drawing
code, so they match what ships exactly. Don't add mocked-up features.

**Demo account.** Not needed — there's no login.

**Review notes.** Worth adding: "Two-player mode is played by two people on one device;
the bottom half of the screen controls one thumb and the top half the other." A reviewer
testing alone might otherwise think the top half is unresponsive.

---

# Regenerating these assets

```bash
npm run screenshots   # re-renders both store/screenshots/ (iPhone) and
                       # store/screenshots-ipad/ (iPad, letterboxed) at their
                       # exact required pixel sizes
npm run demo          # rebuilds the demo site + privacy.html
```

Both draw from the game's own code, so they can't drift from what actually ships.
