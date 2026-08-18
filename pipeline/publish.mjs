// 학습 저장소  ->  .swea/  (앱이 조각 단위로 받아 가는 배포 형식)
//
// 한 덩어리 JSON 이 아니라 조각으로 나누는 이유:
// 앱이 재시작할 때 index.json(작다) 하나만 받아 해시를 비교하고, 바뀐 조각만 내려받으면 된다.
// 한 덩어리면 한 글자만 고쳐도 전부 새 파일이라 매번 전체를 다시 받아야 한다.
//
// 메타(제목·상태·유형)는 인덱스에만 둔다. 그래야 진도만 바뀌었을 때 본문 조각은 그대로다.
//
// 사용법: node pipeline/publish.mjs --repo <학습저장소경로> [--out <경로>]

import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { buildContent } from './content.mjs'

export const FORMAT_VERSION = 1
export const OUT_DIRNAME = '.swea'

const enc = obj => Buffer.from(JSON.stringify(obj), 'utf8')
const hashOf = buf => createHash('sha256').update(buf).digest('hex').slice(0, 16)

/** 학습 저장소를 읽어 .swea/ 를 쓴다. 내용이 같은 파일은 건드리지 않는다(git diff 를 작게 유지). */
export async function publish(repo, outDir = join(repo, OUT_DIRNAME)) {
  const content = await buildContent(repo)

  const problemsDir = join(outDir, 'problems')
  const conceptsDir = join(outDir, 'concepts')
  await mkdir(problemsDir, { recursive: true })
  await mkdir(conceptsDir, { recursive: true })

  const changed = []

  const problems = []
  for (const p of content.problems) {
    const buf = enc(p.body)
    if (await writeIfChanged(join(problemsDir, `${p.meta.key}.json`), buf)) changed.push(p.meta.key)
    problems.push({ ...p.meta, hash: hashOf(buf) })
  }

  const concepts = []
  for (const c of content.concepts) {
    const buf = enc(c.body)
    if (await writeIfChanged(join(conceptsDir, `${c.meta.id}.json`), buf)) changed.push(c.meta.id)
    concepts.push({ ...c.meta, hash: hashOf(buf) })
  }

  const diagramsBuf = enc(content.diagrams)
  if (await writeIfChanged(join(outDir, 'diagrams.json'), diagramsBuf)) changed.push('diagrams')

  const removed = [
    ...await pruneStale(problemsDir, content.problems.map(p => `${p.meta.key}.json`)),
    ...await pruneStale(conceptsDir, content.concepts.map(c => `${c.meta.id}.json`)),
  ]

  const body = {
    config: content.config,
    weeks: content.weeks,
    problems,
    concepts,
    diagramsHash: hashOf(diagramsBuf),
  }
  // 내용이 그대로면 시각도 그대로 둔다. 매번 갱신하면 바뀐 게 없어도 커밋할 게 생긴다.
  const index = { formatVersion: FORMAT_VERSION, generatedAt: await keepOrStamp(outDir, body), ...body }
  const indexChanged = await writeIfChanged(join(outDir, 'index.json'), enc(index))

  const bytes = Buffer.byteLength(JSON.stringify(index))
  return {
    outDir,
    problems: problems.length,
    concepts: concepts.length,
    diagrams: Object.keys(content.diagrams).length,
    indexBytes: bytes,
    indexChanged,
    changed,
    removed,
    skipped: content.skipped,
    baseline: content.baseline,
    counts: tally(problems.map(p => p.status)),
  }
}

/** 인덱스 알맹이가 이전과 같으면 이전 시각을 그대로 쓴다. */
async function keepOrStamp(outDir, body) {
  try {
    const { generatedAt, formatVersion, ...prev } = JSON.parse(await readFile(join(outDir, 'index.json'), 'utf8'))
    if (formatVersion === FORMAT_VERSION && JSON.stringify(prev) === JSON.stringify(body)) return generatedAt
  } catch {
    // 없거나 깨진 인덱스
  }
  return new Date().toISOString()
}

async function writeIfChanged(path, buf) {
  try {
    if (Buffer.compare(await readFile(path), buf) === 0) return false
  } catch {
    // 없던 파일
  }
  await writeFile(path, buf)
  return true
}

/** 저장소에서 사라진 문제의 조각 파일을 지운다. 안 지우면 앱이 유령 항목을 계속 들고 있다. */
async function pruneStale(dir, keep) {
  const alive = new Set(keep)
  const gone = []
  for (const f of await readdir(dir)) {
    if (f.endsWith('.json') && !alive.has(f)) {
      await unlink(join(dir, f))
      gone.push(f.replace(/\.json$/, ''))
    }
  }
  return gone
}

function tally(items) {
  const t = {}
  for (const i of items) t[i] = (t[i] ?? 0) + 1
  return t
}

// ---------------------------------------------------------------- CLI

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('publish.mjs')) {
  const args = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1]

  if (!args.repo) {
    console.error('usage: node pipeline/publish.mjs --repo <path> [--out <dir>]')
    process.exit(2)
  }

  const r = await publish(args.repo, args.out)
  for (const name of r.skipped) console.warn(`  skip (규약 불일치): ${name}`)
  console.log(`문제 ${r.problems} · 개념 ${r.concepts} · 도식 ${r.diagrams}  ->  ${r.outDir}  (index ${(r.indexBytes / 1024).toFixed(0)}KB)`)
  console.log(`바뀐 조각 ${r.changed.length}개${r.removed.length ? ` · 삭제 ${r.removed.length}개` : ''}`)
  console.log(`골격 기준선: basic=${r.baseline.basic}줄  pro=${r.baseline.pro}줄  drill=${r.baseline.drill}줄`)
  console.log('상태: ' + Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(' · '))
}
