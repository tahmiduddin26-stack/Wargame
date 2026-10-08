# Doodlebook Battles — Android and iOS launch plan

**Decision: hold the public store launch.** The browser build is suitable for preparing a private playtest. It is not yet a verified Android or iOS release. Working title approved by the owner; naming clearance and store availability remain to be checked.

Reviewed against the repository and official platform documentation on **8 October 2026**. This is a release plan, not confirmation of acceptance by either store.

## What is already here

The playable game has 16 campaign operations, four difficulties, five ages, 20 units, 15 emplacements, five specials, endless survival, commander XP, eight skills in three branches, four earned army paints and a service record. Audio, ragdolls, offline caching, save export/import and browser pause/resume are implemented. Online includes friend challenges, casual matchmaking, ranked ratings, a leaderboard, reconnects, username/password recovery of accounts on another device and SQLite match history.

Earlier local checks are recorded in [the product plan](final-product.md). Automated scripted balance results are a baseline, not evidence of human retention, fairness or mobile performance. The current store art pass changes branding and assets, not combat balance.

## Readiness audit

| Area | Evidence in the repo | Required before public submission |
| --- | --- | --- |
| Core game | Playable campaign, survival, progression and locally tested online battles | Human first-session and full-campaign playtests; fix confusing losses |
| Android | Capacitor template only; SDK exists on this Windows machine | Install compatible native dependencies; generate project; signed AAB; physical-device testing |
| iOS | Capacitor template only; no verified Xcode build | Mac/Xcode access, signing, archive, TestFlight and physical iPhone testing |
| Mobile UX | Responsive landscape UI and browser lifecycle handling | Notch/gesture safe areas, platform back action, calls, audio interruption, network switching and native storage |
| Accounts | Create/sign in/change password/sign out; durable profiles | In-app account deletion, external deletion request route, recovery for forgotten credentials, support |
| Public multiplayer | Single-process local service, SQLite, reconnects and authoritative results | Reachable HTTPS/WSS service, monitoring, backup/restore rehearsal, abuse limits and queue/load tests |
| Player safety | Player names and friend codes; no free-text chat | Names moderation, report/block flows, support contact and review of user-generated-content obligations |
| Privacy | In-game notice; no published operator policy | Accurate public privacy/support/deletion pages; store disclosures checked against shipped code and logs |
| Store materials | PNG icon, illustrated feature art, actual browser screenshot drafts | Recapture inside final signed builds; final copy, age-rating questionnaire and review instructions |
| Purchases | No real-money checkout or advertising SDK | Keep launch free of purchases; billing is a separate future milestone |

The existing `cap:sync` command does not create a working native build by itself: Capacitor packages and generated platform projects are absent. `com.fieldcommand.ageofwar` is a template identifier, not an established owned application ID. The native projects are currently ignored by Git; explicitly decide how their configuration will be versioned before making release changes.

### Improvements made during the artwork audit

The menu, browser title, PWA name and native display-name template now use Doodlebook Battles. New authored fort icons are exported and referenced by the web manifest and favicon. Remote WebView debugging is disabled in the native template. A screenshot review also exposed clipped unit names and occasional negative displayed gold caused by a frame timestamp preceding the tween start; compact long-name type and a bounded tween fix these display issues without changing simulation prices or balance.

## Release scope

Ship campaign, survival, progression, earned paints, save recovery and the sketchbook visual identity. Include online modes only after the public-service gates below pass. If the service is unfinished, disable online entry points in the release build and remove multiplayer promises from the listing. Do not leave a live-looking queue pointing at localhost or an unavailable host.

Use **Doodlebook Battles** consistently in the menu, native display name and listing. Preserve the existing `aow.*` save/token keys so returning players keep their progress. Check the working title and all art/font licences before registering the listing. The store pack contains an authored SVG icon, one generated promotional illustration and real browser UI captures; no generated UI is presented as gameplay.

## Build sequence and acceptance gates

### 1. Produce installable private builds

- Choose owned Android application ID / Apple bundle ID, developer accounts, support email and hosting domain.
- Select a supported Capacitor version from its current official documentation, install matching core/CLI/platform packages, generate both projects and document native configuration. Do not assume the old template comment or placeholder ID is final.
- Configure landscape, safe areas, native splash/icon, production WebView settings and a release-specific multiplayer URL. Disable remote debugging in release builds.
- Verify local WebView origins, server origin allow-list and HTTPS/WSS connections together. Native origins differ from the localhost browser; do not resolve this by removing origin checks globally.
- Verify durable progress across native upgrades, background suspend, force close and restart. Browser service-worker behavior is not proof that packaged offline assets work.
- Build a signed Android AAB and iOS archive; install the same release candidate through private distribution on real devices.

New Android phone submissions currently require **Android 16 / API 36 or higher**. [Google target API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)

App Store Connect uploads currently require **Xcode 26 or later and iOS 26 SDK or later**. Apple also lists iOS 13 as the minimum deployment target; deployment support and the build SDK are separate settings. Recheck requirements when building the final candidate. [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)

### 2. Finish account and public-service operations

- Add authenticated deletion with clear confirmation. Revoke sessions, remove credentials and personal profile/friend links, and specify how retained match records are anonymised. Define any lawful retention before making promises in the privacy policy.
- Supply a discoverable external deletion request page with app/operator identity, instructions and a working request mechanism. Track completion and verify a deleted account cannot reconnect through an old token.
- Add a usable lost-credential recovery design, without publishing account existence or creating an account-takeover path. The present cross-device sign-in requires the password to be known.
- Add block/report/name moderation appropriate to the public features. Test blocked challenges and friend additions, invalid names and repeated abusive reports.
- Deploy HTTPS/WSS with persistent storage, secure origin configuration, request/connection limits and redacted operational logging. Run a real two-device friend/casual/ranked/reconnect smoke test on separate networks.
- Rehearse backup restoration and deployment rollback. Active matches are in memory today: implement recovery or a documented maintenance/disruption policy that prevents unfair rating penalties during planned restarts.
- Measure queue length, match completion, reconnect success and rejected commands using minimal aggregate operational data. Run concurrent matches and mobile network-switch tests before claiming public ranked reliability.

