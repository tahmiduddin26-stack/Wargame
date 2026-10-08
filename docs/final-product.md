# War Game — final product and build plan

Working target: mobile-friendly browser release, followed by native Android/iOS. Updated 7 October 2026.

## Product promise

**A pocket battle notebook:** a short lane strategy game that moves from stone clubs to future armies. Loose ink, warm paper, clear silhouettes and authored SVG icons define the art. Players win through spending, unit counters, evolving and holding ground.

The loop is **choose a battle → deploy and evolve → see why it ended → earn XP/credits → improve the offline army or collect a paint → play again**. Retries stay immediate and unlimited.

## Version 1 scope

| Area | Finished experience | Current implementation |
| --- | --- | --- |
| First session | Four skippable briefing steps, readable battle coaching, quick first mission | Built |
| Campaign | 16 sequential operations; Easy, Normal, Hard and Insane; saved bests and tier clears | Built |
| Combat | Five ages, four unit roles per age, emplacements, specials, visible clock decisions, SFX and ragdolls | Built |
| Survival | Endless escalating waves, personal best, rewards and an explicit results screen | Built and checked |
| Progression | Permanent commander XP, eight skills in three branches, four earned cosmetic paints | Built |
| Service record | Twelve medals, cumulative offline stats, recent battle history and reward breakdowns | Built and checked |
| Save recovery | Export a readable backup, validate an import, show its contents, confirm replacement | Built and checked |
| Play offline | Cache the complete production build; campaign, survival and progression work without a connection | Built and checked |
| Mobile resilience | Rotation/background pause, fresh restarts, reduced motion, 44px primary controls | Built; real-device profiling remains a release gate |
| Online | Friend codes/challenges, casual queue, ranked queue, rating/divisions and leaderboard | Built and checked locally |
| Online resilience | Brief reconnect window; server keeps the match running; rejoin the same match; one result and rating change | Built and checked locally |
| Online accounts | Upgrade a guest, recover on another device, change password and sign out | Built and checked locally; email reset remains a gate |
| Online record | Last 20 battles with opponent, result, duration and rating changes | Built and checked locally; retained after server restart |
| Hosting | One server serves client plus WebSocket; SQLite profiles/accounts/results; safe legacy import and backup tool | Local server checked; container template and operating guide supplied |

### Rules that keep the game fair

- Campaign skills apply only to offline play. Every online battle begins with equal resources and runs at normal speed.
- Casual and friend matches do not change rating. Ranked results come from the server.
- The survival score means **wave reached**, consistent with existing saves. Every wave reached pays one credit and three commander XP once per completed run.
- Medals recognise progress without adding combat power or extra currency.
- A disconnect does not pause the opponent. A brief reconnection restores the same match; expiration of the grace window forfeits it. Explicit Leave still forfeits immediately.
- Offline backups contain offline progress and settings. They exclude the private online guest token and never restore ranked rating.

## This build sequence

1. Finish backup/restore and harden save migration; retain existing records and paints.
2. Record recent finished offline battles and improve debrief feedback.
3. Add a production offline cache, installation guidance and updates that do not reload a running battle.
4. Add multiplayer reconnect grace and verify duplicate-login/result behavior.
5. Run production builds, progression/import tests, phone browser checks, offline reload/deploy checks, multiplayer protocol and two-player UI checks, and the campaign balance harness.
6. Commit and push the reviewed build. A local build is not a public deployment.

## Release gates

### Browser beta

All implementation and automated checks above pass. Serve over HTTPS/WSS on a reachable host, back up `.data/multiplayer.sqlite` with the database backup command, and run a two-device smoke test. Service workers require HTTPS except on local development origins ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)). Human testing must cover small landscape phones, font readability, thumb reach, pause/resume, strategy clarity and reconnecting on mobile data.

### Public competitive release

Username/password accounts, SQLite storage, finished match logs and an in-game data notice are now built. Complete forgotten-password recovery, moderation/report/block controls, account deletion, a published privacy policy and operational limits before public release. The single-process server still holds active matches in memory. Test rating drift, side advantage, queue spread and abuse using real sessions. Do not describe this prototype as a hardened public ranked service until these gates are met. Account and database details are in [online accounts and operations](online-accounts.md).

### Native store release

Generate native projects, set orientation in each platform project, remove debug settings for release, profile real devices, supply store assets and test interrupted sessions. iOS signing/builds require the appropriate Apple tooling and account. The existing Capacitor config alone does not implement or verify native orientation lock.

