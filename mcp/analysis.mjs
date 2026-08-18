// 약점 분석과 다음 문제 고르기.
// 노션 없이 CLI 에서 "지금 뭘 해야 하나"에 답하는 게 이 두 툴의 존재 이유다.

import { readStudyRepo } from '../pipeline/lib.mjs'

const CAUSE_SECTION = '실패 원인'

/**
 * 어디서 반복해서 무너지는지 센다.
 * 상태만 세지 않는다 — 풀긴 풀었는데 매번 세 번씩 걸리는 유형이 진짜 약점이다.
 * 그래서 "실패 원인" 체크와 유형별 시도 횟수를 함께 본다.
 */
export async function weakPoints(repo) {
  const { problems } = await readStudyRepo(repo)

  const causes = {}
  for (const p of problems) {
    for (const [name, text] of Object.entries(p.sections)) {
      if (!name.startsWith(CAUSE_SECTION)) continue
      for (const line of text.split('\n')) {
        const m = /^\s*[-*]\s*\[[xX]\]\s*(.+?)\s*$/.exec(line)
        if (!m) continue
        const cause = m[1].replace(/\*\*/g, '')
        ;(causes[cause] ??= []).push(p.key)
      }
    }
  }

  const byTopic = {}
  for (const p of problems) {
    for (const t of p.topic.length ? p.topic : ['(유형 없음)']) {
      const b = (byTopic[t] ??= { topic: t, total: 0, solved: 0, unsolved: 0, attempts: [], minutes: [] })
      b.total++
      if (p.status === 'solved') b.solved++
      else b.unsolved++
      if (p.attempts) b.attempts.push(p.attempts)
      if (p.timeSpentMin) b.minutes.push(p.timeSpentMin)
    }
  }

  const topics = Object.values(byTopic)
    .map(b => ({
      topic: b.topic,
      total: b.total,
      solved: b.solved,
      unsolved: b.unsolved,
      avgAttempts: avg(b.attempts),
      avgTimeMin: avg(b.minutes),
      // 못 푼 비율이 1차 기준. 같은 비율이면 시도가 많았던 쪽이 더 약하다.
      score: round(b.unsolved / b.total + (avg(b.attempts) ?? 1) / 10),
    }))
    .sort((a, b) => b.score - a.score || b.total - a.total)

  const timed = problems.filter(p => p.timeSpentMin)

  return {
    total: problems.length,
    counts: tally(problems.map(p => p.status)),
    causes: Object.entries(causes)
      .map(([cause, keys]) => ({ cause, count: keys.length, problems: keys }))
      .sort((a, b) => b.count - a.count),
    topics,
    weakestTopics: topics.slice(0, 3).map(t => t.topic),
    slowest: timed
      .sort((a, b) => b.timeSpentMin - a.timeSpentMin)
      .slice(0, 5)
      .map(p => ({ key: p.key, title: p.title, timeSpentMin: p.timeSpentMin, attempts: p.attempts })),
    unresolved: problems
      .filter(p => p.status === 'failed' || p.status === 'attempting')
      .map(p => ({ key: p.key, title: p.title, status: p.status, topic: p.topic, attempts: p.attempts })),
  }
}

/**
 * 다음에 뭘 풀지 고른다. 순서는 밀린 것 -> 약한 유형 -> 예정일.
 * 고른 이유를 함께 돌려주는 게 요점이다 — 근거가 없으면 그냥 목록과 다를 게 없다.
 */
export async function nextProblem(repo, { count = 3, asOf } = {}) {
  const { problems } = await readStudyRepo(repo)
  const now = asOf ?? today()
  const weak = (await weakPoints(repo)).weakestTopics

  const candidates = problems
    .filter(p => p.status !== 'solved')
    .map(p => {
      const overdue = Boolean(p.scheduledOn && p.scheduledOn <= now)
      const ranks = p.topic.map(t => weak.indexOf(t)).filter(i => i >= 0)
      const weakRank = ranks.length ? Math.min(...ranks) : 99

      const reasons = []
      if (overdue) reasons.push(`예정일 ${p.scheduledOn} 이 지났다`)
      if (weakRank < 99) reasons.push(`약한 유형 (${p.topic.filter(t => weak.includes(t)).join(', ')})`)
      if (p.status === 'attempting') reasons.push('손대다 만 상태')
      if (!reasons.length) reasons.push(`예정 ${p.scheduledOn ?? '미정'}`)

      return {
        key: p.key,
        title: p.title,
        type: p.type,
        topic: p.topic,
        difficulty: p.difficulty,
        status: p.status,
        scheduledOn: p.scheduledOn,
        reason: reasons.join(' · '),
        _rank: [overdue ? 0 : 1, weakRank, p.scheduledOn ?? '9999-12-31'],
      }
    })

  candidates.sort(
    (a, b) => a._rank[0] - b._rank[0] || a._rank[1] - b._rank[1] || String(a._rank[2]).localeCompare(String(b._rank[2])),
  )

  return {
    asOf: now,
    remaining: candidates.length,
    weakestTopics: weak,
    picks: candidates.slice(0, count).map(({ _rank, ...c }) => c),
  }
}

function avg(nums) {
  return nums.length ? round(nums.reduce((s, n) => s + n, 0) / nums.length) : null
}

function round(n) {
  return Math.round(n * 100) / 100
}

function tally(items) {
  const t = {}
  for (const i of items) t[i] = (t[i] ?? 0) + 1
  return t
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
