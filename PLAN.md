# Build-out plan

Where the game stood before this pass: a complete 12-mission campaign, 5 ages,
20 units, 15 emplacements, specials, ragdolls, and the full screen set. Playable
end to end, but missing several things that separate "a working prototype" from
"the whole game".

## What the research changed

Sources: the original's community guides and the Age of War 2 review/wiki
material (see README for links).

1. **The sequel has counter relationships.** Its guides say things like "Dino
   Riders are weak to Slingers", and describe anti-armour troops as the answer to
   heavy units. My build already had a `damageKind` on every unit and
   emplacement, and it did **nothing** — four flavours of damage that all
   resolved identically. That is the single biggest depth gap, and closing it is
   faithful rather than invented.
2. **The sequel added Survival**, endless waves against escalating attackers.
3. **Both games ship difficulty tiers** (Easy / Medium / Hard / Insane). Mine had
   one implicit difficulty baked into each mission's enemy numbers.
4. **The sequel upgrades units within an age.** My credits had no sink at all,
   which was a dangling thread.

## Scope, in build order

Ordered so the systems that change combat maths land before the balance pass.

### 1. Armour and counters

Three armour classes and a damage-kind multiplier table, so the four roles
finally counter each other instead of being cost tiers.

| | flesh | plate | hull |
|---|---|---|---|
| **impact** blunt, hooves, small arms | 1.25 | 0.60 | 0.50 |
| **pierce** arrows, AP, shaped charges | 0.85 | 1.35 | 1.10 |
| **blast** high explosive, splash | 1.35 | 0.90 | 0.65 |
| **energy** rail, ion, plasma | 1.00 | 1.20 | 1.45 |

Assignment is by role, so it is learnable once and holds for all five ages:

- melee → `impact`, armour `flesh`: cheap chaff, folds to artillery
- ranged → `pierce`, armour `flesh`: the answer to heavies
- heavy → armour `plate` or `hull`: rolls chaff, dies to massed ranged
- artillery → `blast`, armour `hull`: shreds packed lines, helpless alone

This is the "slingers counter dino riders" relationship, reproduced from the
source material rather than guessed at.

### 2. Audio

No sample assets, so everything is synthesised through the Web Audio API:
noise bursts and oscillators through envelopes and filters. Confirmed by the
research as the standard no-asset approach, and it keeps the bundle flat.

Needs: melee hits per damage kind, gunfire, lobbed shell whistle and detonation,
gate impacts, unit spawn, evolve sting, special barrage, UI ticks, plus a thin
adaptive drone bed that shifts with the age and thickens as the front line gets
close to your gate.

### 3. Difficulty tiers

Four tiers scaling enemy economy, aggression and reaction speed on top of each
mission's own numbers, chosen per mission and remembered. Clears are recorded per
tier so the campaign is worth replaying up the ladder.

### 4. Survival

Endless escalating waves on a single map, with the age cap lifting on a timer
rather than by mission. Scored on waves held; best score persisted.

### 5. Armoury

The credits sink. Permanent, cheap, few, and readable: each perk is a single
number in the sim, bought once. No currency loops, no timers, no adverts.

### 6. In-battle tutorial

The briefing screens explain the systems; mission 1 should also point at the real
controls the first time they matter. Sequenced prompts, dismissible, shown once.

### 7. Balance re-pass

Armour changes every trade in the game, so the harness gets extended with
per-tier runs and the whole curve is re-tuned afterwards.

### 8. Act two: missions 13-24

Twelve more missions, and a second modifier vocabulary to give them character.

The constraint that shaped the whole act: `BattleSim` clamps enemy aggression at
1.0 and mission 12 already sits there, so "harder" cannot mean "the commander
thinks faster" past that point. Difficulty comes from taking things away instead.
Five new modifiers, each one small in the sim and large in play:

| modifier | what it does |
|---|---|
| `no-specials` | neither side may call support fire |
| `veteran-enemy` | the enemy deploys one age ahead, inside the mission's cap |
| `close-quarters` | shortens the lane; reach becomes worthless |
| `lean-purse` | cuts passive income hard, so gold comes off the front line |
| `single-mount` | one emplacement, not four |

One mission, one idea, until the last four where they stack. Funding climbs from
1.4x to 1.95x behind them, which is a gentler curve than it first looked like it
should be: the first pass ran to 2.4x and left five missions unwinnable by any
scripted plan.

## Deliberately not in scope

- **Real art.** Still procedural placeholder rigs, as agreed at the start. The
  skeleton spec has a `texture` slot per bone for when sprites arrive.
- **Multiplayer / versus.** The sim is deterministic and seeded, so it is
  reachable later, but netcode is its own project.
- **Live-ops, adverts, purchases.** Nothing about this game needs them.
