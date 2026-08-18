// 자체 검증: 툴 전부를 fixtures 사본에 대고 돌리고, 실제 MCP 핸드셰이크까지 확인한다.
// 사용법: node mcp/selftest.mjs

import assert from 'node:assert/strict'
import { cp, mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// 사용자의 진짜 ~/.sweaconnector/config.json 을 덮지 않도록 먼저 자리를 옮긴다.
// import 보다 먼저 세워야 한다 — config.mjs 가 모듈 로드 시점에 읽는다.
const sandbox = await mkdtemp(join(tmpdir(), 'swea-cfg-'))
process.env.SWEA_CONFIG = join(sandbox, 'config.json')

const { listProblems, getProblem, recordProgress, appendNote, scheduleStatus } = await import('./tools.mjs')
const { setupRepo, scaffoldProblem, saveSolution, publishContent } = await import('./authoring.mjs')
const { weakPoints, nextProblem } = await import('./analysis.mjs')

const repo = await mkdtemp(join(tmpdir(), 'swea-selftest-'))
let passed = 0

const check = (name, fn) => fn().then(
  () => { console.log(`  ok   ${name}`); passed++ },
  e => { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1 }
)

await cp(join(ROOT, 'fixtures', 'sample-study-repo'), repo, { recursive: true })
await writeFile(join(repo, '.sweaconnector.json'), JSON.stringify({ startDate: '2026-01-01', examDate: '2026-02-01' }))

console.log('읽기')

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

console.log('\n쓰기')

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

console.log('\n일정 · 약점')

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

await check('weak_points — 체크된 실패 원인을 센다', async () => {
  const w = await weakPoints(repo)
  const cause = w.causes.find(c => c.cause.includes('시간 초과'))
  assert.ok(cause, '체크된 항목만 집계되어야 한다')
  assert.deepEqual(cause.problems, ['w1d1_1001_prefixsum'])
  assert.ok(!w.causes.some(c => c.cause.includes('구현 버그')), '체크 안 된 항목은 세면 안 된다')
  assert.ok(w.topics.length > 0)
})

await check('next_problem — 밀린 것을 먼저 고르고 이유를 준다', async () => {
  const n = await nextProblem(repo, { asOf: '2026-01-10' })
  assert.equal(n.picks[0].key, 'w1d2_2001_ledger')
  assert.match(n.picks[0].reason, /지났다/)
})

console.log('\n저장소 붙이기 · 문제 만들기')

await check('setup_repo — 빈 디렉터리에 규약대로 뼈대', async () => {
  const fresh = await mkdtemp(join(tmpdir(), 'swea-fresh-'))
  const r = await setupRepo({ path: fresh, startDate: '2026-03-01', examDate: '2026-04-01' })
  assert.ok(r.created.includes('.sweaconnector.json'))
  assert.ok(r.created.includes('STUDY_PLAN.md'))
  assert.equal(r.problems, 0)
  const cfg = JSON.parse(await readFile(join(fresh, '.sweaconnector.json'), 'utf8'))
  assert.equal(cfg.examDate, '2026-04-01')

  const again = await setupRepo({ path: fresh })
  assert.deepEqual(again.created, [], '두 번 돌려도 덧쓰지 않아야 한다')
  await rm(fresh, { recursive: true, force: true })
})

await check('setup_repo — 붙인 곳을 기억한다', async () => {
  const saved = JSON.parse(await readFile(process.env.SWEA_CONFIG, 'utf8'))
  assert.ok(saved.repo.path, '설정 파일에 경로가 남아야 한다')
})

await check('scaffold_problem — 규약대로 폴더와 파일', async () => {
  const r = await scaffoldProblem(repo, {
    week: 2, day: 1, problemId: 3001, slug: 'twopointer', title: '두 포인터 연습',
    topic: ['투 포인터'], difficulty: 'D3', type: 'basic', hint: '정렬 먼저.',
  })
  assert.equal(r.key, 'w2d1_3001_twopointer')
  assert.deepEqual(r.written, ['NOTES.md', 'Main.java'])

  const p = await getProblem(repo, { key: 'w2d1_3001_twopointer' })
  assert.equal(p.title, '두 포인터 연습')
  assert.deepEqual(p.topic, ['투 포인터'])
  assert.equal(p.difficulty, 'D3')
  assert.ok(p.sections['접근 힌트'].includes('정렬 먼저'))
})

await check('scaffold_problem — pro 는 UserSolution 을 만든다', async () => {
  const r = await scaffoldProblem(repo, { week: 2, day: 2, problemId: 3002, slug: 'api', type: 'pro' })
  assert.deepEqual(r.written, ['NOTES.md', 'UserSolution.java'])
  const p = await getProblem(repo, { key: 'w2d2_3002_api' })
  assert.equal(p.type, 'pro')
})

await check('scaffold_problem — 있는 문제는 덮어쓰지 않는다', async () => {
  await assert.rejects(
    () => scaffoldProblem(repo, { week: 2, day: 1, problemId: 3001, slug: 'twopointer' }),
    /이미 있습니다/,
  )
})

await check('save_solution — 코드를 쓰고, 경로 탈출은 막는다', async () => {
  await saveSolution(repo, { key: 'w2d1_3001_twopointer', file: 'Main.java', code: 'class Main {}\n' })
  const p = await getProblem(repo, { key: 'w2d1_3001_twopointer' })
  assert.equal(p.solution.code.trim(), 'class Main {}')
  await assert.rejects(
    () => saveSolution(repo, { key: 'w2d1_3001_twopointer', file: '../../evil.java', code: 'x' }),
    /경로 불가/,
  )
})

console.log('\n앱 콘텐츠 (.swea)')

await check('publish_content — 인덱스와 조각이 나온다', async () => {
  const r = await publishContent(repo, { commit: false })
  assert.equal(r.problems, 4)

  const index = JSON.parse(await readFile(join(repo, '.swea', 'index.json'), 'utf8'))
  assert.equal(index.formatVersion, 1)
  assert.equal(index.problems.length, 4)
  assert.ok(index.concepts.length > 0)
  assert.ok(index.diagramsHash)
  assert.equal(index.config.examDate, '2026-02-01')

  const meta = index.problems.find(p => p.key === 'w1d1_1001_prefixsum')
  assert.ok(meta.hash, '조각 해시가 인덱스에 있어야 한다')
  assert.ok(!('sections' in meta), '본문은 인덱스에 들어가면 안 된다 — 목록만으로 화면이 떠야 한다')

  const body = JSON.parse(await readFile(join(repo, '.swea', 'problems', 'w1d1_1001_prefixsum.json'), 'utf8'))
  assert.ok(body.sections.some(s => s.name === '접근 힌트'))
  assert.ok(body.solution.code.includes('class'))
})

await check('publish_content — 두 번 돌리면 바뀐 조각이 없다', async () => {
  const r = await publishContent(repo, { commit: false })
  assert.deepEqual(r.changed, [], '같은 내용을 다시 쓰면 안 된다 (git diff 가 커진다)')
})

await check('publish_content — 진도만 바뀌면 본문 조각은 그대로다', async () => {
  await recordProgress(repo, { key: 'w1d2_2001_ledger', status: 'solved', attempts: 3 })
  const r = await publishContent(repo, { commit: false })
  assert.deepEqual(r.changed, [], '메타는 인덱스에만 있으므로 본문 조각은 다시 받을 필요가 없다')

  const index = JSON.parse(await readFile(join(repo, '.swea', 'index.json'), 'utf8'))
  assert.equal(index.problems.find(p => p.key === 'w1d2_2001_ledger').status, 'solved')
  assert.equal(index.problems.find(p => p.key === 'w1d2_2001_ledger').attempts, 3)
})

await check('publish_content — 본문이 바뀐 문제만 새 조각이 된다', async () => {
  await appendNote(repo, { key: 'w1d1_1001_prefixsum', section: '다시 푼다면', text: '- 인덱스를 1부터 잡는다.' })
  const r = await publishContent(repo, { commit: false })
  assert.deepEqual(r.changed, ['w1d1_1001_prefixsum'])
})

await check('publish_content — 사라진 문제의 조각은 지운다', async () => {
  await rm(join(repo, 'src', 'w2d2_3002_api'), { recursive: true, force: true })
  const r = await publishContent(repo, { commit: false })
  assert.deepEqual(r.removed, ['w2d2_3002_api'])
  const left = await readdir(join(repo, '.swea', 'problems'))
  assert.ok(!left.includes('w2d2_3002_api.json'), '유령 항목이 남으면 앱이 계속 들고 있는다')
})

await check('publish_content — commit 은 .swea 만 담는다', async () => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const run = promisify(execFile)
  const gitRepo = await mkdtemp(join(tmpdir(), 'swea-git-'))
  await cp(join(ROOT, 'fixtures', 'sample-study-repo'), gitRepo, { recursive: true })
  await run('git', ['init', '--quiet', '-b', 'main'], { cwd: gitRepo })
  await run('git', ['config', 'user.email', 'selftest@example.com'], { cwd: gitRepo })
  await run('git', ['config', 'user.name', 'selftest'], { cwd: gitRepo })
  await run('git', ['add', '-A'], { cwd: gitRepo })
  await run('git', ['commit', '--quiet', '-m', 'init'], { cwd: gitRepo })

  // 커밋에 담기면 안 되는 변경을 일부러 만들어 둔다
  await writeFile(join(gitRepo, 'STUDY_PLAN.md'), '작업 중', 'utf8')

  const r = await publishContent(gitRepo, { commit: true })
  assert.equal(r.git.committed, true)
  const { stdout } = await run('git', ['show', '--name-only', '--format=', 'HEAD'], { cwd: gitRepo })
  const files = stdout.trim().split('\n')
  assert.ok(files.every(f => f.startsWith('.swea/')), `커밋에 .swea 밖의 파일이 들어갔다: ${files}`)

  const again = await publishContent(gitRepo, { commit: true })
  assert.equal(again.git.committed, false, '바뀐 게 없으면 빈 커밋을 만들면 안 된다')
  await rm(gitRepo, { recursive: true, force: true })
})

