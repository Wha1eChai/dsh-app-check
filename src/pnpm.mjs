import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

/** @returns {string[]} */
function corepackCliCandidates() {
  const candidates = []
  const nodeDir = dirname(process.execPath)
  candidates.push(
    join(nodeDir, '..', 'lib', 'node_modules', 'corepack', 'dist', 'corepack.js'),
    join(nodeDir, 'node_modules', 'corepack', 'dist', 'corepack.js'),
  )
  if (process.platform === 'win32') {
    try {
      const commands = execFileSync('where.exe', ['corepack.cmd'], { encoding: 'utf8' })
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
      for (const command of commands) {
        candidates.unshift(join(dirname(command), 'node_modules', 'corepack', 'dist', 'corepack.js'))
      }
    } catch {
      // where.exe may fail when corepack.cmd is not on PATH
    }
  }
  return candidates
}

/** @returns {{ cli: string, prefix: string[] } | null} */
function tryCorepackPnpm() {
  const prefix = ['pnpm@11.7.0']
  for (const corepackCli of corepackCliCandidates()) {
    if (!existsSync(corepackCli)) continue
    try {
      const version = execFileSync(process.execPath, [corepackCli, ...prefix, '--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
      if (version === '11.7.0') return { cli: resolve(corepackCli), prefix }
    } catch {
      // try the next Corepack install layout
    }
  }
  return null
}

/**
 * @param {(message: string) => never} fail
 * @returns {{ cli: string, prefix: string[] }}
 */
export function locatePnpm(fail) {
  const cli = process.env.npm_execpath
  if (typeof cli === 'string' && cli.length > 0 && existsSync(cli)) {
    try {
      const version = execFileSync(process.execPath, [cli, '--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
      if (version === '11.7.0') return { cli: resolve(cli), prefix: [] }
    } catch {
      // Nested pnpm 11.0.9 from `pnpm run` is not usable; fall through to Corepack.
    }
  }
  const corepack = tryCorepackPnpm()
  if (corepack) return corepack
  fail('could not locate pnpm 11.7.0 through npm_execpath or Corepack')
}
