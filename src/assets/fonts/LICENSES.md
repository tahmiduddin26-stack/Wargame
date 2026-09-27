# Bundled typefaces

All fonts are self-hosted because the game ships in a Capacitor shell with no
guaranteed network.

The earlier Oswald and JetBrains Mono assets are Latin-subset variable WOFF2
files. Patrick Hand and Kalam are bundled as their original TTF releases.

## Patrick Hand

Handwritten body copy and small labels for the sketchbook UI.

- Copyright: Patrick Wagesreiter (https://github.com/google/fonts/tree/main/ofl/patrickhand)
- Licence: SIL Open Font License 1.1, bundled as `PATRICK-HAND-OFL.txt`
- File: `patrick-hand-regular.ttf`

## Kalam

Bold hand-lettered headings and action labels for the sketchbook UI.

- Copyright: Indian Type Foundry (https://github.com/google/fonts/tree/main/ofl/kalam)
- Licence: SIL Open Font License 1.1, bundled as `KALAM-OFL.txt`
- File: `kalam-bold.ttf`

## Oswald

Legacy display font from the previous theme. The file remains in the source
tree for reference but is no longer loaded by the current UI.

- Copyright: The Oswald Project Authors (https://github.com/googlefonts/OswaldFont)
- Licence: SIL Open Font License 1.1 — https://openfontlicense.org
- File: `oswald-var.woff2` (21 KB, weights 400-700)

## JetBrains Mono

Every figure in the interface: gold, experience, damage, reach, timers, mission
numbers. Bundled rather than relying on `ui-monospace` so tabular columns line up
identically on iOS, Android and desktop instead of shifting with whatever mono the
platform happens to have.

- Copyright: 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)
- Licence: SIL Open Font License 1.1 — https://openfontlicense.org
- File: `jetbrains-mono-var.woff2` (31 KB, weights 400-700)
