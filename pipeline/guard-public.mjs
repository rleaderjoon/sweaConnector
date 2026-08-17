// 공개 저장소에 실제 문제 번호가 새지 않았는지 검사한다.
// 이 저장소는 "빈 그릇"이어야 한다 — 문제 번호는 각자의 private 저장소에만 있어야 한다.
// 사용법: node pipeline/guard-public.mjs

import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const ALLOWED_IDS = new Set(['1001', '2001']) // fixtures 의 가상 문제
const KEY_RE = /w\d+d\d+_(\d+)_/g

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n')
const leaks = []

for (const file of tracked) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch {
    continue // 바이너리 등
  }
  for (const [, id] of text.matchAll(KEY_RE)) {
    if (!ALLOWED_IDS.has(id)) leaks.push({ file, id })
  }
}

if (leaks.length) {
  console.error('공개 저장소에 실제 문제 번호로 보이는 것이 있습니다:')
  for (const { file, id } of leaks) console.error(`  ${file}  ->  ${id}`)
  console.error(`\n가상 번호로 바꾸거나, 의도된 것이면 ALLOWED_IDS 에 추가하세요.`)
  process.exit(1)
}

console.log(`추적 파일 ${tracked.length}개 검사 — 유출 없음`)
