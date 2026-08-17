// 개념 사전 읽기 — content/concepts/*.md
// 이쪽은 일반 CS 지식이라 공개 저장소에 그대로 들어간다.

import { readdir, readFile } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitFrontmatter } from './lib.mjs'

const CONCEPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'concepts')

export async function readConcepts(dir = CONCEPTS_DIR) {
  let files
  try {
    files = (await readdir(dir)).filter(f => f.endsWith('.md'))
  } catch {
    return []
  }

  const concepts = []
  for (const file of files.sort()) {
    const { data, body } = splitFrontmatter(await readFile(join(dir, file), 'utf8'))
    concepts.push({
      id: data.id ?? basename(file, '.md'),
      title: data.title ?? basename(file, '.md'),
      order: data.order ?? 999,
      tags: data.tags ?? [],
      diagram: data.diagram ?? null,
      body: body.trim(),
    })
  }
  return concepts.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}
