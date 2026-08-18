// MCP 서버가 기억하는 것 — 어느 학습 저장소를 보고 있는지 하나.
// 한 번 setup_repo 로 붙여 두면 다음 실행부터는 인자 없이 뜬다.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

// SWEA_CONFIG 로 자리를 옮길 수 있다 — 자체 검증이 사용자의 진짜 설정을 덮지 않도록.
export const CONFIG_PATH = process.env.SWEA_CONFIG ?? join(homedir(), '.sweaconnector', 'config.json')

export async function readServerConfig() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    return {}
  }
}

export async function writeServerConfig(next) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8')
  return CONFIG_PATH
}
