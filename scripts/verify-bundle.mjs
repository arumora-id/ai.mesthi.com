import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    out.push(...(entry.isDirectory() ? await walk(path) : [path]))
  }
  return out
}
const files = await walk('dist')
const forbidden = [
  'Start demo run',
  'Demo workspace',
  'Local demo',
  'TEST_ONLY_WORKSPACE',
  'VITE_DATA_MODE',
  'mesthi:demo:v1',
]
for (const path of files.filter((p) => /\.(js|html)$/.test(p))) {
  const code = await readFile(path, 'utf8')
  // The single legacy-key removal is intentional; no business data is ever read back.
  const checked = code.replace(/localStorage\.removeItem\(["'`]mesthi:demo:v1["'`]\)/g, '')
  for (const phrase of forbidden)
    if (checked.includes(phrase))
      throw new Error('Production bundle contains forbidden runtime content: ' + phrase)
  if (code.includes('BEGIN PRIVATE KEY')) throw new Error('Private key found in bundle')
}
if (files.some((path) => path.endsWith('.map')))
  throw new Error('Production sourcemaps must not be public')
console.log('Production bundle contains no demo runtime or test fixtures.')
