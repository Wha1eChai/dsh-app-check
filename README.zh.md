# @dshapps/app-check

[English](README.md) | 中文

把写作合同做成一条命令。主版本号就是合同版本（当前是 `1`）；DSH 目标版本升级时两者一起升。`--version` 会打印 `contract: 1`。

这一版只有检查核心（`--lint` / `--pack`）。不附带 tsdown 或 vitest preset。

## 检查什么

`--lint` — 包名、`dsh.client.inject`、bundle patch、DSH 和 cordis 钉死版本、源码行尾空白、`codeSplitting: false`、patch 卫生，以及所有仍开着的 `require` 开关。

`--pack` — 在 lint 之上，再查构建产物形状（只有 `apply`、Loader 交接、client externals 白名单），以及 `pnpm pack` + `tar -tzf` 对照一份精确允许列表。归档从归档目录列出，避免 Git 自带的 GNU tar 把 Windows 盘符当成远程主机。

共享、不可配置：DSH `0.1.0-rc.6`，cordis `4.0.1`，11 个 client externals，行尾空白扫描，`codeSplitting: false`，Node exports `["apply"]`，Corepack 回退到 pnpm `11.7.0`。

## 要求

- DSH `0.1.0-rc.6`（kit 钉死给消费者的合同目标）
- Node `^22.19.0 || >=24.0.0`
- pnpm `11.7.0`

## 怎么用

这一家都还没上 npm。App 仓库目前用 `file:../dsh-app-check` 依赖这个包。文档入口是一层薄包装；已经迁过来的 App（usage、notes、jobs）都这样用：

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

`dsh-app-check --lint`（包的 bin）是另一种用法，对 `process.cwd()` 跑同一个 `run()`。

有些机器上嵌套的 `pnpm run` 会按 `packageManager: pnpm@11.7.0` 解析到 pnpm `11.0.9`，这时直接跑：`node scripts/check.mjs --lint`、`node scripts/check.mjs --pack`。

## 配置

App 仓库根目录放 `dsh-app-check.config.mjs`，default export：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 必须等于 `package.json` 的 `name` |
| `expectedClientInject` | 是 | 精确的 `dsh.client.inject` 数组 |
| `packedAllowlist` | 是 | 精确的打包路径集合 |
| `patchMustInclude` | 否 | 额外的 patch 针；自己的 `name: '<name>'` 始终要求 |
| `patchMustNotInclude` | 否 | 额外禁止的针；`name: '@dshapps/webpage'` 始终禁止 |
| `allowFileDshPins` | 否 | 默认 `false`；为 `true` 时 `@deepseek-ai/dsh*` 可以是 `file:` |
| `require` | 否 | 布尔开关；默认全开 |

`require` 开关：`publishable`、`packageManager`、`enginesNode`、`clientPlatformWeb`、`webpagePeer`、`noWorkspaceRanges`、`noAdjacentCheckout`、`noForbiddenUi`、`localeZhEn`、`bundlePatch`、`loaderPreset`、`applyOnlyExport`、`invariantExport`、`clientExport`、`noNodeDefaultExport`、`clientCssInjection`、`singleTarball`、`noPrepare`。

`bundlePatch`（默认开）要求 App 包上有 `dsh.bundle.patch: ./cordis.patch.yml`，并且 patch 只插入本插件。由兄弟 pack 包持有 patch 的重型服务 Bundle 把它关掉。

`loaderPreset`（默认开）要求 App 包根目录有 `tsdown.client.ts`，且 `codeSplitting: false`。把 Loader preset 放在 workspace 根的 monorepo 把它关掉；`--pack` 仍会检查构建出的 `lib/client.js` 是否完成 Loader 交接。

`applyOnlyExport`（默认开）要求 Node 入口只导出 `apply`。还要发布公共 API 的 Host 服务包把它关掉；`apply` 本身仍必须存在。

## 自检

```powershell
node test/self-test.mjs
```

## 这一家

平台仓库 [dsh-webpage](https://github.com/dshapps/dsh-webpage) 放内核、写作合同和文档。新 App 从 [dsh-app-template](https://github.com/dshapps/dsh-app-template) 起步。App 故意各自独立成库。

使用 [MIT License](LICENSE)。
