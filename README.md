# Age of War // Field Command

A modernised take on Louissi's 2007 Flash game *Age of War*: one horizontal lane,
two gates, five ages between a sharpened rock and an orbital lance. Built for
mobile, landscape only, with real jointed-physics ragdolls.

Placeholder art throughout. Every unit is drawn from a procedural skeleton so
real sprites can be dropped in without touching the rendering pipeline.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production bundle into dist/
npm run typecheck
```

Native shells (Capacitor config is already committed):

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android @capacitor/ios
npx cap add android && npx cap add ios
npm run cap:sync
```

## Design system

The look is a field commander's control panel: warm near-black steel, hairline
rules instead of shadows, condensed stencil-adjacent headings, and every figure
in tabular mono so numbers line up the way a readout does. Sharp corners
throughout, with one flourish (an ochre hazard stripe) reserved for locked and
dangerous things.

Two typefaces are self-hosted in `src/assets/fonts` (latin subsets, variable
weight, 52 KB combined). They are bundled rather than loaded from a CDN because
the game ships in a Capacitor shell with no guaranteed network, and because a
display face that silently falls back to the platform sans is not the design:

- **Oswald** carries the display voice: headings, unit names, buttons, labels.
- **JetBrains Mono** carries every figure, so tabular columns align identically
  on iOS, Android and desktop instead of shifting with whatever mono the platform
  happens to ship.

Licences and rationale: `src/assets/fonts/LICENSES.md`.

Rules that are easy to erode, so they are stated in `src/styles/global.css`:

- **Mono is for figures only.** Gold, reach, damage, timers, mission numbers.
  Using it for prose labels turns it into a costume for "technical", so small
  labels use the condensed display face via `.label`.
- **No label sits above a heading as an eyebrow.** Identifiers such as the
  mission number ride inline on the heading's baseline.
- **No thick coloured border down one edge.** That side-tab is the stock
  AI callout. Emphasis comes from an inset top rule, or from targeting brackets
  (`.bracket`) on the two genuinely primary surfaces.
- **Uppercase is for short labels**, never for headings or body copy.
- **Meters animate a transform, not width**, because they update about twelve
  times a second during a battle and animating width forces layout every frame.

## Motion

The thesis, stated in `src/styles/motion.css`: this is an Operate surface with one
earned focal moment. Motion explains state, acknowledges input and carries
continuity, and everything else stays still.

**The focal moment is the evolve**, because the whole game is a race to it. A
light sweep crosses the dock, the age plate wipes to the new era's accent, and the
roster arrives behind it as a short stagger. That stagger is the one place a
sibling sequence is honest here: the roster genuinely becomes a different list.

**The most useful animation is the least showy one.** The lane strip is fed about
twelve samples a second while units move at sixty, so every blip used to visibly
teleport. They now interpolate over exactly one snapshot interval, which turns a
stuttering readout into a battle you can read.

Supporting motion, all of it tied to state:

- Gold eases toward its value and tints in the direction it moved, so a large
  payment feels different from a small one.
- Gate meters carry a trailing ghost bar that catches up half a second later, so
  the gap is how much that hit took.
- The special blooms once when it comes off cooldown; the evolve button breathes
  for as long as the option is live, because it is the most consequential
  decision in a match and easy to miss mid-fight.
- Buttons acknowledge the press themselves rather than waiting for the sim.

Rules it holds to: compositor properties only (a 60fps canvas is running
underneath), 100-150ms for feedback up to 700ms for the focal sequence, exits
faster than entrances, deceleration rather than bounce, and nothing loops that is
not communicating a live state. `prefers-reduced-motion` removes all of it.

`scripts/motion-probe.mjs` verifies this in a browser, because a screenshot
cannot show motion. It asserts that blips take several intermediate positions
between samples, that **no element in the HUD transitions a layout-driving
property**, that the evolve sequence actually fires, and that reduced motion is
honoured. Its first run caught three real defects: two lane bands were
transitioning `width`, and the reduced-motion block was losing the cascade to
`hud.css` because `motion.css` was imported before it.

