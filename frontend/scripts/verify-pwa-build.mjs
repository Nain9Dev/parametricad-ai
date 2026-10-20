// Checks what the production build really ships for the PWA (ADR-0007).
//
// The unit tests pin the options that produce the service worker; this reads the
// worker that came out. Run it after `npm run build`:
//
//   npm run verify:pwa
//
// It exits non-zero, listing every problem, when the build would install a
// worker that is wrong, too heavy, or that caches something it must not.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
const MAX_PRECACHE_BYTES = 3 * 1024 * 1024
const PRESETS = ['flange', 'elbow', 'pipe', 'plate']
const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']

const problems = []
const expect = (ok, message) => {
  if (!ok) problems.push(message)
}
const read = (name) => readFileSync(join(DIST, name), 'utf-8')

function report(precache) {
  if (problems.length > 0) {
    console.error('verify:pwa failed:')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  const kib = (precache.bytes / 1024).toFixed(1)
  console.log(`verify:pwa passed: ${precache.urls.length} files precached, ${kib} KiB.`)
}

expect(existsSync(DIST), 'dist/ is missing: run `npm run build` first.')
for (const file of ['index.html', 'manifest.webmanifest', 'sw.js']) {
  expect(existsSync(join(DIST, file)), `dist/${file} is missing.`)
}
if (problems.length > 0) report({ urls: [], bytes: 0 })

const worker = read('sw.js')
const workboxFiles = readdirSync(DIST).filter((name) => /^workbox-.*\.js$/.test(name))
expect(workboxFiles.length > 0, 'the Workbox runtime file is missing next to sw.js.')

// The precache list is a literal array in the generated worker.
const urls = [...worker.matchAll(/url:\s*["']([^"']+)["']/g)].map((match) => match[1])
expect(urls.length > 0, 'could not read the precache list from sw.js.')

const required = [
  'index.html',
  'manifest.webmanifest',
  'presets/catalog.json',
  ...PRESETS.flatMap((kind) => [`presets/${kind}.json`, `presets/${kind}.glb`]),
  ...ICONS.map((name) => `icons/${name}`),
]
for (const url of required) expect(urls.includes(url), `the precache lacks ${url}.`)
for (const pattern of [/^assets\/three-.*\.js$/, /^assets\/index-.*\.js$/, /^assets\/index-.*\.css$/]) {
  expect(urls.some((url) => pattern.test(url)), `the precache lacks a file matching ${pattern}.`)
}

// Nothing the installed app does not need, and nothing that is not ours.
expect(!urls.includes('og-image.png'), 'the link-preview image must not be precached.')
for (const url of urls) {
  expect(!/^https?:/.test(url), `${url} is cross-origin and must not be precached.`)
  expect(!url.startsWith('api/') && !url.includes('/api/'), `${url} looks like an API path.`)
}
expect(!worker.includes('onrender.com'), 'sw.js names the API host: nothing from it may be cached.')

// No runtime caching: the one route is the navigation fallback.
const routes = worker.match(/registerRoute\(/g) ?? []
expect(routes.length === 1, `sw.js registers ${routes.length} routes; only the navigation fallback is allowed.`)
expect(worker.includes('NavigationRoute'), 'sw.js has no navigation fallback.')

// An update waits for the user: the worker skips waiting only on request.
expect(worker.includes('SKIP_WAITING'), 'sw.js does not wait for the update message.')
expect((worker.match(/skipWaiting\(\)/g) ?? []).length === 1, 'skipWaiting() must run only from the message handler.')

// Chrome offers the install prompt only to a worker that handles fetch.
const handlesFetch = [worker, ...workboxFiles.map(read)].some((source) =>
  /addEventListener\(\s*["']fetch["']/.test(source),
)
expect(handlesFetch, 'neither sw.js nor the Workbox runtime handles fetch events.')

const bytes = urls
  .filter((url) => existsSync(join(DIST, url)))
  .reduce((total, url) => total + statSync(join(DIST, url)).size, 0)
expect(bytes <= MAX_PRECACHE_BYTES, `the precache is ${bytes} bytes, over the ${MAX_PRECACHE_BYTES} byte budget.`)

report({ urls, bytes })
