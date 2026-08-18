#!/usr/bin/env node
// sweaConnector MCP 서버
//
// 처음 붙일 때:  claude mcp add swea -- node /path/to/sweaConnector/mcp/index.mjs
//                그다음 setup_repo 툴에 git 주소를 준다. 붙인 곳은 기억된다.
// 경로를 직접 줄 때: ... mcp/index.mjs --repo /path/to/my-study-repo   (git 주소도 됨)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { listProblems, getProblem, recordProgress, appendNote, scheduleStatus } from './tools.mjs'
import { setupRepo, scaffoldProblem, saveSolution, publishContent } from './authoring.mjs'
import { weakPoints, nextProblem } from './analysis.mjs'
import { readServerConfig } from './config.mjs'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1]

const isGitUrl = s => /^(https?:\/\/|git@|ssh:\/\/)/.test(s)

// 저장소는 첫 툴 호출 때 정한다. 서버가 뜨는 동안 clone 을 기다리면 핸드셰이크가 늦는다.
let repoPath = null
async function getRepo() {
  if (repoPath) return repoPath

  const given = args.repo ?? process.env.SWEA_STUDY_REPO
  if (given) {
    repoPath = isGitUrl(given) ? (await setupRepo({ gitUrl: given, branch: args.branch })).path : given
    return repoPath
  }

  const saved = (await readServerConfig()).repo?.path
  if (saved) return (repoPath = saved)

  throw new Error(
    '아직 학습 저장소가 없습니다. setup_repo 에 git 주소를 주세요 — ' +
      '예: setup_repo({ gitUrl: "https://github.com/<나>/<내저장소>.git" })',
  )
}

const server = new McpServer({ name: 'sweaConnector', version: '0.2.0' })

const ok = data => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })
const fail = e => ({ content: [{ type: 'text', text: `오류: ${e.message}` }], isError: true })

/** 저장소를 필요로 하는 툴 */
const wrap = fn => async a => {
  try {
    return ok(await fn(await getRepo(), a))
  } catch (e) {
    return fail(e)
  }
}

/** 저장소를 스스로 정하는 툴 (setup_repo) */
const bare = fn => async a => {
  try {
    const r = await fn(a)
    repoPath = r.path
    return ok(r)
  } catch (e) {
    return fail(e)
  }
}

// ────────────────────────────────────────────── 저장소 붙이기

server.registerTool('setup_repo', {
  title: '학습 저장소 붙이기',
  description:
    'git 주소를 받아 학습 저장소를 붙인다. 처음이면 clone 하고 규약대로 뼈대(src/, .sweaconnector.json, STUDY_PLAN.md)를 만든다. ' +
    '이미 받아 둔 게 있으면 fetch 만 한다. 붙인 곳은 기억되므로 다음 실행부터는 부를 필요가 없다. 다른 툴이 "저장소가 없다"고 하면 이걸 먼저 부른다.',
  inputSchema: {
    gitUrl: z.string().optional().describe('https 또는 ssh git 주소'),
    path: z.string().optional().describe('로컬 경로. gitUrl 과 함께 주면 그 자리에 clone 한다.'),
    branch: z.string().optional(),
    startDate: z.string().optional().describe('YYYY-MM-DD. 학습 시작일 — w1d1 이 이 날짜가 된다.'),
    examDate: z.string().optional().describe('YYYY-MM-DD. 응시일.'),
  },
}, bare(setupRepo))

// ────────────────────────────────────────────── 읽기

server.registerTool('list_problems', {
  title: '문제 목록',
  description: '학습 저장소의 문제 목록. status/week/type/topic/query 로 걸러진다. 다음에 뭘 풀지 고를 때 먼저 이걸 부른다.',
  inputSchema: {
    status: z.enum(['todo', 'attempting', 'solved', 'failed']).optional(),
    week: z.number().int().optional(),
    type: z.enum(['basic', 'pro', 'drill']).optional(),
    topic: z.string().optional().describe('유형 부분 일치 (예: "다익스트라")'),
    query: z.string().optional().describe('제목·slug·유형 통합 검색'),
  },
}, wrap(listProblems))

server.registerTool('get_problem', {
  title: '문제 상세',
  description: '문제 하나의 전체 내용 — NOTES.md 섹션 전부와 풀이 코드. 풀이를 검토하거나 이어서 조언할 때 쓴다.',
  inputSchema: { key: z.string().describe('폴더 이름 (예: w1d1_1001_prefixsum)') },
}, wrap(getProblem))

// ────────────────────────────────────────────── 쓰기

