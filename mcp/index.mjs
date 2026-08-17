#!/usr/bin/env node
// sweaConnector MCP 서버
// 사용법: claude mcp add swea -- node /path/to/sweaConnector/mcp/index.mjs --repo /path/to/my-study-repo

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { listProblems, getProblem, recordProgress, appendNote, scheduleStatus } from './tools.mjs'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1]

const repo = args.repo ?? process.env.SWEA_STUDY_REPO
if (!repo) {
  console.error('학습 저장소 경로가 필요합니다: --repo <path> (또는 SWEA_STUDY_REPO 환경변수)')
  process.exit(2)
}

const server = new McpServer({ name: 'sweaConnector', version: '0.1.0' })

const ok = data => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })
const fail = e => ({ content: [{ type: 'text', text: `오류: ${e.message}` }], isError: true })
const wrap = fn => async a => {
  try {
    return ok(await fn(repo, a))
  } catch (e) {
    return fail(e)
  }
}

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

server.registerTool('schedule_status', {
  title: '일정 점검 및 재배치',
  description: '계획 대비 실제 진도를 계산하고, 남은 문제를 남은 날짜에 주말 가중치로 재배치한 안을 낸다. 계획이 이미 어긋났다는 전제로 동작한다.',
  inputSchema: { asOf: z.string().optional().describe('YYYY-MM-DD. 비우면 오늘.') },
}, wrap(scheduleStatus))

await server.connect(new StdioServerTransport())
