// 빈 git 저장소를 학습 저장소로 만든다 — 규약: ../schema/STUDY_REPO.md
// 사람이 규약 문서를 읽고 폴더를 손으로 만들 필요가 없어야 한다.

import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const GITIGNORE_LINES = ['bin/', '*.class', '.metadata/']

const PLAN_TEMPLATE = `# 학습 계획

| 항목 | 값 |
|---|---|
| 시작 | {{start}} |
| 응시 | {{exam}} |

주차별 목표를 여기에 적는다. 이 파일은 사람용이고, 앱이 읽는 일정은 \`.sweaconnector.json\` 이다.
`

/** 없는 것만 만든다. 이미 쓰던 저장소에 대고 돌려도 안전하다. */
export async function scaffoldRepo(repo, { startDate, examDate } = {}) {
  const created = []

  await mkdir(join(repo, 'src'), { recursive: true })
  // 빈 디렉터리는 git 이 추적하지 않는다. 첫 문제가 생기기 전까지만 자리를 잡아 둔다.
  if ((await readdir(join(repo, 'src'))).length === 0) {
    await writeFile(join(repo, 'src', '.gitkeep'), '')
    created.push('src/.gitkeep')
  }

  if (await missing(join(repo, '.sweaconnector.json'))) {
    await writeFile(
      join(repo, '.sweaconnector.json'),
      JSON.stringify({ startDate: startDate ?? today(), examDate: examDate ?? null }, null, 2) + '\n',
      'utf8',
    )
    created.push('.sweaconnector.json')
  } else if (startDate || examDate) {
    const path = join(repo, '.sweaconnector.json')
    const cur = JSON.parse(await readFile(path, 'utf8'))
    const next = { ...cur, ...(startDate ? { startDate } : {}), ...(examDate ? { examDate } : {}) }
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      await writeFile(path, JSON.stringify(next, null, 2) + '\n', 'utf8')
      created.push('.sweaconnector.json (갱신)')
    }
  }

  if (await missing(join(repo, 'STUDY_PLAN.md'))) {
    const cfg = JSON.parse(await readFile(join(repo, '.sweaconnector.json'), 'utf8'))
    await writeFile(
      join(repo, 'STUDY_PLAN.md'),
      PLAN_TEMPLATE.replace('{{start}}', cfg.startDate ?? '-').replace('{{exam}}', cfg.examDate ?? '-'),
      'utf8',
    )
    created.push('STUDY_PLAN.md')
  }

  const gi = join(repo, '.gitignore')
  const existing = await readFile(gi, 'utf8').catch(() => '')
  const missingLines = GITIGNORE_LINES.filter(l => !existing.split('\n').some(x => x.trim() === l))
  if (missingLines.length) {
    await writeFile(gi, `${existing.trimEnd()}${existing ? '\n' : ''}${missingLines.join('\n')}\n`, 'utf8')
    created.push('.gitignore')
  }

  return created
}

/** 폴더 이름 규약대로 키를 만든다. */
export function problemKey({ week, day, problemId, slug }) {
  if (!Number.isInteger(week) || !Number.isInteger(day)) throw new Error('week/day 는 정수여야 합니다')
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) throw new Error(`slug 가 규약에 맞지 않습니다: ${slug}`)
  return problemId ? `w${week}d${day}_${problemId}_${slug}` : `w${week}d${day}_${slug}`
}

export function notesTemplate({ title, problemId, topic = [], difficulty, source, type, hint, url }) {
  const heading = problemId ? `# ${problemId} ${title}` : `# ${title}`
  const rows = [
    ['유형', topic.join(', ')],
    ['난이도', difficulty ?? ''],
    ['출처', source ?? ''],
    ['형식', type === 'pro' ? 'PRO' : type === 'drill' ? 'DRILL' : 'BASIC'],
  ]

  return `${heading}

| 항목 | 값 |
|---|---|
${rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}
${url ? `\n## 원본 문제\n\n${url}\n` : ''}
---

## 접근 힌트
${hint ? `\n${hint}\n` : '\n\n'}
---

## 풀이 기록

## 실패 원인 (해당 항목 체크)

- [ ] 문제를 잘못 읽었다
- [ ] 자료구조 선택이 틀렸다
- [ ] 시간복잡도를 잘못 계산했다
- [ ] 경계 조건을 놓쳤다
- [ ] 구현 중 논리를 잃었다

## 다시 푼다면

`
}

/** 언어별 최소 골격. 여기서 시작해 사람이 채운다. */
export function solutionStub(lang, type, className) {
  if (lang === 'java' && type === 'pro') {
    return `class ${className} {\n\n    public void init() {\n    }\n\n}\n`
  }
  if (lang === 'java') {
    return `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        int T = Integer.parseInt(br.readLine().trim());\n        StringBuilder sb = new StringBuilder();\n\n        for (int tc = 1; tc <= T; tc++) {\n            sb.append('#').append(tc).append(' ').append('\n');\n        }\n\n        System.out.print(sb);\n    }\n}\n`
  }
  if (lang === 'python') return `import sys\ninput = sys.stdin.readline\n\nT = int(input())\nfor tc in range(1, T + 1):\n    print(f"#{tc}")\n`
  return ''
}

async function missing(path) {
  return access(path).then(() => false, () => true)
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