The design is checked with [impeccable](https://impeccable.style), whose detector
runs 58 deterministic anti-pattern rules:

```bash
npx impeccable detect src                      # static scan
CI=1 npx impeccable detect http://127.0.0.1:4173/   # rendered page
```

Its first run on this UI found eight issues: a hero eyebrow chip above the title,
three runs of all-caps body text, four failing contrast pairs at 3.3:1, and a
width transition. Both scans are clean now. A clean scan is not proof the design
is good, but every finding it had was real.

## Why this stack

**React + TypeScript + Vite** for the shell and HUD, **Phaser 3 + Matter.js** for
the battlefield, **Capacitor** to ship it as a native app.

- Matter.js gives real constraint-based ragdolls. That was the hard requirement,
  and it is the reason for Phaser over a hand-rolled canvas loop.
- Menus, tables and touch targets are DOM, not canvas. Text stays crisp at any
  DPI with no font atlas, and the roster screen can be a real `<table>`.
- One web codebase runs in a browser and in a native shell. Unity or Godot would
  be defensible, but neither buys anything here that offsets losing that.

## Why landscape only

Not a style choice. Age of War is a single horizontal lane and *reach* is the core
mechanic: you need to see that your trebuchet covers 320m and theirs does not,
where your front line has stalled, and how far a push is from your gate. In
portrait you get about a third of the readable lane, which forces either a
zoomed-out camera nobody can read on a phone, or a vertical lane, which is a
different game.

So landscape is locked in the Capacitor config, and the web build shows an honest
`OrientationGate` instead of a squashed HUD. Rotating away mid-match pauses rather
than losing it.

## Architecture

```
src/
  data/            pure data, no imports outside data/. 20 units, 15 emplacements,
                   5 ages, 5 specials, 12 missions
  game/
    config.ts      every designer-facing tunable, with the reasoning
    sim/           BattleSim: headless, fixed-timestep, deterministic (seeded RNG).
                   Knows nothing about Phaser. EnemyCommander drives it through
                   the same public API the player's HUD uses
    render/        RagdollPool, UnitView, BaseView, Backdrop, Fx
    scenes/        BattleScene: owns the Matter world, translates sim events
                   into ragdolls and effects
    bridge.ts      the only seam between Phaser and React
  ui/              React screens and the battle HUD
  state/           zustand store, persisted to localStorage
scripts/
  sim-harness.ts   headless balance harness (see below)
  smoke.mjs        Playwright smoke test: menu, briefing, a real mission
  modes.mjs        Survival, Armoury, difficulty ladder and the roster
  motion-probe.mjs asserts the UI motion interpolates and stays off layout
```

`PLAN.md` records what the build-out set out to do and why, including what the
research changed.

### The React/Phaser seam

Commands go down a queue, a throttled snapshot comes back up (12.5Hz). React never
reaches into the scene and the scene never touches React state, so the 60fps sim
stays off React's render path.

### How the ragdolls work

Living units are **not** physics bodies. Simulating dozens of constrained ragdolls
on a mid-range phone is not viable, and full physics would make combat
non-deterministic. Instead the sim is kinematic, and a unit converts into a real
jointed Matter ragdoll **at the instant it dies**, inheriting its position, facing,
mid-stride limb angles, and the force of the blow that killed it. Overkill throws
the corpse further; blast and energy damage add lift; specials apply a shockwave to
corpses already on the ground.

`src/game/render/skeleton.ts` holds one rig used by both the living unit and its
corpse, so the ragdoll appears in exactly the pose the unit was standing in. Two
rigs exist: a six-bone humanoid, and a five-part chassis for vehicles and mounts,
which shed a hull and wheels rather than limbs.

Every bone renders a tinted quad or disc, so the whole corpse layer batches into a
couple of draw calls. **To drop in real art**, set `texture` on the bone specs; the
physics, joints and pooling do not change.

The pool is hard-capped (22, halved by the "reduced corpses" setting) and recycles
the oldest corpse on overflow.

## Balance, and how it was arrived at

`scripts/sim-harness.ts` runs whole missions headlessly against three scripted
players, because the interesting failures are invisible in a screenshot:

```bash
npx tsx scripts/sim-harness.ts        # all 12 missions x 3 strategies
npx tsx scripts/sim-harness.ts 6      # one mission, verbose timeline
TIER=insane npx tsx scripts/sim-harness.ts   # the same, at a difficulty tier
```

It also probes Survival, reporting how many waves each plan holds before the gate
falls.

The first run of it found that **every single mission ground to a draw at the eight
minute mark with both gates untouched.** Diagnosing that drove most of the design:

- **Time to kill was far too long.** Same-age melee took ~6s to kill each other, so
  neither side could ever clear the other's front line. Now ~2.2s, which is what
  lets a numbers or age advantage compound into a push.
- **Passive income was funding the stalemate.** Trickle alone bought a unit per
  second, so both sides could hold a full wall forever. Income is now small and
  kills are the real economy (loot ≈ 0.65x a unit's cost).
- **Emplacement *reach* was pinning the front line to the centre of the map.** Four
  invulnerable turrets covering half the lane made any push impossible. Their reach
  now covers only the gate approach. Cutting their damage instead made things worse
  and was reverted.
- **A lane war between two competent commanders is a genuinely stable equilibrium.**
  Pushing forward shortens the defender's reinforcement walk and moves the fight
  under their guns, which is a restoring force toward the midpoint. No amount of
  tuning removes that, so missions have a **clock**: at zero the match is decided on
  gate integrity, then on ground held. Income also escalates to 2.5x over the
  match, shown in the HUD rather than hidden.
- **Long enemy warmups were a trap.** A 9-second warmup let the player's opening
  wave walk unopposed all the way into the enemy gate, the worst ground on the map,
  and die there for nothing: 22 kills against 250 losses, then no XP to recover
  with. Warmups are now short enough that first contact lands near the midpoint.
  Mission 1 keeps a long one deliberately, so the tutorial is a clean early win.
- **Evolving stripped your emplacements**, which made ageing up a losing move and
  lost mission 3 under every strategy. Emplacements now upgrade themselves in place,
  matching the original, which is why its strategy guides say to fill your mounts
  *before* you age up.

Current state: every mission resolves in 2.5 to 5.5 minutes with no draws, and
depending on strategy the scripted players win 5 to 9 of 12. Mission 1 is a
decisive win in about 40 seconds. The scripted players are crude proxies and a real
person adapts far better, so treat those win rates as a floor, not a target. The
numbers live in `src/data/` and `src/game/config.ts`; `scripts/retune-units.mjs`
documents the last bulk pass.

## Verifying it in a browser

```bash
npm run build
npx vite preview --port 4173 &
node scripts/smoke.mjs          # screenshots into .shots/
```

It walks the menu, briefing and a real mission, then asserts the ragdoll pool
actually produces and recycles corpses. Corpse and Matter body counts live on the
canvas and are invisible to the DOM, so `BattleScene` exposes read-only counters on
`window.__aow` for exactly this.

## Modes and systems

**Campaign.** Twelve missions across four difficulty tiers (Easy / Normal / Hard
/ Insane), as both Age of War games shipped. Tiers multiply the mission's own
enemy numbers rather than replacing them, and never touch the player's side, so a
mission keeps its character at every tier. Clears are recorded per tier, shown as
a four-pip ladder on each row. Measured with the harness: a competent scripted
plan takes 11/12 on Easy, 9/12 on Normal and 5/12 on Insane.

**Survival: The Long Watch.** Endless authored waves on one field, no clock. The
enemy has no economy here; a wave is a written composition granted in full and
bought through the sim's ordinary methods, so nothing about combat is
special-cased. Two things had to be fixed before it would end at all, both
documented in `SurvivalDirector`: waves past the queue cap were being silently
discarded, and once the age ladder tops out quantity cannot escalate past the
field cap, so late waves gain compounding **veterancy** instead. A run now lasts
25 to 30 waves in about six minutes.

**Armoury.** Where credits go. Eight perks, bought once and kept, each one a
single number in the sim. Deliberately small: the whole board is worth about one
difficulty tier, because the campaign is tuned at Normal with an empty armoury.
No levels, no currencies to convert, no timers, no adverts.

**Counters.** See below. This is the deepest change of the build-out.

## Counters and armour

Three armour classes and a damage-kind multiplier table, so the four roles
counter each other instead of being cost tiers:

| | flesh | plate | hull |
|---|---|---|---|
| **impact** blunt, hooves, small arms | 1.10 | 0.60 | 0.50 |
| **pierce** arrows, AP, shaped charges | 0.85 | 1.35 | 1.15 |
| **blast** high explosive, splash | 1.15 | 0.90 | 0.70 |
| **energy** rail, ion, plasma | 1.00 | 1.20 | 1.45 |

Assignment is by role and holds across all five ages, so it is learned once:
melee `impact`, ranged `pierce`, artillery `blast`, and armour follows the body.
That reproduces the relationship the sequel's own guides describe ("Dino Riders
are weak to Slingers", anti-armour troops answering heavies) rather than
inventing one. Before this existed, `damageKind` was decorative: four flavours of
damage that all resolved identically.

The table is shown in the roster rather than hidden, because "why did my clubmen
bounce off that knight" is the single most important thing to understand about a
fight, and it is not inferable from cost and reach.

Two things this pass got wrong first, both caught by the harness:

- The AI sorted purchases by counter multiplier, which made it buy the best
  *matchup* rather than the best *unit*, pouring gold into fragile artillery
  whenever the player fielded infantry. Cost has to stay the dominant term
  because only the front ranks can reach each other. Fixed by scoring
  `cost x counter`.
- The first table averaged 1.11 against flesh. Most units in the game are
  unarmoured, so it quietly inflated all damage rather than redistributing it and
  every strategy's win rate jumped. The flesh column now averages ~1.0: the
  spread is what matters, not the level.

## Audio

No sample assets. Every sound is synthesised at runtime through the Web Audio API
from noise, oscillators, filters and envelopes, which the research confirmed as
the standard no-asset approach. It costs zero payload, varies naturally shot to
shot instead of repeating one clip forty times a minute, and is driven directly by
sim values: blast radius sets the size of a detonation, damage kind picks the
timbre, and camera position sets the pan.

Three things keep it from becoming noise, all in `src/game/audio/Audio.ts`: voice
limiting (a concurrency cap and a per-category minimum gap, because one frame can
produce a dozen deaths plus a whole barrage), panning from the camera, and an
unlock gated on the first real gesture, since browsers suspend audio contexts
created without one.

The music is a drone rather than a tune: two detuned oscillators a fifth apart
through a slow filter sweep. Its root transposes on evolve, and its cutoff opens
as the enemy front line closes on your gate.

## What is in the game

**Five ages** (Stone, Medieval, Gunpowder, Modern, Future), gated on banked XP,
which is never spent. Each age brings four units, three emplacements, a free
special attack, and a tougher gate.

**Four unit roles, in the same order in every age**, so muscle memory survives an
evolve: the card you tap for a Clubman is the card you tap for an Exo Trooper.

| role | job |
| --- | --- |
| front | cheapest gold per hitpoint, has to close the gap |
| ranged | outranges melee, folds when anything reaches it |
| heavy | the push. Expensive, knocks the enemy line backwards |
| artillery | outranges emplacements, splash, dies to a stiff breeze |

**Four emplacement mounts** on the gate, two free and two bought, in rapid /
marksman / mortar flavours. They upgrade themselves on evolve.

**Twelve missions.** The first four are the onboarding proper: each unlocks one
system and caps the age so you cannot outrun the lesson. From mission 5 the cap
comes off. Six modifiers (sealed emplacements, age cap, glass gates, funded enemy,
aggressive enemy, wide field) recombine across the campaign.

**Modernisations** over the 2007 original: a mission campaign with modifiers and a
debrief instead of one endless match; a lane overview strip, because a phone cannot
show the whole field and still read it; kills refunding gold so pushes are
self-funding; emplacement roles rather than a straight tier ladder; a mission clock
and visible escalation so nothing grinds forever; and the ragdolls.

## Known gaps

- **Real art.** Still procedural placeholder rigs. The skeleton spec has a
  `texture` slot per bone for when sprites arrive.
- **Versus / multiplayer.** The sim is deterministic and seeded, so it is
  reachable, but netcode is its own project.
- **Phaser is a 1.2MB chunk** (330KB gzipped). Already split out; worth lazy-loading
  behind the menu if startup time matters.
- Balance beyond mission 5 is tuned against scripted players, not humans.
