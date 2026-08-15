import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { comparePackedAllowlist, CONTRACT_VERSION, REQUIRE_DEFAULTS, run, validateConfig } from '../src/index.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const passFixture = join(here, 'fixtures', 'lint-pass')
const temps = []

let passed = 0
let failed = 0

/**
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`ok - ${name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${name}`)
    console.error(error instanceof Error ? error.stack : error)
  }
}

/**
 * @param {unknown} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/**
 * @param {() => unknown | Promise<unknown>} fn
 * @param {RegExp | string} match
 */
async function assertThrows(fn, match) {
  try {
    await fn()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const ok = typeof match === 'string' ? message.includes(match) : match.test(message)
    if (!ok) throw new Error(`threw ${JSON.stringify(message)}, expected to match ${match}`)
    return
  }
  throw new Error(`expected to throw ${match}`)
}

function copyFailFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-app-check-fail-'))
  temps.push(directory)
  cpSync(passFixture, directory, { recursive: true })
  return directory
}

await test('CONTRACT_VERSION is 1', () => {
  assert(CONTRACT_VERSION === 1, `expected 1, got ${CONTRACT_VERSION}`)
})

await test('require defaults are all on', () => {
  const keys = Object.keys(REQUIRE_DEFAULTS)
  assert(keys.length === 15, `expected 15 require flags, got ${keys.length}`)
  for (const key of keys) {
    assert(REQUIRE_DEFAULTS[key] === true, `${key} should default on`)
  }
  assert(REQUIRE_DEFAULTS.noPrepare === true, 'noPrepare should default on')
})

await test('validateConfig rejects a non-object', async () => {
  await assertThrows(() => validateConfig(null), 'config must be an object')
  await assertThrows(() => validateConfig([]), 'config must be an object')
})

await test('validateConfig requires name', async () => {
  await assertThrows(() => validateConfig({
    expectedClientInject: [],
    packedAllowlist: [],
  }), 'config.name is required')
})

await test('validateConfig requires expectedClientInject', async () => {
  await assertThrows(() => validateConfig({
    name: '@scope/app',
    packedAllowlist: [],
  }), 'expectedClientInject must be an array of strings')
})

await test('validateConfig requires packedAllowlist', async () => {
  await assertThrows(() => validateConfig({
    name: '@scope/app',
    expectedClientInject: [],
  }), 'packedAllowlist must be an array of strings')
})

await test('validateConfig rejects unknown keys', async () => {
  await assertThrows(() => validateConfig({
    name: '@scope/app',
    expectedClientInject: [],
    packedAllowlist: [],
    extraFiles: ['NOTICE'],
  }), 'unknown keys: extraFiles')
})

await test('validateConfig rejects unknown require flags and non-booleans', async () => {
  await assertThrows(() => validateConfig({
    name: '@scope/app',
    expectedClientInject: [],
    packedAllowlist: [],
    require: { notAFlag: true },
  }), 'require has unknown keys: notAFlag')
  await assertThrows(() => validateConfig({
    name: '@scope/app',
    expectedClientInject: [],
    packedAllowlist: [],
    require: { publishable: 'yes' },
  }), 'require.publishable must be a boolean')
})

await test('validateConfig fills defaults', () => {
  const config = validateConfig({
    name: '@scope/app',
    expectedClientInject: ['@wha1echai/dsh-webpage'],
    packedAllowlist: ['package/package.json'],
  })
  assert(config.allowFileDshPins === false, 'allowFileDshPins should default false')
  assert(config.patchMustInclude.length === 0, 'patchMustInclude should default []')
  assert(config.patchMustNotInclude.length === 0, 'patchMustNotInclude should default []')
  assert(config.require.publishable === true, 'publishable should default on')
  assert(config.require.noPrepare === true, 'noPrepare should default on')
  assert(config.require.singleTarball === true, 'singleTarball should default on')
})

await test('lint passes on the fixture', async () => {
  await run(passFixture, '--lint')
})

await test('lint fails when private is true', async () => {
  const directory = copyFailFixture()
  const manifestPath = join(directory, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.private = true
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await assertThrows(() => run(directory, 'lint'), 'package must remain publishable')
})

await test('lint fails on trailing whitespace', async () => {
  const directory = copyFailFixture()
  writeFileSync(join(directory, 'README.md'), 'hello  \n')
  await assertThrows(() => run(directory, '--lint'), 'trailing whitespace')
})

await test('lint fails when prepare is present', async () => {
  const directory = copyFailFixture()
  const manifestPath = join(directory, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.scripts = { prepare: 'tsc -b' }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await assertThrows(() => run(directory, '--lint'), 'prepare or install scripts')
})

await test('unknown mode fails after config load', async () => {
  await assertThrows(() => run(passFixture, '--wat'), 'unknown mode --wat')
})

await test('comparePackedAllowlist is order-independent', () => {
  const expected = ['package/LICENSE', 'package/package.json']
  const actual = ['package/package.json', 'package/LICENSE']
  const result = comparePackedAllowlist(actual, expected)
  assert(result.ok === true, 'same set in different order should match')
})

await test('comparePackedAllowlist reports extra and missing paths', () => {
  const extra = comparePackedAllowlist(
    ['package/package.json', 'package/NOTICE'],
    ['package/package.json'],
  )
  assert(extra.ok === false, 'extra path should not match')
  assert(extra.actual.includes('package/NOTICE'), 'actual should keep the extra path')
  const missing = comparePackedAllowlist(
    ['package/package.json'],
    ['package/package.json', 'package/LICENSE'],
  )
  assert(missing.ok === false, 'missing path should not match')
  assert(missing.expected.includes('package/LICENSE'), 'expected should keep the missing path')
})

for (const directory of temps) {
  rmSync(directory, { recursive: true, force: true })
}

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`${passed} passed`)
