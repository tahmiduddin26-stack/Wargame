# Doodlebook Battles

A modernised take on Louissi's 2007 Flash game *Age of War*: one horizontal lane,
two gates, five ages between a sharpened rock and an orbital lance. Built for
mobile, landscape only, with real jointed-physics ragdolls.

The interface uses hand-drawn SVG insignias. Battlefield units use procedural
skeletons so character sprites can be added without changing the simulation.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production bundle into dist/
npm run typecheck
```

## Campaign progression and multiplayer

The [final product plan](docs/final-product.md) defines the browser release, current build scope and native/competitive release gates.

The [Android and iOS launch plan](docs/store-launch-plan.md) records the current publishing requirements, readiness decision and remaining release work. Downloadable PNG icons, feature art and real browser screenshot drafts are in the [store artwork pack](assets/store/README.md).

The [mobile game audit and economy plan](docs/mobile-game-audit.md) records the current balance evidence, cosmetic collection, monetisation approach, and release gaps.

Sixteen missions unlock in order. Battle XP still unlocks ages within a match;
commander XP now persists across campaign results and Survival waves. The
Armoury has Supply, Training and Fortification skill branches. Rank opens a
skill, its preceding skill must be fitted, and credits pay for it. Existing
campaign saves recover commander XP from missions already cleared.

To run the browser client and multiplayer server together:

```bash
npm run build
npm run multiplayer   # http://127.0.0.1:8787
```

The server hosts the built client and its WebSocket endpoint. A Vite development
client (`npm run dev`) also connects to port 8787. Set `PORT` and `HOST` for
another listen address; for remote play, host the server on an address both
players can reach and serve it over HTTPS/WSS. If the client is served from
another origin or a native shell, set `VITE_MULTIPLAYER_URL` to its public
`wss://.../ws` endpoint before building. For example, in PowerShell:

```powershell
$env:VITE_MULTIPLAYER_URL='wss://your-game-host.example/ws'
npm run build
```

Online play begins as a guest. **Multiplayer → Commander account** lets you add
a username and password to that same commander, sign in on another device,
change the password, or sign out. Existing ratings, friend codes and friends
are preserved. Passwords require 15–128 characters; use a password manager.
Email password reset is not implemented. Offline campaign saves and cosmetics
remain separate from the online account.

Online profiles, account hashes and finished match results are stored in
`.data/multiplayer.sqlite`. On first start, the server validates and imports
the old `.data/multiplayer.json` without changing it. A damaged source stops
startup instead of silently creating empty profiles. `MULTIPLAYER_DB_FILE`
overrides the database path; `MULTIPLAYER_DATA_FILE` selects the legacy import
source and, if no database override is set, its corresponding `.sqlite` path.
Do not run two game servers against the same database.

Share the six-character
friend code to challenge a friend. Casual battles pair available players;
ranked battles start near the same rating and widen the search across divisions
over time. Rating determines Bronze (under 1,100), Silver (1,100), Gold (1,300),
Platinum (1,500), and Diamond (1,700). Only ranked results change rating or
enter the leaderboard. Every online battle
starts with equal resources, runs at normal speed, and uses the server's
simulation and result. Campaign skills have no effect on online matches.

The lobby shows the last 20 finished online battles, including opponent,
duration, outcome and rating change. Both players' results and ranked rating
changes commit in one database transaction. Match IDs prevent duplicate payouts.
Account operations have limits across connections and bounded asynchronous
password hashing. Public competitive release still needs moderation, recovery
for forgotten passwords and further operational controls.

Brief disconnects now have a 15-second grace window. The authoritative battle
continues, and reconnecting the same guest token restores the same match and
side. Explicit Leave forfeits immediately. If the window expires, the missed
result is held in server memory for up to ten minutes and sent on reconnect.
`RECONNECT_GRACE_MS` may configure 1–60 seconds. Server restart clears live
matches and pending result notifications; saved profiles, accounts and finished
battle records survive. A password sign-in can also rejoin an active match.

## Offline play and save recovery