Apple requires account-creating apps to offer deletion within the app. [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

Google requires an in-app deletion path and an external web resource for deletion requests. [Google account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

Complete privacy declarations from the actual shipped data flow: account names/hashes, player names, friends, ratings/results, session tokens, IP-derived rate limits and any host logs. Do not answer “no data collected” merely because no analytics SDK exists. Review account, user-generated-content, completeness and payment requirements against the final build. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/)

### 3. Run a device and human beta

Our acceptance targets below are product goals, not platform mandates:

- Test a modest Android phone, a recent Android phone, a small supported iPhone and a recent iPhone. If supporting iPad, add physical tablet testing and its store screenshots.
- Complete onboarding, campaign progression, a long survival run, a skill purchase, paint equip, offline relaunch and save export/import on each platform. Verify no text overlaps or inaccessible primary buttons with the smallest supported landscape safe area.
- Run calls/app switching/rotation, headphones and silent settings, low-memory resume, install/update/reinstall and Wi-Fi-to-mobile switching. Verify one result/reward/rating settlement per battle.
- Target stable 60 fps on the reference device; keep a playable 30 fps floor on the declared minimum device. Record frame times and memory during a 20-minute session with heavy units, effects and ragdolls. Profile the large Phaser bundle and cold-start cost rather than suppressing its build warning.
- Recruit first-time players for uncoached observation. Target at least 8 of 10 understanding how to deploy and finish operation 1 without help. Record mis-taps, explanations requested, loss reasons and first-session length.
- Validate all 16 missions with and without skills. Test mirrored ranked matches with equally experienced players, track side advantage, dominant units, evolution timing, rating spread and queue waits. Set matchmaking thresholds from observed traffic rather than assumed global concurrency.
- Fix defects, then repeat only affected checks and the release smoke test. Do not add lives, power boosts or grind to conceal unclear tutorials or a balance problem.

If the Play developer account is a personal account created after 13 November 2023, production access requires a closed test with **at least 12 continuously opted-in testers for 14 days**, followed by an application for access. Account type/date must be checked; this is conditional, not a universal schedule. [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-en)

### 4. Assemble and submit the verified candidate

- Replace browser screenshot drafts with captures of the actual signed Android/iOS builds. Keep illustrations in promotional artwork and gameplay captures in screenshot slots.
- Complete store copy, content/age ratings, privacy disclosures, support/deletion URLs, app access instructions and reviewer credentials if required. Do not invent an age rating from the cartoon art alone.
- Confirm icon mask behavior and legibility at small sizes, screen ordering, languages and exact dimensions in both consoles. Check naming/licensing and final assets against the submitted binary.
- Confirm all listed features work on the review environment, including the public backend if listed. Provide concise notes for landscape controls, account testing and deletion.
- Submit for review only after gates pass; use staged rollout and monitor crashes, support and match outcomes. Store review and production-access approval are external outcomes, not guaranteed dates.

## Artwork specification and supplied pack

See [the asset pack](../assets/store/README.md), [store copy](../assets/store/store-copy.md) and `capture-manifest.json` for source, fixtures and limitations.

Google assets: 512-square app icon; 1024×500 opaque feature graphic. The supplied Android set has three 1920×1080 landscape gameplay captures plus supporting screens. Google recommends this gameplay set for game promotion; it is separate from the minimum listing screenshot count. [Google preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)

The icon master fills its square: Play applies the outside corner mask and shadow. [Google icon design](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)

The iPhone draft set uses the accepted **2622×1206** landscape size for Dynamic Island medium displays. Apple requires at least one screenshot for that group, plus 13-inch iPad screenshots if supporting iPadOS, and disallows screenshot transparency. [Apple screenshot specification](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

The 1024-square icon is a source for the Xcode app icon asset; exporting a PNG does not install it in a native build. [Apple app icon setup](https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/)

## Monetisation after launch

Recommended first experiment: optional, fixed-price cosmetic collections with clear previews. Preserve the four existing earned paints and equal online armies. Do not sell ranked power, ranked extra lives or random paid crates. Test willingness to pay with a preview/prototype before investing in a catalogue.

Purchases require native store billing, server-validated entitlements, restore across supported devices and refund/revocation handling. Ads would add SDK, privacy, consent and interruption work; keep them out of the first launch candidate. No revenue, retention or pricing forecast is justified by current automated tests.

## Remaining owner inputs

Developer accounts and their status; owned identifiers/domain; operator/support contact; Mac/signing access; physical devices and beta testers; hosting budget/region; whether iPad is included. These inputs unblock packaging, public operations and submission. They do not block the artwork and local game work delivered here.

## Verification — 8 October 2026

Production build and server TypeScript checks pass. The production offline/save browser check passes at 667×375: export, invalid-import rejection, preview-before-restore, restored progress, reduced motion, offline reload/deployment and rotate/pause/resume. The build still reports the large Phaser chunk; native cold-start and frame-time measurements remain pending.

The capture script checks live units, non-negative displayed gold during repeated purchases, unit-name widths, long single-word labels, the longer menu title at 667×375 and runtime errors. The export validator checks actual PNG headers, RGB/alpha formats, dimensions, the Play icon size limit and all 14 browser captures. Source illustration and final compositions were visually inspected. These checks validate local browser work and asset files; they do not certify native builds, public multiplayer load, privacy declarations, name clearance or store approval.
