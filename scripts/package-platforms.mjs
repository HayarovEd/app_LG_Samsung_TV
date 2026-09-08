import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const distRoot = join(projectRoot, 'dist')
const platformRoot = join(distRoot, 'platforms')
const ignoredEntries = new Set(['platforms', 'tizen', 'webos'])

async function copyWebApp(destination) {
  await mkdir(destination, { recursive: true })
  for (const entry of await readdir(distRoot, { withFileTypes: true })) {
    if (!ignoredEntries.has(entry.name)) {
      await cp(join(distRoot, entry.name), join(destination, entry.name), { recursive: true })
    }
  }
}

await rm(platformRoot, { recursive: true, force: true })
const tizenRoot = join(platformRoot, 'tizen')
const webosRoot = join(platformRoot, 'webos')
await copyWebApp(tizenRoot)
await copyWebApp(webosRoot)
await cp(join(distRoot, 'tizen', 'config.xml'), join(tizenRoot, 'config.xml'))
await cp(join(distRoot, 'webos', 'appinfo.json'), join(webosRoot, 'appinfo.json'))
await writeFile(join(platformRoot, 'README.txt'), 'Tizen package source: dist/platforms/tizen\nwebOS package source: dist/platforms/webos\n')