The production build includes a manifest and a complete versioned offline cache.
After the menu says **Offline ready**, campaign, survival, skills and cosmetics
work without a connection. Settings offers installation where the browser
supports it and explains Add to Home Screen elsewhere. Multiplayer needs the
server. Service workers need HTTPS outside local development
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)).

Settings → **Export backup** downloads a JSON copy of offline progress. Choose
a backup to validate it and preview its rank, clears, credits and paints, then
press **Restore this backup** to replace the device save. Invalid files do not
change progress. The online sign-in token and ranked rating are excluded.

The **Service record** contains twelve medals, offline totals and the last
twenty finished offline battles. Historical clears and survival bests are kept;
new battle totals begin with this update. Survival now has its own debrief with
wave reached, duration, kills/losses, best score and the rewards paid once.

Reduced motion can be enabled in Settings; OS motion preferences also apply.
Rotating out of landscape or backgrounding an offline battle pauses it and
leaves a Resume button on return. Restart deploys a fresh simulation in the
same mode.

## Hosting a browser beta

Use Node 24 or newer. A production build and the server can run from this checkout:

```bash
npm ci
npm run build
npm run typecheck:server
npm run multiplayer
```

For a container host, the included Dockerfile builds and serves the same game:

```bash
docker build -t war-game .
docker run --rm -p 8787:8787 -v war-game-profiles:/data war-game
```

The container template still needs testing on the destination host. Put HTTPS/WSS
in front of the server and keep the `/data` volume in backups. Browser account
forms require a secure context (HTTPS or localhost). Set `ALLOWED_ORIGINS` to a
comma-separated list of exact browser origins if using a separate client host.
The default accepts the same host and local development origins. Behind a trusted
TLS reverse proxy, set `TRUST_PROXY_TLS=1` and have the proxy overwrite
`X-Forwarded-Proto` and `X-Forwarded-For` (a single client IP). This preserves
per-player IP limits instead of limiting all users under the proxy's address.
Restrict direct access to the backend when trusting those headers.

`/health` reports readiness, online players and active matches. Create a
consistent database backup, including any live WAL contents, with:

```bash
npm run backup:online -- .data/backups/online-2026-10-07.sqlite
```

The command refuses to overwrite an existing destination. Use the same database
environment variables as the server. In the container, use `docker exec` to run
`npm run backup:online -- /data/backups/online-2026-10-07.sqlite`.
See [online accounts and operations](docs/online-accounts.md) for restore steps,
data handling and remaining limits. Do not delete the database or legacy source
during an upgrade. Live matches
are in memory, so drain them before restarting the server. Public deployment,
native signing, store billing and public account operations are separate release
gates in the final product plan.

## Checks for this release

With a built client and a local server running, set the test addresses. For the
default server on port 8787, in PowerShell:

```powershell
$env:GAME_URL='http://127.0.0.1:8787/'
$env:MULTIPLAYER_HTTP='http://127.0.0.1:8787/'
$env:MULTIPLAYER_URL='ws://127.0.0.1:8787/ws'
```

```bash
npm run test:progression       # reward guards, save migration, imports and history
npm run test:progression-ui    # service record and real battle restarts
npm run test:offline-save-ui   # backup UI, cached offline play and rotation
npm run test:survival-result-ui # real defeat, debrief, single payout and history
npm run test:cosmetics         # purchase/equip/persistence/rendering
npm run test:multiplayer       # friend/casual/ranked protocol and reconnect
npm run test:multiplayer-ui    # two real browser players, rejoin and ratings
npm run test:online-storage    # migration, transaction rollback, passwords and backup
npm run test:accounts          # isolated server restart and account protocol checks
npm run test:accounts-ui       # phone forms, sign-in, ranked history and sign-out
```

Browser checks use installed Playwright Chromium. `GAME_URL` controls progression,
cosmetics, offline/save and survival checks; their defaults are port 4173 for
progression/cosmetics and 8788 for offline/save/survival. `MULTIPLAYER_HTTP` and
`MULTIPLAYER_URL` control online checks.
Use a separate `MULTIPLAYER_DB_FILE` and legacy `MULTIPLAYER_DATA_FILE` when running tests: they create guest
profiles. Browser screenshots are saved to `.shots/` and excluded from Git.

