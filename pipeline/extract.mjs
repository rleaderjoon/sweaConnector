// 학습 저장소 -> content.json
// 사용법: node pipeline/extract.mjs --repo <학습저장소경로> [--out content.json]

import { writeFile } from 'node:fs/promises'
import { readStudyRepo } from './lib.mjs'
import { readConcepts } from './concepts.mjs'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1]

if (!args.repo) {
  console.error('usage: node pipeline/extract.mjs --repo <path> [--out content.json]')
  process.exit(2)
}

const { config, baseline, weeks, problems, skipped } = await readStudyRepo(args.repo)
const concepts = await readConcepts()

for (const name of skipped) console.warn(`  skip (규약 불일치): ${name}`)

const out = args.out ?? 'content.json'
await writeFile(out, JSON.stringify({
  generatedAt: new Date().toISOString(),
  config, baseline, weeks, problems, concepts,
}, null, 2), 'utf8')

const tally = {}
for (const p of problems) tally[p.status] = (tally[p.status] ?? 0) + 1

console.log(`문제 ${problems.length}개 · 개념 ${concepts.length}개 -> ${out}`)
console.log(`골격 기준선: basic=${baseline.basic}줄  pro=${baseline.pro}줄  drill=${baseline.drill}줄`)
for (const [status, n] of Object.entries(tally)) console.log(`  ${status}: ${n}`)
