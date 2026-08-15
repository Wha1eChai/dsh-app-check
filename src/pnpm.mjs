import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

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
  if (process.platform === 'win32') {
    const commands = execFileSync('where.exe', ['corepack.cmd'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
    for (const command of commands) {
      const corepackCli = join(dirname(command), 'node_modules', 'corepack', 'dist', 'corepack.js')
      if (!existsSync(corepackCli)) continue
      const prefix = ['pnpm@11.7.0']
      const version = execFileSync(process.execPath, [corepackCli, ...prefix, '--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
      if (version === '11.7.0') return { cli: corepackCli, prefix }
    }
  }
  fail('could not locate pnpm 11.7.0 through npm_execpath or Corepack')
}
