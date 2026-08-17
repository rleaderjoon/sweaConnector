// MCP 툴 본체. index.mjs 가 이걸 프로토콜에 연결한다.
// 프로토콜과 분리해 둔 이유: 툴 로직을 그냥 node 로 테스트할 수 있어야 한다.

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readStudyRepo, splitFrontmatter, withFrontmatter, problemDir, scheduledDate } from '../pipeline/lib.mjs'

const WEEKEND_WEIGHT = 2.8 // 주말 가용시간 / 평일 가용시간 (7h vs 2.5h)

/** 문제 목록. 필터는 전부 선택. */
export async function listProblems(repo, { status, week, type, topic, query } = {}) {
  const { problems } = await readStudyRepo(repo)
  const hit = problems.filter(p =>
    (!status || p.status === status) &&
    (week == null || p.week === Number(week)) &&
    (!type || p.type === type) &&
    (!topic || p.topic.some(t => t.includes(topic))) &&
    (!query || `${p.title} ${p.slug} ${p.topic.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  )
  return {
    count: hit.length,
    problems: hit.map(p => ({
      key: p.key, week: p.week, day: p.day, problemId: p.problemId, title: p.title,
      type: p.type, difficulty: p.difficulty, topic: p.topic,
      status: p.status, statusSource: p.statusSource, scheduledOn: p.scheduledOn,
    })),
  }
}

/** 문제 하나의 전체 내용 (노트 섹션 + 풀이 코드). */
export async function getProblem(repo, { key }) {
  const { problems } = await readStudyRepo(repo)
  const p = problems.find(x => x.key === key)
  if (!p) throw new Error(`문제를 찾을 수 없습니다: ${key}`)
  return p
}

/** NOTES.md 프론트매터에 진도를 기록한다. 본문은 건드리지 않는다. */
export async function recordProgress(repo, { key, status, attempts, timeSpentMin, solvedAt, concepts, diagram }) {
  const p = await getProblem(repo, { key })
  const file = join(problemDir(repo, key), 'NOTES.md')
  const text = await readFile(file, 'utf8')
  const { data } = splitFrontmatter(text)

  const next = {
    title: data.title ?? p.title,
    type: data.type ?? p.type,
    topic: data.topic ?? p.topic,
    difficulty: data.difficulty ?? p.difficulty,
    status: status ?? data.status ?? p.status,
    attempts: attempts ?? data.attempts ?? null,
    solvedAt: solvedAt ?? data.solvedAt ?? (status === 'solved' ? today() : null),
    timeSpentMin: timeSpentMin ?? data.timeSpentMin ?? null,
    concepts: concepts ?? data.concepts ?? [],
    diagram: diagram ?? data.diagram ?? null,
  }

  await writeFile(file, withFrontmatter(text, next), 'utf8')
  return { key, written: file, frontmatter: next }
}

/** NOTES.md 의 특정 섹션 끝에 내용을 덧붙인다. 없는 섹션이면 문서 끝에 새로 만든다. */
export async function appendNote(repo, { key, section, text }) {
  const file = join(problemDir(repo, key), 'NOTES.md')
  const original = await readFile(file, 'utf8')

  const re = new RegExp(`^(##+ +${escapeRe(section)}[^\\n]*\\n)([\\s\\S]*?)(?=^##+ +|$)`, 'm')
  const m = re.exec(original)

  const updated = m
    ? original.slice(0, m.index) + m[1] + `${m[2].trimEnd()}\n${text}\n\n` + original.slice(m.index + m[0].length)
    : `${original.trimEnd()}\n\n## ${section}\n\n${text}\n`

  await writeFile(file, updated, 'utf8')
  return { key, section, appended: !!m ? 'existing-section' : 'new-section' }
}

/**
 * 계획 대비 실제를 계산하고 남은 문제를 남은 날짜에 재배치한다.
 * 계획서를 읽어 주는 도구가 아니라, 계획이 이미 어긋났다는 전제로 고쳐 주는 도구.
 */
export async function scheduleStatus(repo, { asOf } = {}) {
  const { config, problems } = await readStudyRepo(repo)
  if (!config.startDate) throw new Error(`.sweaconnector.json 에 startDate 가 필요합니다 (예: {"startDate":"2026-08-15","examDate":"2026-09-19"})`)

  const now = asOf ?? today()
  const solved = problems.filter(p => p.status === 'solved')
  const remaining = problems.filter(p => p.status !== 'solved')
  const due = problems.filter(p => p.scheduledOn && p.scheduledOn <= now)
  const overdue = due.filter(p => p.status !== 'solved')

  const daysLeft = config.examDate ? Math.max(0, daysBetween(now, config.examDate)) : null
  const plannedSpan = daysBetween(config.startDate, problems.at(-1)?.scheduledOn ?? now) + 1

  return {
    asOf: now,
    examDate: config.examDate ?? null,
    daysLeft,
    total: problems.length,
    counts: tally(problems.map(p => p.status)),
    due: due.length,
    doneOfDue: due.length - overdue.length,
    behind: overdue.length,
    overdue: overdue.map(p => ({ key: p.key, title: p.title, type: p.type, scheduledOn: p.scheduledOn })),
    pace: {
      original: round(problems.length / plannedSpan),
      required: daysLeft ? round(remaining.length / Math.max(1, daysLeft)) : null,
      // 원래 페이스를 유지했을 때 응시일까지 남는 여유 일수. 밀릴수록 줄어들고, 음수면 페이스를 올려야 한다.
      // required < original 이어도 이 값이 작으면 안심할 상황이 아니다.
      slackDays: daysLeft ? round(daysLeft - remaining.length / (problems.length / plannedSpan)) : null,
    },
    proposal: daysLeft ? redistribute(remaining, now, config.examDate) : null,
  }
}

/** 남은 문제를 남은 날짜에 가용시간 가중치로 재배치한다. 주말에 더 얹는다. */
function redistribute(remaining, from, examDate) {
  const days = []
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) < examDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    const dow = d.getUTCDay()
    days.push({ date: iso, weight: dow === 0 || dow === 6 ? WEEKEND_WEIGHT : 1 })
  }
  if (!days.length) return null

  const totalWeight = days.reduce((s, d) => s + d.weight, 0)
  const perWeight = remaining.length / totalWeight

  const plan = []
  let carry = 0
  let i = 0
  for (const day of days) {
    carry += day.weight * perWeight
    const take = Math.floor(carry)
    carry -= take
    if (take > 0) {
      plan.push({ date: day.date, problems: remaining.slice(i, i + take).map(p => p.key) })
      i += take
    }
  }
  if (i < remaining.length && plan.length) plan.at(-1).problems.push(...remaining.slice(i).map(p => p.key))

  return { unassigned: 0, days: plan.filter(d => d.problems.length) }
}

// ---------------------------------------------------------------- helpers

// 로컬 달력 날짜. toISOString() 은 UTC 라서 UTC+9 의 자정~오전 9시가 전날로 밀린다.
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

function tally(items) {
  const t = {}
  for (const i of items) t[i] = (t[i] ?? 0) + 1
  return t
}

function round(n) {
  return Math.round(n * 100) / 100
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export { scheduledDate }
