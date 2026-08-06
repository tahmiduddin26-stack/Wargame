# Bundled typefaces

All three are self-hosted rather than loaded from a CDN: the game ships in a
Capacitor shell with no guaranteed network, and a display face that silently
falls back to the platform sans is not the design.

Latin subsets only (the UI is English), woff2. 128 KB combined.

## Bowlby One SC

The heavy voice, and it has exactly three jobs: the wordmark, a debrief verdict,
and the gold figure in the battle HUD. Nothing else, ever — it is loud enough
that a fourth use makes the first three stop meaning anything.

- Copyright: Vernon Adams, The Bowlby One SC Project Authors
  (https://github.com/googlefonts/bowlby-one)
- Licence: SIL Open Font License 1.1 — https://openfontlicense.org
- File: `bowlby-one-sc-400.woff2` (23 KB)

## Barlow Condensed

Everything else with letters in it: keys, headings, unit names, labels, body
copy. A condensed grotesque that holds up at label sizes and at wordmark sizes,
which is what lets one face carry the whole interface.

Three static weights rather than a variable axis, because the design only asks
for three: 400 for prose, 600 for plates and labels, 700 for keys and headings.

- Copyright: Jeremy Tribby, The Barlow Project Authors
  (https://github.com/jpt/barlow)
- Licence: SIL Open Font License 1.1 — https://openfontlicense.org
- Files: `barlow-condensed-400.woff2`, `-600.woff2`, `-700.woff2` (66 KB total)

## JetBrains Mono

Every figure in the interface: gold, experience, damage, reach, timers, mission
numbers. Bundled rather than relying on `ui-monospace` so tabular columns line up
identically on iOS, Android and desktop instead of shifting with whatever mono the
platform happens to have.

- Copyright: 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)
- Licence: SIL Open Font License 1.1 — https://openfontlicense.org
- File: `jetbrains-mono-var.woff2` (31 KB, weights 400-700)

## Removed

**Oswald** carried the display voice under the two earlier art directions and
was dropped when Barlow Condensed took over every lettered surface. If a future
pass wants it back it is at https://github.com/googlefonts/OswaldFont.
