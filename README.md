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
  smoke.mjs        Playwright smoke test
```

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
```

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

- **No audio.** No sound effects or music yet.
- **No armoury.** Missions award credits and the store tracks them, but there is
  nothing to spend them on.
- **Phaser is a 1.2MB chunk** (330KB gzipped). Already split out; worth lazy-loading
  behind the menu if startup time matters.
- Balance beyond mission 5 is tuned against scripted players, not humans.
