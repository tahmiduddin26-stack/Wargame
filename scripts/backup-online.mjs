import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

const legacy = process.env.MULTIPLAYER_DATA_FILE ?? '.data/multiplayer.json';
const source = resolve(process.env.MULTIPLAYER_DB_FILE ?? legacy.replace(/\.json$/i, '') + '.sqlite');
const destination = process.argv[2] && resolve(process.argv[2]);
if (!destination) throw new Error('Supply a new backup path: npm run backup:online -- .data/backups/online-YYYY-MM-DD.sqlite');
if (!existsSync(source)) throw new Error('The online database does not exist yet. Start the multiplayer server first.');
if (destination === source || existsSync(destination)) throw new Error('Choose a new destination; existing databases and backups are never overwritten.');
mkdirSync(dirname(destination), { recursive: true });
const database = new DatabaseSync(source, { readOnly: true, timeout: 5000 });
try {
  await backup(database, destination);
  console.log(`Online database backup saved to ${destination}`);
} finally { database.close(); }
