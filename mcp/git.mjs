// git 얇은 래퍼. 시스템 git 을 그대로 부른다 — 노드용 git 구현을 얹을 이유가 없다.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const exec = promisify(execFile)

export const WORKSPACE = join(homedir(), '.sweaconnector', 'repos')

export async function git(cwd, args) {
  const { stdout } = await exec('git', args, { cwd, maxBuffer: 32 * 1024 * 1024 })
  return stdout.trim()
}

/**
 * git 주소를 쪼갠다. https / ssh / 끝의 .git 모두 받는다.
 * 자체 호스팅 GitLab(예: lab.ssafy.com)도 같은 규칙으로 걸린다.
 */
export function parseGitUrl(url) {
  const cleaned = url.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  const ssh = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+)$/.exec(cleaned)
  const http = /^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+)$/.exec(cleaned)
  const m = ssh ?? http
  if (!m) throw new Error(`git 주소를 알아볼 수 없습니다: ${url}`)

  const host = m[1]
  const path = m[2]
  const parts = path.split('/').filter(Boolean)
  if (parts.length < 2) throw new Error(`소유자/저장소 형태가 아닙니다: ${url}`)

  return {
    host,
    owner: parts.slice(0, -1).join('/'), // GitLab 은 그룹이 여러 겹일 수 있다
    name: parts.at(-1),
    path,
    slug: `${parts.slice(0, -1).join('-')}__${parts.at(-1)}`,
  }
}

export async function isGitRepo(dir) {
  try {
    await stat(join(dir, '.git'))
    return true
  } catch {
    return false
  }
}

/** 이미 받아 둔 게 있으면 fetch 만, 없으면 clone. 되돌려주는 건 로컬 경로. */
export async function cloneOrReuse(gitUrl, dir, branch) {
  if (await isGitRepo(dir)) {
    await git(dir, ['fetch', '--all', '--quiet'])
    return { path: dir, action: 'reused' }
  }
  const args = ['clone', '--quiet']
  if (branch) args.push('--branch', branch)
  args.push(gitUrl, dir)
  await git(WORKSPACE, args).catch(async e => {
    throw new Error(`clone 실패: ${e.message.trim().split('\n').at(-1)}`)
  })
  return { path: dir, action: 'cloned' }
}

export async function currentBranch(dir) {
  return git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])
}

/** 지정한 경로만 커밋한다. 바뀐 게 없으면 아무것도 하지 않는다. */
export async function commitPaths(dir, paths, message) {
  await git(dir, ['add', '--', ...paths])
  const staged = await git(dir, ['diff', '--cached', '--name-only', '--', ...paths])
  if (!staged) return { committed: false, reason: '바뀐 내용 없음' }
  await git(dir, ['commit', '-m', message, '--', ...paths])
  return { committed: true, commit: await git(dir, ['rev-parse', '--short', 'HEAD']) }
}

export async function push(dir) {
  const branch = await currentBranch(dir)
  await git(dir, ['push', 'origin', branch])
  return { pushed: true, branch }
}

export async function remoteUrl(dir) {
  try {
    return await git(dir, ['remote', 'get-url', 'origin'])
  } catch {
    return null
  }
}