console.log('\nMCP 프로토콜')

await check('handshake + tools/list + tools/call', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')

  const client = new Client({ name: 'selftest', version: '0' })
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'mcp', 'index.mjs'), '--repo', repo],
    env: { ...process.env, SWEA_CONFIG: process.env.SWEA_CONFIG },
  }))

  const { tools } = await client.listTools()
  assert.deepEqual(tools.map(t => t.name).sort(), [
    'append_note', 'get_problem', 'list_problems', 'next_problem', 'publish_content',
    'record_progress', 'save_solution', 'scaffold_problem', 'schedule_status', 'setup_repo', 'weak_points',
  ])

  const res = await client.callTool({ name: 'list_problems', arguments: { status: 'solved' } })
  assert.equal(JSON.parse(res.content[0].text).count, 2)

  const bad = await client.callTool({ name: 'get_problem', arguments: { key: 'nope' } })
  assert.equal(bad.isError, true)

  await client.close()
})

await check('저장소 없이 뜨면 setup_repo 를 안내한다', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')

  const emptyCfg = await mkdtemp(join(tmpdir(), 'swea-nocfg-'))
  const client = new Client({ name: 'selftest', version: '0' })
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'mcp', 'index.mjs')],
    env: { ...process.env, SWEA_CONFIG: join(emptyCfg, 'config.json'), SWEA_STUDY_REPO: '' },
  }))

  const res = await client.callTool({ name: 'list_problems', arguments: {} })
  assert.equal(res.isError, true)
  assert.match(res.content[0].text, /setup_repo/)

  await client.close()
  await rm(emptyCfg, { recursive: true, force: true })
})

await rm(repo, { recursive: true, force: true })
await rm(sandbox, { recursive: true, force: true })
console.log(`\n${passed}개 통과${process.exitCode ? ' · 실패 있음' : ''}`)
