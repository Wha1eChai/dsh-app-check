# @dshapps/app-check

Executable authoring-contract checks for DSH Webpage Apps. The package major version tracks the authoring contract version (currently `1`); a DSH target bump raises both. `--version` prints `contract: 1`.

This release is the check core only (`--lint` / `--pack`). It does not ship tsdown or vitest presets.

## What it checks

`--lint` — package name, `dsh.client.inject`, bundle patch, DSH and cordis pins, source trailing whitespace, `codeSplitting: false`, patch hygiene, and every `require` flag that is left on.

`--pack` — lint, plus built artifact shape (`apply` only, Loader handoff, client externals whitelist) and `pnpm pack` + `tar -tzf` against an exact allowlist. Archives are listed from the archive directory so Git's GNU tar does not treat a Windows drive letter as a remote host.

Shared, not configurable: DSH `0.1.0-rc.6`, cordis `4.0.1`, the 11 client externals, trailing-whitespace scan, `codeSplitting: false`, Node exports `["apply"]`, Corepack fallback to pnpm `11.7.0`.

## Requirements

- DSH `0.1.0-rc.6` (the contract target the kit pins consumers to)
- Node `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

## Consume

Nothing in this family is published to npm yet. App repos currently depend on this package as `file:../dsh-app-check`. The documented entry is a thin wrapper; the migrated Apps (usage, notes, jobs) all use it:

```js
// scripts/check.mjs
import { run } from '@dshapps/app-check'

const mode = process.argv.find(arg => arg.startsWith('--'))
await run(import.meta.url, mode)
```

```json
{
  "scripts": {
    "lint": "node scripts/check.mjs --lint",
    "pack:verify": "node scripts/check.mjs --pack"
  },
  "devDependencies": {
    "@dshapps/app-check": "file:../dsh-app-check"
  }
}
```

`dsh-app-check --lint` (the package bin) is an alternative that runs the same `run()` against `process.cwd()`.

On machines where nested `pnpm run` resolves pnpm `11.0.9` against `packageManager: pnpm@11.7.0`, invoke the scripts directly: `node scripts/check.mjs --lint`, `node scripts/check.mjs --pack`.

## Config

`dsh-app-check.config.mjs` at the App repo root, default-exporting:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Must match `package.json` `name` |
| `expectedClientInject` | yes | Exact `dsh.client.inject` array |
| `packedAllowlist` | yes | Exact packed path set |
| `patchMustInclude` | no | Extra patch needles; own `name: '<name>'` is always required |
| `patchMustNotInclude` | no | Extra forbidden needles; `name: '@dshapps/webpage'` is always forbidden |
| `allowFileDshPins` | no | Default `false`; when `true`, `@deepseek-ai/dsh*` may be `file:` |
| `require` | no | Boolean flags; all default to on |

`require` flags: `publishable`, `packageManager`, `enginesNode`, `clientPlatformWeb`, `webpagePeer`, `noWorkspaceRanges`, `noAdjacentCheckout`, `noForbiddenUi`, `localeZhEn`, `bundlePatch`, `loaderPreset`, `applyOnlyExport`, `invariantExport`, `clientExport`, `noNodeDefaultExport`, `clientCssInjection`, `singleTarball`, `noPrepare`.

`bundlePatch` (default on) requires `dsh.bundle.patch: ./cordis.patch.yml` on the App package and that the patch insert only this plugin. Heavy-service Bundles that own the patch on a sibling pack package turn it off.

`loaderPreset` (default on) requires `tsdown.client.ts` at the App package root with `codeSplitting: false`. Monorepos that keep the Loader preset at the workspace root turn it off; `--pack` still checks the built `lib/client.js` for the Loader handoff.

`applyOnlyExport` (default on) requires the Node entry to export only `apply`. Host-service packages that also publish a public API turn it off; `apply` itself remains required.

## Verify

```powershell
node test/self-test.mjs
```

## Family

The platform repository [dsh-webpage](https://github.com/Wha1eChai/dsh-webpage) holds the kernel, the authoring contract, and the docs. Start a new App from [dsh-app-template](https://github.com/Wha1eChai/dsh-app-template). Apps live in their own repositories on purpose.