With the server running, `npm run test:multiplayer` checks the protocol,
matchmaking, friend challenges and ranked results. `npm run
test:multiplayer-ui` drives two browser clients and saves screenshots to
`.shots/`. Set `MULTIPLAYER_URL` and `MULTIPLAYER_HTTP` when testing a different
server address.

Native shells (Capacitor config is already committed):

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android @capacitor/ios
npx cap add android && npx cap add ios
npm run cap:sync
```

## Design system

The interface is a battle notebook: warm dotted paper, loose ink borders, offset
shadows, coloured cutouts and little hand-drawn scenes. The same visual language
carries through the menu, briefing, campaign, roster, armoury, settings, battle
HUD, pause sheet and debrief. The battlefield has bright age-specific skies,
rounded hills, doodled clouds and five distinct fort silhouettes, including a
stone palisade, medieval keep, gunpowder earthwork and modern bunker.

`src/styles/sketch.css` is the theme layer over the shared screen layouts. The
forty equipment insignias are authored SVG paths in `Insignia.tsx`. No generated
bitmap art is used for the interface.

Patrick Hand draws body copy, controls and small labels; Kalam Bold marks major
headings and unit names; JetBrains Mono aligns dense figures. All are self-hosted
for the offline mobile shell. Licences and source links are in
`src/assets/fonts/LICENSES.md`.

Age and difficulty choices appear as paper stickers. The chosen sticker fills
yellow, so selection is readable without relying on a hue change alone. Player
orange and enemy blue are also reinforced by position on the lane strip.

## Colour and colour vision

Friend and foe identification is the entire read of a lane war: which blips are
yours, whose gate meter is whose, which units in the melee to count. That made
the faction palette a correctness problem rather than a taste one.

`scripts/colour-check.mjs` simulates protanopia, deuteranopia and tritanopia
(Vienot 1999 LMS method) and reports CIE76 dE for every pair the game asks a
player to tell apart:

```bash
node scripts/colour-check.mjs
```

The current orange/blue faction pair stays above 60 dE in all three simulated
colour-vision conditions. On the lane strip your blips grow up from the floor
and theirs hang down from the ceiling, so colour is not the only channel. Strong
counter-table values also use a filled cell and heavier weight.

## Motion

`src/styles/motion.css` keeps motion tied to state: controls acknowledge a press,
and the age change remains the one large sequence in a battle.

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

The optional design scan uses [impeccable](https://impeccable.style):

```bash
npx impeccable detect src                      # static scan
CI=1 npx impeccable detect http://127.0.0.1:4173/   # rendered page
```


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

The web manifest requests landscape for installed browser play, and the web
build shows an `OrientationGate` instead of a squashed HUD. Native orientation
must be configured and verified in each generated platform project; the
Capacitor config alone does not lock it. Rotating away mid-match pauses offline
play; online battles continue on the server.

## Architecture

```
src/
  data/            pure data, no imports outside data/. 20 units, 15 emplacements,
                   5 ages, 5 specials, 16 missions
  game/
    config.ts      every designer-facing tunable, with the reasoning
    sim/           BattleSim: headless, fixed-timestep, deterministic (seeded RNG).
                   Knows nothing about Phaser. EnemyCommander drives it through
                   the same public API the player's HUD uses
    render/        RagdollPool, UnitView, BaseView, Backdrop, Fx
  ui/components/   hand-drawn SVG equipment insignias and HUD glyphs
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
  colour-check.mjs simulates colour blindness over the critical colour pairs
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

`src/game/render/skeleton.ts` shares the living and corpse rigs: six-part infantry,
mounted riders and walking mechs, plus five-part wheeled vehicles and siege carts.
The current limb transforms carry across on death, including attacks and enemy mirroring.

