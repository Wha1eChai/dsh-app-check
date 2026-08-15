#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTRACT_VERSION } from './constants.mjs'
import { run } from './check.mjs'

const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-v')) {
  const manifest = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'))
  console.log(`${manifest.name} ${manifest.version}`)
  console.log(`contract: ${CONTRACT_VERSION}`)
  process.exit(0)
}

const mode = args.find(arg => arg === '--lint' || arg === '--pack')
  ?? args.find(arg => arg.startsWith('--'))
await run(process.cwd(), mode)
