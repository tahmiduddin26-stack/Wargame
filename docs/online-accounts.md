# Commander accounts and online storage

Implemented and checked locally on 7 October 2026.

## Player experience

Multiplayer starts with a guest commander. Creating an account attaches a private username and password to that commander; it keeps the rating, friend code and friends. Signing in from another device restores that profile and its recent battle record. Password sign-in can take over an active match, preserving its seed and side. The displaced device stops reconnecting automatically.

Usernames are case-insensitive, with 3–24 letters, numbers or underscores. Passwords accept 15–128 characters, spaces and Unicode. The UI supports password managers. Signing out creates a fresh guest and revokes the account's remembered session. Creating an account, signing in or changing a password also rotates that session. Password change requires the current password. Account changes are rejected while the source commander is searching or battling.

Keep credentials in a password manager. Email recovery, forgotten-password reset and account deletion are not implemented. Offline campaign XP, credits, paints and save backups remain on the device; online sign-in does not synchronise them. No paid entitlements exist.

## Storage and migration

The server uses Node's SQLite API with WAL journalling, full synchronous commits, foreign keys and bound SQL parameters. The tested Node 24.14.1 still labels `node:sqlite` experimental. Pin and test your host's runtime ([Node SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)). One server process owns the database; this is not a multi-instance matchmaking design.

| Setting | Purpose | Default |
| --- | --- | --- |
| `MULTIPLAYER_DB_FILE` | Profiles, account hashes, match logs and results | `.data/multiplayer.sqlite` |
| `MULTIPLAYER_DATA_FILE` | Legacy import source; supplies DB basename if no DB override | `.data/multiplayer.json` |
| `ALLOWED_ORIGINS` | Comma-separated exact browser origins | Same host; loopback development origins |
| `TRUST_PROXY_TLS` | Trust overwritten `X-Forwarded-Proto: https` from a TLS proxy | Disabled |

First startup validates every legacy profile and imports the complete set in a transaction. Duplicate IDs, invalid fields or broken JSON fail startup. The source remains unchanged; a migration marker prevents later re-imports. Repair the source or restore a backup before retrying a failed migration. After migration, the database is authoritative: reverting to the old JSON server would discard later account and rating changes.

Every finished match stores its seed, participants, winner, reason and time, plus both perspective-specific results. Ranked ratings, win/loss counters and both results commit together. Unique match IDs prevent duplicate settlement. Clients receive only the connected commander's last 20 results. Live matches, queues, reconnect timers and pending notifications remain in memory; drain live games before restarting. Finished results remain accessible in history after a restart.

## Credentials and connections

Passwords use independently salted scrypt hashes with `N=32768`, `r=8`, `p=3`; verification uses a timing-safe comparison. This is an OWASP-recommended scrypt configuration ([OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). Raw passwords and session tokens are not written to the database or application logs. Session hashes use SHA-256 because sessions are random 256-bit secrets.

Hashing runs asynchronously with at most four concurrent jobs. Credential requests are capped at 12 per IP and username in a 15-minute window across socket changes, with bounded in-memory entries; signing out can always revoke an idle session. Unknown accounts get the same sign-in failure and password-hashing work. Existing WebSocket limits remain 16 KiB per message, 80 messages and 40 combat commands per second per connection. These controls need load and abuse testing before public service.

Use HTTPS/WSS outside localhost. The client blocks account operations from insecure browser contexts. The server accepts them from TLS sockets, loopback development connections or an explicitly trusted TLS proxy. Configure exact browser origins for public hosting. Behind a trusted proxy, set `TRUST_PROXY_TLS=1`, firewall the backend and have the proxy overwrite `X-Forwarded-Proto` and `X-Forwarded-For` with a single actual client IP. Without this setting, account limits use the proxy's IP for every player. Native shells and alternative client origins need a deployment test.

## Backup and restore

Run `npm run backup:online -- .data/backups/online-YYYY-MM-DD.sqlite` with the same database environment variables as the server. SQLite's backup API captures a consistent database while it is running. The command refuses to overwrite existing destinations. Restrict backup access: copies contain account hashes, session hashes and player records.

To restore, drain live games and stop the server. Preserve the current database and associated `-wal`/`-shm` files as a recovery set outside the active basename. Place the selected backup at `MULTIPLAYER_DB_FILE`, with no stale sidecars at that basename, then restart and check `/health`, sign-in and history. Never mix an older database with newer WAL files or copy only a running main database. Test restoration on an isolated instance first.

## Data handling and remaining release work

| Data | Visibility and retention in this build |
| --- | --- |
| Commander name, friend code, ranked scores | Visible to players; retained on server |
| Friends and account username | Returned to owning session; retained on server |
| Password/session hashes | Server only; changed on password/session rotation |
| Finished matches/results | Full server record retained indefinitely; player sees last 20 |
| IP addresses for account limits | In-memory keys expiring after 15 minutes; not in game database |
| Offline campaign saves | This browser; user-controlled JSON backups |

The account screen explains the game's data. There are no payments, email collection or advertising trackers in this build. Hosts may maintain their own access logs. Before public release, define deletion/export and retention policies, add forgotten-password recovery and moderation/report/block, publish a privacy policy with an actual operator contact, test proxy handling, expire inactive sessions and test abuse at expected scale. Do not claim these operations exist until built and verified.
