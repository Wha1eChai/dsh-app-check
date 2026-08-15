import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { locatePnpm } from './pnpm.mjs'

/**
 * Exact-set comparison used by `pnpm pack` + `tar -tzf`.
 * Both sides are sorted; order in the config does not matter.
 *
 * @param {string[]} actual
 * @param {string[]} expected
 * @returns {{ ok: boolean, actual: string[], expected: string[] }}
 */
export function comparePackedAllowlist(actual, expected) {
  const sortedActual = [...actual].filter(Boolean).sort()
  const sortedExpected = [...expected].filter(Boolean).sort()
  return {
    ok: JSON.stringify(sortedActual) === JSON.stringify(sortedExpected),
    actual: sortedActual,
    expected: sortedExpected,
  }
}

/**
 * @param {string} archive
 * @returns {string[]}
 */
export function packedFiles(archive) {
  const tar = process.platform === 'win32' ? 'tar.exe' : 'tar'
  // GNU tar (Git for Windows) treats `C:` in an absolute path as a remote host.
  return execFileSync(tar, ['-tzf', basename(archive)], {
    encoding: 'utf8',
    cwd: dirname(archive),
  })
    .split(/\r?\n/)
    .filter(Boolean)
}

/**
 * @param {string} root
 * @param {{ name: string, packedAllowlist: string[], require: { singleTarball: boolean } }} config
 * @param {(condition: unknown, message: string) => void} assert
 * @param {(message: string) => never} fail
 */
export function assertPackedPayload(root, config, assert, fail) {
  const label = packLabel(config.name)
  const directory = mkdtempSync(join(tmpdir(), `${label}-pack-`))
  try {
    const pnpm = locatePnpm(fail)
    execFileSync(process.execPath, [pnpm.cli, ...pnpm.prefix, '--dir', root, 'pack', '--pack-destination', directory], { stdio: 'pipe' })
    const archives = readdirSync(directory).filter(file => file.endsWith('.tgz'))
    if (config.require.singleTarball) {
      assert(archives.length === 1, `expected one packed tarball, found ${archives.length}`)
    }
    const files = packedFiles(join(directory, archives[0])).sort()
    const comparison = comparePackedAllowlist(files, config.packedAllowlist)
    assert(comparison.ok, `packed payload mismatch:\nexpected ${comparison.expected.join(', ')}\nactual ${comparison.actual.join(', ')}`)
    console.log(`Verified packed payload: ${archives[0]} (${files.length} files)`)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

/**
 * @param {string} name
 */
function packLabel(name) {
  const unscoped = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name
  return unscoped.replace(/[^A-Za-z0-9._-]+/g, '-')
}
