import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadResolvedConfig } from './config.mjs'
import {
  CJK,
  CLIENT_EXTERNALS,
  CORDIS,
  ENGINES_NODE,
  FORBIDDEN_UI,
  INSTALL_SCRIPT_NAMES,
  NODE_EXPORT_KEYS,
  PACKAGE_MANAGER,
  RC6,
  TRAILING_WHITESPACE,
  WEBPAGE_NAME,
  WEBPAGE_PEER,
} from './constants.mjs'
import { assertPackedPayload } from './pack.mjs'

/**
 * @param {string} name
 */
export function checkLabel(name) {
  return name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name
}

/**
 * @param {string} name
 */
export function createAssert(name) {
  const label = checkLabel(name)
  /**
   * @param {string} message
   * @returns {never}
   */
  function fail(message) {
    throw new Error(`${label} check failed: ${message}`)
  }
  /**
   * @param {unknown} condition
   * @param {string} message
   */
  function assert(condition, message) {
    if (!condition) fail(message)
  }
  return { assert, fail }
}

/**
 * @param {string} path
 */
async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function sourceFiles(dir) {
  const result = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'lib' || entry.name === '.git' || entry.name === 'coverage') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) result.push(...await sourceFiles(path))
    else if (/\.(?:ts|tsx|css|mjs|json|yml|md)$/.test(entry.name)) result.push(path)
  }
  return result
}

/**
 * @param {string} root
 * @param {import('./config.mjs').NormalizedAppCheckConfig} config
 * @param {{ assert: (condition: unknown, message: string) => void }} tools
 */
export async function assertManifest(root, config, tools) {
  const { assert } = tools
  const req = config.require
  const manifest = await json(join(root, 'package.json'))
  assert(manifest.name === config.name, 'package name changed')
  if (req.publishable) assert(manifest.private !== true, 'package must remain publishable')
  if (req.packageManager) assert(manifest.packageManager === PACKAGE_MANAGER, `packageManager must be ${PACKAGE_MANAGER}`)
  if (req.enginesNode) assert(manifest.engines?.node === ENGINES_NODE, 'Node engine is not the frozen range')
  if (req.clientPlatformWeb) assert(manifest.dsh?.client?.platform === 'web', 'dsh.client.platform must be web')
  if (req.bundlePatch) assert(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch is missing')
  assert(JSON.stringify(manifest.dsh?.client?.inject) === JSON.stringify(config.expectedClientInject), 'dsh.client.inject changed')
  if (req.webpagePeer) {
    assert(manifest.peerDependencies?.[WEBPAGE_NAME] === WEBPAGE_PEER, `webpage peer must be ${WEBPAGE_PEER}`)
  }
  if (req.noPrepare) {
    const scripts = manifest.scripts ?? {}
    const found = INSTALL_SCRIPT_NAMES.filter(name => Object.hasOwn(scripts, name))
    assert(found.length === 0, `package must not declare prepare or install scripts (${found.join(', ')})`)
  }
  for (const [name, version] of Object.entries({
    ...manifest.peerDependencies,
    ...manifest.devDependencies,
  })) {
    if (/^@deepseek-ai\/dsh(?:-|$)/.test(name)) {
      if (config.allowFileDshPins) {
        assert(version === RC6 || String(version).startsWith('file:'), `${name} must be pinned to ${RC6}`)
      } else {
        assert(version === RC6, `${name} must be pinned to ${RC6}, got ${version}`)
      }
    }
    if (name === '@deepseek-ai/cordis') assert(version === CORDIS, `${name} must be pinned to ${CORDIS}`)
    if (req.noWorkspaceRanges) {
      assert(!String(version).startsWith('workspace:'), `${name} leaks a workspace range`)
    }
  }
}

/**
 * @param {string} root
 * @param {import('./config.mjs').NormalizedAppCheckConfig} config
 * @param {{ assert: (condition: unknown, message: string) => void }} tools
 */
export async function assertSources(root, config, tools) {
  const { assert } = tools
  const req = config.require
  const forbiddenCheckout = ['deepseek', 'harness'].join('-')
  const checkScript = join(root, 'scripts', 'check.mjs')
  const files = await sourceFiles(root)
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    assert(!TRAILING_WHITESPACE.test(text), `trailing whitespace in ${file}`)
    if (file === checkScript) continue
    if (req.noAdjacentCheckout) {
      assert(!text.includes(forbiddenCheckout), `source references adjacent checkout: ${file}`)
    }
    if (req.noForbiddenUi) {
      assert(!FORBIDDEN_UI.test(text), `forbidden UI/router dependency in ${file}`)
    }
  }
  if (req.loaderPreset) {
    const preset = await readFile(join(root, 'tsdown.client.ts'), 'utf8')
    assert(preset.includes('codeSplitting: false'), 'client preset must disable code splitting; the DSH Loader cannot load async chunks')
  }
  if (req.bundlePatch) {
    const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
    const mustInclude = [`name: '${config.name}'`, ...config.patchMustInclude]
    const mustNotInclude = [`name: '${WEBPAGE_NAME}'`, ...config.patchMustNotInclude]
    for (const needle of mustInclude) {
      assert(patch.includes(needle), `pack must list ${needle}`)
    }
    for (const needle of mustNotInclude) {
      const message = needle.includes(WEBPAGE_NAME)
        ? 'pack must not re-insert webpage; webpage is installed first'
        : `pack must not include ${needle}`
      assert(!patch.includes(needle), message)
    }
  }
  if (req.localeZhEn) {
    const locale = await readFile(join(root, 'src', 'client', 'locales.ts'), 'utf8')
    assert(locale.includes('zh') && locale.includes('en') && CJK.test(locale), 'locale dictionaries must include Chinese and English')
  }
}

