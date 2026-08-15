/** Authoring contract version. Kit major version tracks this number. */
export const CONTRACT_VERSION = 1

export const RC6 = '0.1.0-rc.6'
export const CORDIS = '4.0.1'
export const PACKAGE_MANAGER = 'pnpm@11.7.0'
export const ENGINES_NODE = '^22.19.0 || >=24.0.0'
export const WEBPAGE_NAME = '@wha1echai/dsh-webpage'
export const WEBPAGE_PEER = '0.1.0'
export const CONFIG_NAME = 'dsh-app-check.config.mjs'
export const NODE_EXPORT_KEYS = '["apply"]'
export const INSTALL_SCRIPT_NAMES = ['prepare', 'preinstall', 'install', 'postinstall']
export const FORBIDDEN_UI = /react-router|tailwindcss|@mui\//i
export const TRAILING_WHITESPACE = /[ \t]+\r?\n/
export const CJK = /[\u4e00-\u9fff]/u

export const CLIENT_EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment', '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
]

/** @type {readonly string[]} */
export const REQUIRE_KEYS = [
  'publishable',
  'packageManager',
  'enginesNode',
  'clientPlatformWeb',
  'webpagePeer',
  'noWorkspaceRanges',
  'noAdjacentCheckout',
  'noForbiddenUi',
  'localeZhEn',
  'invariantExport',
  'clientExport',
  'noNodeDefaultExport',
  'clientCssInjection',
  'singleTarball',
  'noPrepare',
]

/**
 * Jobs-superset defaults: every flag on, plus noPrepare.
 * @type {Readonly<Record<string, boolean>>}
 */
export const REQUIRE_DEFAULTS = Object.freeze(Object.fromEntries(REQUIRE_KEYS.map(key => [key, true])))

/** @type {readonly string[]} */
export const CONFIG_KEYS = [
  'name',
  'expectedClientInject',
  'packedAllowlist',
  'patchMustInclude',
  'patchMustNotInclude',
  'allowFileDshPins',
  'require',
]