`src/game/render/UnitArt.ts` paints hand-authored ink paths into a shared atlas per
army paint. Round faces, hair, helmets, tunics, shields and weapons make all 20
units readable by age and role. Equipment stays attached to its limb without
adding physics bodies. Artwork is cached once and never repainted per frame.
`npm run test:unit-art` exports the complete orange/blue roster and checks all
paints, mirrored death poses, texture margins and corpse recycling.

The pool is hard-capped (22, halved by the "reduced corpses" setting) and recycles
the oldest corpse on overflow.

## Balance, and how it was arrived at

`scripts/sim-harness.ts` runs whole missions headlessly against three scripted
players, because the interesting failures are invisible in a screenshot:

```bash
npx tsx scripts/sim-harness.ts        # all 16 missions x 3 strategies
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

Current Normal-tier state: operations 2-16 resolve in 2.5 to 6 minutes with no
draws. The three scripted plans win 14, 10 and 13 of 16; the first operation
ends in 1:01 to 3:00 depending on the plan. These scripts are crude proxies,
not human win-rate evidence. The
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

**Campaign.** Sixteen missions across four difficulty tiers (Easy / Normal / Hard
/ Insane), as both Age of War games shipped. Tiers multiply the mission's own
enemy numbers rather than replacing them, and never touch the player's side, so a
mission keeps its character at every tier. Clears are recorded per tier, shown as
a four-pip ladder on each row. The normal-tier harness takes 14/16 with the
greedy plan, 10/16 with a swarm, and 13/16 with a mixed line.

**Survival: The Long Watch.** Endless authored waves on one field, no clock. The
enemy has no economy here; a wave is a written composition granted in full and
bought through the sim's ordinary methods, so nothing about combat is
special-cased. Two things had to be fixed before it would end at all, both
documented in `SurvivalDirector`: waves past the queue cap were being silently
discarded, and once the age ladder tops out quantity cannot escalate past the
field cap, so late waves gain compounding **veterancy** instead. Scripted runs now
last about 31 to 33 waves in roughly seven minutes.

**Armoury.** Where credits go. Eight perks, bought once and kept, each one a
single number in the sim. Deliberately small: the whole board is worth about one
difficulty tier, because the campaign is tuned at Normal with an empty armoury.
Army paints are a separate visual-only collection bought with earned credits.
There is no real-money checkout, life meter, timer or advert.

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

**Sixteen missions.** The first four are the onboarding proper: each unlocks one
system and caps the age so you cannot outrun the lesson. From mission 5 the cap
comes off. Six modifiers (sealed emplacements, age cap, glass gates, funded enemy,
aggressive enemy, wide field) recombine across the campaign. Operations 13-16
revisit a capped powder arsenal, an exposed long field, brittle gates, and a
reserve assault without emplacements.

**Field insignias.** Twenty unit, fifteen emplacement, and five special silhouettes
are drawn directly as SVG paths on a shared grid. They describe the actual
equipment in each age and carry through the dock, mount picker, and roster. Combat SFX and
impact effects are procedural; accepted orders, construction, gate debris,
critical structure, and the result cadence have their own feedback.

**Modernisations** over the 2007 original: a mission campaign with modifiers and a
debrief instead of one endless match; a lane overview strip, because a phone cannot
show the whole field and still read it; kills refunding gold so pushes are
self-funding; emplacement roles rather than a straight tier ladder; a mission clock
and visible escalation so nothing grinds forever; and the ragdolls.

## Known gaps

- **Character performance on mobile hardware.** The finished browser character
  drawings share texture atlases; frame-time and memory profiling on the signed
  native builds remain a release gate.
- **Public multiplayer hardening.** Casual, ranked, friends and recoverable
  username/password accounts exist. Forgotten-password recovery, moderation,
  account deletion and stronger operational controls remain release work.
- **Phaser is a 1.2MB chunk** (330KB gzipped). Already split out; worth lazy-loading
  behind the menu if startup time matters.
- Balance beyond mission 5 is tuned against scripted players, not humans.
