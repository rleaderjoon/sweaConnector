// 학습 저장소 + 개념 사전 + 도식  ->  content.json (앱이 읽는 단 하나의 파일)
// 사용법: node pipeline/extract.mjs --repo <학습저장소경로> [--out content.json]
//
// 앱은 런타임에 마크다운도 SVG 도 파싱하지 않는다. 전부 여기서 블록/도형으로 미리 바꾼다.

import { writeFile } from 'node:fs/promises'
import { readStudyRepo } from './lib.mjs'
import { readConcepts } from './concepts.mjs'
import { readDiagrams } from './svg.mjs'
import { toBlocks } from './markdown.mjs'

// 앱은 읽는 물건이다. 링크만 든 섹션과 체크리스트용 섹션은 지면을 먹기만 한다.
// (원본 문제 링크는 출처 문자열로 대신 메타 줄에 들어간다)
const SKIP_SECTIONS = new Set(['시작 전 3단계 (건너뛰지 말 것)', '원본 문제'])

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1]

if (!args.repo) {
  console.error('usage: node pipeline/extract.mjs --repo <path> [--out content.json]')
  process.exit(2)
}

const { config, baseline, weeks, problems, skipped } = await readStudyRepo(args.repo)
const concepts = await readConcepts()
const diagrams = await readDiagrams()

for (const name of skipped) console.warn(`  skip (규약 불일치): ${name}`)

const app = {
  generatedAt: new Date().toISOString(),
  config,
  weeks,
  problems: problems.map(p => ({
    key: p.key,
    week: p.week,
    day: p.day,
    problemId: p.problemId,
    title: p.title,
    type: p.type,
    difficulty: p.difficulty,
    topic: p.topic,
    source: p.source,
    status: p.status,
    scheduledOn: p.scheduledOn,
    solvedAt: p.solvedAt,
    attempts: p.attempts,
    timeSpentMin: p.timeSpentMin,
    concepts: p.concepts,
    diagram: p.diagram,
    sections: Object.entries(p.sections)
      .filter(([name]) => !SKIP_SECTIONS.has(name))
      .map(([name, text]) => ({ name, blocks: toBlocks(text) })),
    solution: p.solution ? { file: p.solution.file, lang: p.solution.lang, code: p.solution.code } : null,
  })),
  concepts: concepts.map(c => ({
    id: c.id,
    title: c.title,
    tags: c.tags,
    diagram: c.diagram,
    blocks: toBlocks(c.body),
  })),
  diagrams,
}

const out = args.out ?? 'content.json'
await writeFile(out, JSON.stringify(app), 'utf8')

const tally = {}
for (const p of problems) tally[p.status] = (tally[p.status] ?? 0) + 1
const bytes = Buffer.byteLength(JSON.stringify(app))

console.log(`문제 ${app.problems.length} · 개념 ${app.concepts.length} · 도식 ${Object.keys(diagrams).length}  ->  ${out}  (${(bytes / 1024).toFixed(0)}KB)`)
console.log(`골격 기준선: basic=${baseline.basic}줄  pro=${baseline.pro}줄  drill=${baseline.drill}줄`)
console.log('상태: ' + Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · '))
