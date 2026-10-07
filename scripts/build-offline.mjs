import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('dist');
function list(directory = '') {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}${entry.name}`;
    return entry.isDirectory() ? list(`${path}/`) : [path];
  });
}
const files = list().filter((file) => file !== 'sw.js').sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(readFileSync(resolve(root, file)));
const cache = `wargame-shell-${hash.digest('hex').slice(0, 16)}`;
writeFileSync(resolve(root, 'sw.js'), `// Generated from the complete production bundle. Do not hand-edit.
const CACHE = ${JSON.stringify(cache)};
const URLS = ${JSON.stringify(files)}.map(path => new URL(path, self.registration.scope).href);
const INDEX = new URL('index.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('wargame-shell-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Live server endpoints and unknown files always use the network.
  if (request.mode !== 'navigate' && !URLS.includes(url.href)) return;
  if (request.mode === 'navigate' && url.pathname !== new URL(self.registration.scope).pathname && url.pathname !== new URL(INDEX).pathname) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(request.mode === 'navigate' ? INDEX : request) || fetch(request);
  })());
});
`);
console.log(`Offline shell: ${files.length} files, ${cache}.`);
