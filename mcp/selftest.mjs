// 자체 검증: 툴 5개를 fixtures 사본에 대고 돌리고, 실제 MCP 핸드셰이크까지 확인한다.
// 사용법: node mcp/selftest.mjs

import assert from 'node:assert/strict'
import { cp, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listProblems, getProblem, recordProgress, appendNote, scheduleStatus } from './tools.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = await mkdtemp(join(tmpdir(), 'swea-selftest-'))
let passed = 0

const check = (name, fn) => fn().then(
  () => { console.log(`  ok   ${name}`); passed++ },
  e => { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1 }
)

await cp(join(ROOT, 'fixtures', 'sample-study-repo'), repo, { recursive: true })
await writeFile(join(repo, '.sweaconnector.json'), JSON.stringify({ startDate: '2026-01-01', examDate: '2026-02-01' }))

console.log('툴 동작')

await check('list_problems — 전체 2개', async () => {
  const r = await listProblems(repo)
  assert.equal(r.count, 2)
})

await check('list_problems — status 필터', async () => {
  assert.equal((await listProblems(repo, { status: 'solved' })).count, 1)
  assert.equal((await listProblems(repo, { status: 'todo' })).count, 1)
})

await check('list_problems — query 검색', async () => {
  assert.equal((await listProblems(repo, { query: '구간' })).count, 1)
  assert.equal((await listProblems(repo, { query: '없는말' })).count, 0)
})

await check('get_problem — 섹션과 풀이 코드', async () => {
  const p = await getProblem(repo, { key: 'w1d1_1001_prefixsum' })
  assert.equal(p.status, 'solved')
  assert.equal(p.statusSource, 'frontmatter')
  assert.equal(p.solution.file, 'Main.java')
  assert.ok(p.sections['접근 힌트'].includes('누적합'))
  assert.equal(p.scheduledOn, '2026-01-01')
})

await check('get_problem — 없는 key 는 오류', async () => {
  await assert.rejects(() => getProblem(repo, { key: 'nope' }), /찾을 수 없습니다/)
})

await check('record_progress — 프론트매터 기록, 본문 보존', async () => {
  const file = join(repo, 'src', 'w1d2_2001_ledger', 'NOTES.md')
  const before = await readFile(file, 'utf8')
  await recordProgress(repo, { key: 'w1d2_2001_ledger', status: 'attempting', attempts: 1, timeSpentMin: 50 })
  const after = await readFile(file, 'utf8')

  assert.ok(after.startsWith('---\n'), '프론트매터가 앞에 붙어야 한다')
  assert.ok(after.includes('status: attempting'))
  assert.ok(after.includes('timeSpentMin: 50'))
  assert.ok(after.includes('## 접근 힌트'), '본문 섹션이 살아 있어야 한다')
  assert.ok(after.includes(before.match(/`add` 는 많고[^\n]*/)[0]), '본문 문장이 그대로 남아야 한다')

  const p = await getProblem(repo, { key: 'w1d2_2001_ledger' })
  assert.equal(p.statusSource, 'frontmatter')
})

await check('record_progress — solved 면 날짜 자동 채움', async () => {
  await recordProgress(repo, { key: 'w1d2_2001_ledger', status: 'solved' })
  const p = await getProblem(repo, { key: 'w1d2_2001_ledger' })
  assert.equal(p.status, 'solved')
  assert.match(String(p.solvedAt), /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(p.timeSpentMin, 50, '기존 값이 지워지면 안 된다')
})

await check('append_note — 기존 섹션에 덧붙임', async () => {
  const r = await appendNote(repo, { key: 'w1d1_1001_prefixsum', section: '다시 푼다면', text: '- Q 크기를 먼저 본다.' })
  assert.equal(r.appended, 'existing-section')
  const p = await getProblem(repo, { key: 'w1d1_1001_prefixsum' })
  assert.ok(p.sections['다시 푼다면'].includes('Q 크기를 먼저 본다'))
  assert.ok(p.sections['접근 힌트'].includes('누적합'), '다른 섹션이 망가지면 안 된다')
})

await check('append_note — 없는 섹션은 새로 만듦', async () => {
  const r = await appendNote(repo, { key: 'w1d1_1001_prefixsum', section: '리뷰', text: '경계 조건 확인.' })
  assert.equal(r.appended, 'new-section')
  const p = await getProblem(repo, { key: 'w1d1_1001_prefixsum' })
  assert.ok(p.sections['리뷰'].includes('경계 조건'))
})

await check('schedule_status — 계획 대비 실제', async () => {
  const s = await scheduleStatus(repo, { asOf: '2026-01-10' })
  assert.equal(s.total, 2)
  assert.equal(s.counts.solved, 2)
  assert.equal(s.behind, 0)
  assert.equal(s.daysLeft, 22)
})

await check('schedule_status — 미완료가 재배치안에 들어감', async () => {
  await recordProgress(repo, { key: 'w1d2_2001_ledger', status: 'todo' })
  const s = await scheduleStatus(repo, { asOf: '2026-01-10' })
  assert.equal(s.behind, 1)
  assert.equal(s.overdue[0].key, 'w1d2_2001_ledger')
  const assigned = s.proposal.days.flatMap(d => d.problems)
  assert.deepEqual(assigned, ['w1d2_2001_ledger'], '남은 문제가 전부 배치되어야 한다')
})

await check('schedule_status — config 없으면 명확히 실패', async () => {
  const bare = await mkdtemp(join(tmpdir(), 'swea-bare-'))
  await cp(join(ROOT, 'fixtures', 'sample-study-repo'), bare, { recursive: true })
  await assert.rejects(() => scheduleStatus(bare), /startDate/)
  await rm(bare, { recursive: true, force: true })
})

console.log('\nMCP 프로토콜')

await check('handshake + tools/list + tools/call', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')

  const client = new Client({ name: 'selftest', version: '0' })
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'mcp', 'index.mjs'), '--repo', repo],
  }))

  const { tools } = await client.listTools()
  assert.deepEqual(tools.map(t => t.name).sort(), [
    'append_note', 'get_problem', 'list_problems', 'record_progress', 'schedule_status',
  ])

  const res = await client.callTool({ name: 'list_problems', arguments: { status: 'solved' } })
  assert.equal(JSON.parse(res.content[0].text).count, 1)

  const bad = await client.callTool({ name: 'get_problem', arguments: { key: 'nope' } })
  assert.equal(bad.isError, true)

  await client.close()
})

await rm(repo, { recursive: true, force: true })
console.log(`\n${passed}개 통과${process.exitCode ? ' · 실패 있음' : ''}`)