server.registerTool('scaffold_problem', {
  title: '문제 만들기',
  description:
    '규약대로 문제 폴더를 만든다 — NOTES.md 뼈대(유형표·접근 힌트·실패 원인 체크리스트)와 풀이 골격 파일까지. ' +
    '새 문제를 풀기 시작할 때 이걸 먼저 부르고, 풀이는 save_solution 으로 채운다.',
  inputSchema: {
    week: z.number().int(),
    day: z.number().int(),
    problemId: z.number().int().optional().describe('없으면 자체 훈련(drill) 로 본다'),
    slug: z.string().describe('영문 소문자 식별자 (예: prefixsum)'),
    title: z.string().optional(),
    type: z.enum(['basic', 'pro', 'drill']).optional(),
    topic: z.array(z.string()).optional(),
    difficulty: z.string().optional(),
    source: z.string().optional().describe('출처 (예: "특강 1주차")'),
    url: z.string().optional().describe('원본 문제 링크'),
    hint: z.string().optional().describe('접근 힌트 — 풀이가 아니라 어디서 시작할지'),
    lang: z.enum(['java', 'python', 'cpp', 'kotlin']).optional(),
  },
}, wrap(scaffoldProblem))

server.registerTool('save_solution', {
  title: '풀이 저장',
  description: '문제 폴더에 풀이 파일을 쓴다. 파일 이름만 받는다(경로 불가). 풀이를 새로 짜 줬을 때 이걸로 저장한다.',
  inputSchema: {
    key: z.string(),
    file: z.string().describe('예: Main.java, UserSolution.java'),
    code: z.string(),
  },
}, wrap(saveSolution))

server.registerTool('record_progress', {
  title: '진도 기록',
  description: 'NOTES.md 프론트매터에 상태를 기록한다. 본문은 건드리지 않는다. 문제를 풀거나 시도한 직후에 부른다.',
  inputSchema: {
    key: z.string(),
    status: z.enum(['todo', 'attempting', 'solved', 'failed']).optional(),
    attempts: z.number().int().optional(),
    timeSpentMin: z.number().int().optional(),
    solvedAt: z.string().optional().describe('YYYY-MM-DD. status=solved 인데 비우면 오늘로 채운다.'),
    concepts: z.array(z.string()).optional().describe('개념 사전 id 목록'),
    diagram: z.string().optional().describe('도식 id'),
  },
}, wrap(recordProgress))

server.registerTool('append_note', {
  title: '노트 덧붙이기',
  description: 'NOTES.md 의 특정 섹션 끝에 내용을 덧붙인다 (예: "다시 푼다면", "풀이 기록"). 없는 섹션이면 문서 끝에 새로 만든다.',
  inputSchema: {
    key: z.string(),
    section: z.string().describe('섹션 제목 (## 뒤의 글자)'),
    text: z.string(),
  },
}, wrap(appendNote))

// ────────────────────────────────────────────── 점검

server.registerTool('schedule_status', {
  title: '일정 점검 및 재배치',
  description: '계획 대비 실제 진도를 계산하고, 남은 문제를 남은 날짜에 주말 가중치로 재배치한 안을 낸다. 계획이 이미 어긋났다는 전제로 동작한다.',
  inputSchema: { asOf: z.string().optional().describe('YYYY-MM-DD. 비우면 오늘.') },
}, wrap(scheduleStatus))

server.registerTool('weak_points', {
  title: '약점 분석',
  description:
    '어디서 반복해서 무너지는지 센다 — 체크된 "실패 원인", 유형별 미해결 비율과 평균 시도 횟수, 오래 걸린 문제. ' +
    '"내 약점이 뭐냐"에 답할 때 이걸 쓴다. 상태 집계만 필요하면 schedule_status 로 충분하다.',
  inputSchema: {},
}, wrap(weakPoints))

server.registerTool('next_problem', {
  title: '다음 문제 추천',
  description: '밀린 것 -> 약한 유형 -> 예정일 순으로 다음에 풀 문제를 고르고, 고른 이유를 함께 돌려준다.',
  inputSchema: {
    count: z.number().int().optional(),
    asOf: z.string().optional().describe('YYYY-MM-DD. 비우면 오늘.'),
  },
}, wrap(nextProblem))

// ────────────────────────────────────────────── 앱으로 내보내기

server.registerTool('publish_content', {
  title: '앱 콘텐츠 갱신',
  description:
    '저장소를 읽어 .swea/ 를 갱신한다 — 앱이 내려받는 것이 이 결과물이다. 내용이 바뀐 조각만 다시 쓰고, 기본값으로 커밋까지 한다. ' +
    '문제를 만들거나 진도를 기록한 뒤에 부른다. push 는 명시적으로 켜야 한다.',
  inputSchema: {
    commit: z.boolean().optional().describe('기본 true'),
    push: z.boolean().optional().describe('기본 false — 원격에 올려야 폰에서 보인다'),
    message: z.string().optional(),
  },
}, wrap(publishContent))

await server.connect(new StdioServerTransport())