### Monetisation

The first potential paid products are clearly priced, permanent cosmetics. Existing paints remain earnable. Before checkout exists, complete store billing, server-validated entitlements, restore and refund handling. Do not sell combat power, ranked revives, extra attempts or random paid crates. No pretend checkout or live-battle ads enter Version 1.

## Balance and acceptance criteria

- Run all 16 Normal missions against the existing greedy, swarm and mixed scripted players. Record results as a reproducible baseline; scripted wins are not human win rates.
- No new power bonuses or economy multipliers in this pass. Existing rank, skill and cosmetic costs remain intact.
- One finished battle increments totals and rewards once; a replay creates a fresh simulation; an abandoned run pays nothing.
- Invalid backups never replace progress. Existing partial local saves migrate without fabricated battle totals.
- A fully cached production build reloads offline and can deploy a battle. Multiplayer explicitly needs a connection.
- Reconnect resumes the original match and perspective; stale sockets cannot send orders after a replacement login; a timed-out result can be recovered on rejoin.
- No horizontal overflow on the new screens at 667×375 or 1024×576; primary new controls are at least 44px tall.

## Next content cycle

After beta playtests: prioritise confusing mission losses and frame-time spikes before adding more content. Add a small authored campaign chapter or cosmetic set only after the same sim harness and human test process. Keep optional purchases away from the first-session briefing.

## Verification record — 7 October 2026

The production build and client/server TypeScript checks pass. Progression tests cover single payouts, restart IDs, legacy migration, history persistence, invalid imports and backup round trips. Browser checks cover preview-before-restore, cosmetics, 667×375 layouts, cached offline reload/deployment, rotation pause/resume and real campaign/survival restarts. An undefended real survival run ends at wave 6 and verifies the debrief, six credits, eighteen XP, a single history entry and persistence after reload. Protocol tests cover friend/casual/ranked results, mirrored state, same-match rejoin, grace expiry and a recovered missed result. Two-browser tests cover rendered shared units, casual/ranked ratings, rejoining after a page reload and stopping a search when leaving the lobby.

The full Normal harness repeats **14/16 greedy, 10/16 swarm and 13/16 mixed** wins. Operation 1 finishes in 1:29 / 3:00 / 1:01 respectively. Survival reaches 32 / 33 / 31 waves in about 6:42–6:55. This pass adds no combat or economy tuning. These are local automated results; mobile hardware performance, a public deployment, native builds and billing have not been verified or shipped.

### Account and storage continuation

This increment adds recoverable commander accounts, private recent online history, safe legacy-profile migration and a live database backup command. Storage checks cover corruption rejection, retained source files, transaction rollback, duplicate settlements, password hashing and reopen/backup. Account protocol checks use isolated servers and verify guest upgrades, private account names, replacement sessions, password-based rejoin of an active battle, password changes, revoked logout tokens and ratings/friends/results after restart. Phone browser checks cover 667×375 forms, validation, ranked records, reload and recovery on a second browser. The existing friend/casual/ranked/reconnect checks also pass. Forgotten-password recovery and public account operations remain future gates.

### Character art correction — 8 October 2026

The live soldiers now follow the promotional illustration's round faces, bold ink outlines, chunky limbs and age-specific gear. All 20 units have authored drawings; mounts, siege carts, vehicles and mechs use distinct rigs. Shared paint atlases retain orange/blue factions and all four earned paints. Deaths inherit the current limb transforms and equipment; a Matter shutdown cleanup error found in the battle test is fixed. Combat stats and economy are unchanged.

The production build, complete 40-character roster, four paints, mirrored death poses, bounded corpse recycling, real-mission smoke check, offline phone reload/rotation and two-client casual/ranked/reconnect UI checks pass. Fourteen store browser screenshots and the downloadable pack are refreshed. Native performance and store-launch gates still apply.

### UI correction — 8 October 2026

Decorative coloured card fills, HUD edge strips, age-change sweeps and ready-state pulses are removed. Selections use ink fill with paper lettering; focus outlines use ink. The Call button is a rounded paper control with separate rows for the full attack name, status ring and action. Cooldown shows remaining seconds and disables repeated activation.

The production build and focused browser check pass: all five specials in ready/cooldown states at 667×375, 960×540 and 1311×603, non-overlapping labels and dock controls, keyboard activation, a real battle cooldown and settings/campaign contrast. Store browser captures and the download pack are refreshed.
