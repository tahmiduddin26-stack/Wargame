# Bundled typefaces

Both are self-hosted rather than loaded from a CDN: the game ships in a Capacitor
shell with no guaranteed network, and a display face that silently falls back to
the platform sans is not the design.

Latin subsets only (the UI is English), variable weight axes, woff2.

## Oswald

Display voice: headings, unit names, buttons, mission callsigns. A condensed
grotesque in the register of stencilled military lettering.

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