/**
 * @param {string} root
 * @param {import('./config.mjs').NormalizedAppCheckConfig} config
 * @param {{ assert: (condition: unknown, message: string) => void }} tools
 */
export async function assertBuilt(root, config, tools) {
  const { assert } = tools
  const req = config.require
  const lib = join(root, 'lib')
  const nodePath = join(lib, 'index.js')
  const invariantPath = join(lib, 'invariant.js')
  const clientPath = join(lib, 'client.js')
  if (req.invariantExport) {
    assert(existsSync(nodePath) && existsSync(invariantPath) && existsSync(clientPath), 'built artifacts are missing; run pnpm build first')
  } else {
    assert(existsSync(nodePath) && existsSync(clientPath), 'built artifacts are missing')
  }
  const consumerRequire = createRequire(join(root, 'probe.cjs'))
  assert(consumerRequire.resolve(config.name) === nodePath, 'root export does not resolve to lib/index.js')
  if (req.invariantExport) {
    assert(consumerRequire.resolve(`${config.name}/invariant`) === invariantPath, 'invariant export does not resolve to lib/invariant.js')
  }
  if (req.clientExport) {
    assert(consumerRequire.resolve(`${config.name}/client`) === clientPath, 'client export does not resolve to lib/client.js')
  }
  const stamp = checkLabel(config.name)
  const nodeModule = await import(`${pathToFileURL(nodePath).href}?${stamp}=${Date.now()}`)
  assert(typeof nodeModule.apply === 'function', 'Node entry must export apply')
  if (req.applyOnlyExport) {
    assert(JSON.stringify(Object.keys(nodeModule).sort()) === NODE_EXPORT_KEYS, `Node exports must be named apply only, got ${Object.keys(nodeModule)}`)
  }
  if (req.noNodeDefaultExport) {
    assert(nodeModule.default === undefined, 'Node entry must not have a default export')
  }
  const client = await readFile(clientPath, 'utf8')
  assert(client.includes('window.__ModuleLoader__.load'), 'client artifact lacks Loader handoff')
  if (req.clientCssInjection) {
    assert(client.includes('data-plugin-css'), 'client artifact lacks CSS Modules injection')
  }
  const requireSpecifiers = [...client.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1])
  for (const specifier of requireSpecifiers) {
    assert(CLIENT_EXTERNALS.includes(specifier), `client artifact contains an unresolvable external require(${JSON.stringify(specifier)})`)
  }
}

/**
 * @param {string} [mode]
 * @returns {'lint' | 'pack' | 'version' | string}
 */
export function normalizeMode(mode) {
  if (mode === '--lint' || mode === 'lint') return 'lint'
  if (mode === '--pack' || mode === 'pack') return 'pack'
  if (mode === '--version' || mode === 'version') return 'version'
  return mode ?? '(none)'
}

/**
 * @param {string | URL} [configPathOrCwd]
 * @param {string} [mode]
 */
export async function run(configPathOrCwd = process.cwd(), mode) {
  const { root, config } = await loadResolvedConfig(configPathOrCwd)
  const tools = createAssert(config.name)
  const normalized = normalizeMode(mode)
  await assertManifest(root, config, tools)
  if (normalized === 'lint') {
    await assertSources(root, config, tools)
    console.log(`${checkLabel(config.name)} lint/source checks passed`)
    return
  }
  if (normalized === 'pack') {
    await assertSources(root, config, tools)
    await assertBuilt(root, config, tools)
    assertPackedPayload(root, config, tools.assert, tools.fail)
    console.log(`${checkLabel(config.name)} packed payload checks passed`)
    return
  }
  tools.fail(`unknown mode ${mode ?? '(none)'}`)
}
