import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CONFIG_KEYS, CONFIG_NAME, REQUIRE_DEFAULTS, REQUIRE_KEYS } from './constants.mjs'

/**
 * @typedef {object} AppCheckRequire
 * @property {boolean} [publishable]
 * @property {boolean} [packageManager]
 * @property {boolean} [enginesNode]
 * @property {boolean} [clientPlatformWeb]
 * @property {boolean} [webpagePeer]
 * @property {boolean} [noWorkspaceRanges]
 * @property {boolean} [noAdjacentCheckout]
 * @property {boolean} [noForbiddenUi]
 * @property {boolean} [localeZhEn]
 * @property {boolean} [bundlePatch]
 * @property {boolean} [loaderPreset]
 * @property {boolean} [applyOnlyExport]
 * @property {boolean} [invariantExport]
 * @property {boolean} [clientExport]
 * @property {boolean} [noNodeDefaultExport]
 * @property {boolean} [clientCssInjection]
 * @property {boolean} [singleTarball]
 * @property {boolean} [noPrepare]
 */

/**
 * @typedef {object} AppCheckConfig
 * @property {string} name
 * @property {string[]} expectedClientInject
 * @property {string[]} packedAllowlist
 * @property {string[]} [patchMustInclude]
 * @property {string[]} [patchMustNotInclude]
 * @property {boolean} [allowFileDshPins]
 * @property {AppCheckRequire} [require]
 */

/**
 * @typedef {object} NormalizedAppCheckConfig
 * @property {string} name
 * @property {string[]} expectedClientInject
 * @property {string[]} packedAllowlist
 * @property {string[]} patchMustInclude
 * @property {string[]} patchMustNotInclude
 * @property {boolean} allowFileDshPins
 * @property {Required<AppCheckRequire>} require
 */

/**
 * @param {unknown} raw
 * @returns {NormalizedAppCheckConfig}
 */
export function validateConfig(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('dsh-app-check config must be an object')
  }
  const record = /** @type {Record<string, unknown>} */ (raw)
  const unknown = Object.keys(record).filter(key => !CONFIG_KEYS.includes(key))
  if (unknown.length > 0) {
    throw new Error(`dsh-app-check config has unknown keys: ${unknown.join(', ')}`)
  }
  if (typeof record.name !== 'string' || record.name.length === 0) {
    throw new Error('dsh-app-check config.name is required')
  }
  if (!isStringArray(record.expectedClientInject)) {
    throw new Error('dsh-app-check config.expectedClientInject must be an array of strings')
  }
  if (!isStringArray(record.packedAllowlist)) {
    throw new Error('dsh-app-check config.packedAllowlist must be an array of strings')
  }
  if (record.patchMustInclude !== undefined && !isStringArray(record.patchMustInclude)) {
    throw new Error('dsh-app-check config.patchMustInclude must be an array of strings')
  }
  if (record.patchMustNotInclude !== undefined && !isStringArray(record.patchMustNotInclude)) {
    throw new Error('dsh-app-check config.patchMustNotInclude must be an array of strings')
  }
  if (record.allowFileDshPins !== undefined && typeof record.allowFileDshPins !== 'boolean') {
    throw new Error('dsh-app-check config.allowFileDshPins must be a boolean')
  }
  const requireFlags = normalizeRequire(record.require)
  return {
    name: record.name,
    expectedClientInject: record.expectedClientInject,
    packedAllowlist: record.packedAllowlist,
    patchMustInclude: record.patchMustInclude ?? [],
    patchMustNotInclude: record.patchMustNotInclude ?? [],
    allowFileDshPins: record.allowFileDshPins === true,
    require: requireFlags,
  }
}

/**
 * @param {string | URL} [configPathOrCwd]
 * @returns {string}
 */
export function resolveConfigPath(configPathOrCwd = process.cwd()) {
  const path = toPath(configPathOrCwd)
  if (!existsSync(path)) {
    throw new Error(`dsh-app-check: path not found: ${path}`)
  }
  if (statSync(path).isFile()) {
    if (isConfigFile(path)) return path
    let dir = dirname(path)
    while (true) {
      const candidate = join(dir, CONFIG_NAME)
      if (existsSync(candidate)) return candidate
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    throw new Error(`dsh-app-check: could not find ${CONFIG_NAME} from ${path}`)
  }
  const candidate = join(path, CONFIG_NAME)
  if (existsSync(candidate)) return candidate
  throw new Error(`dsh-app-check: could not find ${CONFIG_NAME} in ${path}`)
}

/**
 * @param {string | URL} [configPathOrCwd]
 * @returns {Promise<{ root: string, configPath: string, config: NormalizedAppCheckConfig }>}
 */
export async function loadResolvedConfig(configPathOrCwd = process.cwd()) {
  const configPath = resolveConfigPath(configPathOrCwd)
  const href = `${pathToFileURL(configPath).href}?t=${Date.now()}`
  const module = await import(href)
  return {
    root: dirname(configPath),
    configPath,
    config: validateConfig(module.default),
  }
}

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
function isStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

/**
 * @param {unknown} raw
 * @returns {Required<AppCheckRequire>}
 */
function normalizeRequire(raw) {
  if (raw === undefined) {
    return { ...REQUIRE_DEFAULTS }
  }
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('dsh-app-check config.require must be an object of boolean flags')
  }
  const record = /** @type {Record<string, unknown>} */ (raw)
  const unknown = Object.keys(record).filter(key => !REQUIRE_KEYS.includes(key))
  if (unknown.length > 0) {
    throw new Error(`dsh-app-check config.require has unknown keys: ${unknown.join(', ')}`)
  }
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'boolean') {
      throw new Error(`dsh-app-check config.require.${key} must be a boolean`)
    }
  }
  return /** @type {Required<AppCheckRequire>} */ ({ ...REQUIRE_DEFAULTS, ...record })
}

/**
 * @param {string | URL} input
 * @returns {string}
 */
function toPath(input) {
  if (input instanceof URL) return fileURLToPath(input)
  if (typeof input === 'string' && input.startsWith('file:')) return fileURLToPath(new URL(input))
  if (typeof input === 'string') return resolve(input)
  throw new TypeError('dsh-app-check: configPathOrCwd must be a path or file URL')
}

/**
 * @param {string} path
 */
function isConfigFile(path) {
  return path.endsWith(CONFIG_NAME) || path.endsWith('.config.mjs')
}
