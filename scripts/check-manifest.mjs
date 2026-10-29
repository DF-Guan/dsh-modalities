/** `npm run check`: verify the package manifest agrees with the files on disk. */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = createRequire(import.meta.url)(resolve(root, 'package.json'))

let failed = false
for (const pattern of pkg.files ?? []) {
  const path = resolve(root, pattern.replace('/**', ''))
  if (!existsSync(path)) {
    console.error(`check: package.json 'files' lists a missing entry: ${pattern}`)
    failed = true
  }
}

const main = resolve(root, pkg.main)
if (!existsSync(main)) {
  console.error(`check: main entry missing: ${main}`)
  failed = true
}

process.exitCode = failed ? 1 : 0
