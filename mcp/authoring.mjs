// 저장소를 붙이고, 문제를 만들고, 앱이 볼 형태로 내보내는 툴들.
// 읽기 위주인 tools.mjs 와 갈라 둔다 — 이쪽은 전부 파일을 만들거나 git 을 건드린다.

import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readStudyRepo, problemDir } from '../pipeline/lib.mjs'
import { publish, OUT_DIRNAME } from '../pipeline/publish.mjs'
import { WORKSPACE, parseGitUrl, cloneOrReuse, currentBranch, commitPaths, push, remoteUrl } from './git.mjs'
import { readServerConfig, writeServerConfig } from './config.mjs'
import { scaffoldRepo, problemKey, notesTemplate, solutionStub } from './scaffold.mjs'

/**
 * git 주소를 받아 학습 저장소를 붙인다. 처음이면 clone 하고 규약대로 뼈대를 만든다.
 * 이미 받아 둔 게 있으면 fetch 만 하고 재사용한다.
 * 붙인 곳은 기억해 두므로 다음 실행부터는 인자 없이 뜬다.
 */
export async function setupRepo({ gitUrl, path, branch, startDate, examDate } = {}) {
  if (!gitUrl && !path) throw new Error('gitUrl 또는 path 중 하나가 필요합니다')

  let dir = path
  let action = 'local'

  if (gitUrl) {
    const parsed = parseGitUrl(gitUrl)
    dir = path ?? join(WORKSPACE, parsed.slug)
    await mkdir(WORKSPACE, { recursive: true })
    action = (await cloneOrReuse(gitUrl, dir, branch)).action
  }

  const created = await scaffoldRepo(dir, { startDate, examDate })
  const { problems, skipped } = await readStudyRepo(dir)
  const resolvedBranch = branch ?? (await currentBranch(dir).catch(() => null))

  const config = await readServerConfig()
  const configSavedTo = await writeServerConfig({
    ...config,
    repo: { gitUrl: gitUrl ?? (await remoteUrl(dir)), path: dir, branch: resolvedBranch },
  })

  return {
    action,
    path: dir,
    branch: resolvedBranch,
    created,
    problems: problems.length,
    skipped,
    configSavedTo,
    next: problems.length
      ? 'publish_content 로 .swea/ 를 만들어 커밋하면 앱이 읽습니다.'
      : 'scaffold_problem 으로 첫 문제를 만드세요.',
  }
}

/** 규약대로 문제 폴더를 만든다. NOTES.md 뼈대와 풀이 골격까지. */
export async function scaffoldProblem(repo, {
  week, day, problemId, slug, title, type = 'basic', topic = [], difficulty, source, url, hint, lang = 'java',
}) {
  const key = problemKey({ week, day, problemId, slug })
  const dir = problemDir(repo, key)
  if (await exists(dir)) throw new Error(`이미 있습니다: ${key}`)

  await mkdir(dir, { recursive: true })
  const written = ['NOTES.md']
  await writeFile(
    join(dir, 'NOTES.md'),
    notesTemplate({ title: title ?? slug, problemId, topic, difficulty, source, type, hint, url }),
    'utf8',
  )

  const ext = { java: '.java', python: '.py', cpp: '.cpp', kotlin: '.kt' }[lang] ?? '.txt'
  // API 구현형은 채점기가 부르는 껍데기(Solution)와 사람이 채우는 쪽(UserSolution)이 나뉜다
  const stem = type === 'pro' ? 'UserSolution' : 'Main'
  await writeFile(join(dir, `${stem}${ext}`), solutionStub(lang, type, stem), 'utf8')
  written.push(`${stem}${ext}`)

  return { key, dir, written }
}

/** 풀이 파일을 쓴다. 문제 폴더 바깥으로는 못 나간다. */
export async function saveSolution(repo, { key, file, code }) {
  if (/[\\/]/.test(file) || file.startsWith('.')) throw new Error(`파일 이름만 주세요 (경로 불가): ${file}`)
  const dir = problemDir(repo, key)
  if (!(await exists(dir))) throw new Error(`문제를 찾을 수 없습니다: ${key}`)
  await writeFile(join(dir, file), code, 'utf8')
  return { key, file, bytes: Buffer.byteLength(code), lines: code.split('\n').length }
}

/**
 * 저장소를 읽어 .swea/ 를 갱신한다 — 앱이 보는 것은 이 결과물이다.
 * 내용이 같은 조각은 다시 쓰지 않으므로, 두 번 돌려도 커밋할 게 생기지 않는다.
 */
export async function publishContent(repo, { commit = true, push: doPush = false, message } = {}) {
  const stats = await publish(repo)
  const out = { ...stats, outDir: OUT_DIRNAME }

  if (commit) {
    const msg = message ?? `chore: 앱 콘텐츠 갱신 (조각 ${stats.changed.length}개)`
    out.git = await commitPaths(repo, [OUT_DIRNAME], msg).catch(e => ({ committed: false, reason: e.message }))
    if (doPush && out.git.committed) {
      out.git.push = await push(repo).catch(e => ({ pushed: false, reason: e.message }))
    }
  }
  return out
}

async function exists(path) {
  return access(path).then(() => true, () => false)
}
