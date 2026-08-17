// 학습 저장소 읽기 — 규약: ../schema/STUDY_REPO.md
// CLI(extract.mjs)와 MCP 서버(../mcp/)가 이 모듈을 공유한다.

import { readdir, readFile } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'

const SKIP_DIRS = new Set(['bin', 'node_modules', '.git', '.metadata', '.settings'])
const SOLUTION_PRIORITY = ['UserSolution', 'Main', 'Solution']
const SOURCE_EXT = new Set(['.java', '.py', '.cpp', '.c', '.kt', '.js', '.ts'])
const FOLDER_RE = /^w(\d+)d(\d+)_(?:(\d+)_)?(.+)$/
const CONFIG_FILE = '.sweaconnector.json'

/** 학습 저장소 전체를 읽는다. { config, baseline, weeks, problems, skipped } */
export async function readStudyRepo(repo) {
  const config = await readConfig(repo)
  const srcDir = join(repo, 'src')
  const problems = []
  const skipped = []

  for (const entry of await readdir(srcDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
    const m = FOLDER_RE.exec(entry.name)
    if (!m) {
      skipped.push(entry.name)
      continue
    }
    problems.push(await readProblem(join(srcDir, entry.name), entry.name, m))
  }

  // status 추론: 같은 type 파일들의 유효 코드 줄 수 최빈값을 골격 기준선으로 삼는다
  const baseline = {}
  for (const type of ['basic', 'pro', 'drill']) {
    baseline[type] = mode(problems.filter(p => p.type === type).map(p => p._codeLines))
  }
  for (const p of problems) {
    if (p.status) {
      p.statusSource = 'frontmatter'
    } else {
      p.status = p._codeLines > (baseline[p.type] ?? 0) ? 'attempting' : 'todo'
      p.statusSource = 'inferred'
    }
    p.scheduledOn = config.startDate ? scheduledDate(config.startDate, p.week, p.day) : null
    delete p._codeLines
  }

  problems.sort((a, b) => a.week - b.week || a.day - b.day || a.key.localeCompare(b.key))

  const weeks = []
  for (const p of problems) {
    let w = weeks.find(x => x.week === p.week)
    if (!w) weeks.push((w = { week: p.week, problems: [] }))
    w.problems.push(p.key)
  }

  return { config, baseline, weeks, problems, skipped }
}

/** w<week>d<day> 를 날짜로 환산. week1 day1 = startDate. */
export function scheduledDate(startDate, week, day) {
  const d = new Date(`${startDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7 + (day - 1))
  return d.toISOString().slice(0, 10)
}

export function isDone(p) {
  return p.status === 'solved'
}

export async function readConfig(repo) {
  try {
    return JSON.parse(await readFile(join(repo, CONFIG_FILE), 'utf8'))
  } catch {
    return {}
  }
}

export function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { data: {}, body: text, raw: null }
  const data = {}
  for (const line of m[1].split('\n')) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim())
    if (!kv) continue
    const [, k, v] = kv
    if (v.startsWith('[')) data[k] = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    else if (v === '') data[k] = null
    else if (/^\d+$/.test(v)) data[k] = Number(v)
    else data[k] = v.replace(/^["']|["']$/g, '')
  }
  return { data, body: text.slice(m[0].length), raw: m[1] }
}

/** 프론트매터를 직렬화해 본문 앞에 붙인다. 기존 블록은 교체. */
export function withFrontmatter(text, data) {
  const { body } = splitFrontmatter(text)
  const lines = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`)
  return `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`
}

export function problemDir(repo, key) {
  return join(repo, 'src', key)
}

// ---------------------------------------------------------------- internals

async function readProblem(dir, key, m) {
  const [, week, day, problemId, slug] = m
  const files = (await readdir(dir, { withFileTypes: true })).filter(f => f.isFile()).map(f => f.name)

  const solutionFile = pickSolution(files)
  const isPro = files.some(f => basename(f, extname(f)) === 'UserSolution')
  const code = solutionFile ? await readFile(join(dir, solutionFile), 'utf8') : ''

  const notes = files.includes('NOTES.md') ? await readFile(join(dir, 'NOTES.md'), 'utf8') : ''
  const { data: fm, body } = splitFrontmatter(notes)
  const sections = splitSections(body)
  const table = parseTable(body)

  return {
    key,
    week: Number(week),
    day: Number(day),
    problemId: problemId ? Number(problemId) : null,
    slug,
    title: fm.title ?? titleFromHeading(body) ?? slug,
    // problemId 가 없으면 실제 문제가 아니라 자체 훈련(drill) — 골격 줄 수가 달라서 따로 센다
    type: fm.type ?? (isPro ? 'pro' : problemId ? 'basic' : 'drill'),
    topic: fm.topic ?? (table['유형'] ? [table['유형']] : []),
    difficulty: fm.difficulty ?? table['난이도'] ?? null,
    source: table['출처'] ?? null,
    status: fm.status ?? null,
    attempts: fm.attempts ?? null,
    solvedAt: fm.solvedAt ?? null,
    timeSpentMin: fm.timeSpentMin ?? null,
    concepts: fm.concepts ?? [],
    diagram: fm.diagram ?? null,
    sections,
    solution: solutionFile ? { file: solutionFile, lang: langOf(solutionFile), code } : null,
    _codeLines: countCode(code),
  }
}

function pickSolution(files) {
  for (const stem of SOLUTION_PRIORITY) {
    const hit = files.find(f => basename(f, extname(f)) === stem && SOURCE_EXT.has(extname(f)))
    if (hit) return hit
  }
  return files.filter(f => SOURCE_EXT.has(extname(f))).sort()[0] ?? null
}

function countCode(src) {
  return src.split('\n').filter(l => {
    const t = l.trim()
    return t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
  }).length
}

function splitSections(body) {
  const out = {}
  for (const part of body.split(/^##+ +/m).slice(1)) {
    const nl = part.indexOf('\n')
    if (nl < 0) continue
    const name = part.slice(0, nl).trim()
    const text = part.slice(nl + 1).trim()
    if (name && text) out[name] = text
  }
  return out
}

function parseTable(body) {
  const out = {}
  for (const line of body.split('\n')) {
    const cells = line.split('|').map(s => s.trim())
    if (cells.length === 4 && cells[1] && cells[2] && !/^-+$/.test(cells[2])) out[cells[1]] = cells[2]
  }
  return out
}

function titleFromHeading(body) {
  const m = /^# +(.+)$/m.exec(body)
  return m ? m[1].replace(/^\d+\s+/, '').trim() : null
}

function langOf(file) {
  return { '.java': 'java', '.py': 'python', '.cpp': 'cpp', '.c': 'c', '.kt': 'kotlin' }[extname(file)] ?? 'text'
}

function mode(nums) {
  const t = {}
  for (const n of nums) t[n] = (t[n] ?? 0) + 1
  return Number(Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0)
}
