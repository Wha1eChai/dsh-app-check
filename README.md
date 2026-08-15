# @wha1echai/dsh-app-check

Executable authoring-contract checks for DSH Webpage Apps.

**Contract version is this package's major version** (currently `1`). A DSH target bump (rc.6 → rc.7) raises the contract and this major; re-run the kit instead of re-reading kernel source. `--version` prints `contract: 1`.

This release is the check core only (`--lint` / `--pack`). tsdown and vitest presets are a later slice.

## What it checks

`--lint` — package name, inject list, bundle patch, DSH/cordis pins, source trailing whitespace, `codeSplitting: false`, patch hygiene, and (by default) the jobs-superset manifest and source rules.

`--pack` — lint, plus built artifact shape (`apply` only, Loader handoff, client externals whitelist) and `pnpm pack` + `tar -tzf` against an exact allowlist.

Shared, not configurable: DSH `0.1.0-rc.6`, cordis `4.0.1`, the 11 client externals, trailing-whitespace scan, `codeSplitting: false`, Node exports `["apply"]`, Corepack fallback to pnpm `11.7.0` (nested `pnpm run` may resolve `11.0.9`).

## Usage

```js
// package.json
{
  "scripts": {
    "lint": "dsh-app-check --lint",
    "pack:verify": "dsh-app-check --pack"
  },
  "devDependencies": {
    "@wha1echai/dsh-app-check": "1.0.0"
  }
}
```

Thin wrapper (same modes):

```js
import { run } from '@wha1echai/dsh-app-check'
await run(import.meta.url, process.argv.find(arg => arg.startsWith('--')))
```

## Config

`dsh-app-check.config.mjs` at the App repo root, default-exporting:

- `name` (required) — must match `package.json` `name`
- `expectedClientInject` (required) — exact `dsh.client.inject` array
- `packedAllowlist` (required) — exact packed path set
- `patchMustInclude` — extra patch needles; own `name: '<name>'` is always required
- `patchMustNotInclude` — extra forbidden needles; `name: '@wha1echai/dsh-webpage'` is always forbidden
- `allowFileDshPins` — default `false`; when `true`, `@deepseek-ai/dsh*` may be `file:`
- `require` — boolean flags, **all default on**

`require` flags: `publishable`, `packageManager`, `enginesNode`, `clientPlatformWeb`, `webpagePeer`, `noWorkspaceRanges`, `noAdjacentCheckout`, `noForbiddenUi`, `localeZhEn`, `invariantExport`, `clientExport`, `noNodeDefaultExport`, `clientCssInjection`, `singleTarball`, `noPrepare`.
