// Syncs the release version from the repo-root .tagversioning into the
// service worker banner. Browsers only pick up a new SW when its bytes
// change, so this one line is what triggers auto-update after deploy.
// Runs as `prebuild` (see package.json).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let version = 'dev'
try {
  version = readFileSync(join(root, '..', '.tagversioning'), 'utf8').trim() || version
} catch {
  console.warn('sync-sw-version: .tagversioning not found, using "dev"')
}
const swPath = join(root, 'public', 'service-worker.js')
let sw = readFileSync(swPath, 'utf8')
const banner = `/* APP_VERSION: ${version} */`
if (sw.startsWith('/* APP_VERSION:')) {
  sw = sw.replace(/^\/\* APP_VERSION: .*? \*\//, banner)
} else {
  sw = `${banner}\n${sw}`
}
writeFileSync(swPath, sw)
console.log(`service-worker version -> ${version}`)
