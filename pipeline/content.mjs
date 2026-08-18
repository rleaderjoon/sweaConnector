// 학습 저장소 + 개념 사전 + 도식  ->  앱이 읽는 모델 하나.
//
// 앱은 런타임에 마크다운도 SVG 도 파싱하지 않는다. 전부 여기서 블록/도형으로 미리 바꾼다.
// 이 모듈은 모델을 만들기만 하고, 파일로 어떻게 나눌지는 publish.mjs 가 정한다.

import { readStudyRepo } from './lib.mjs'
import { readConcepts } from './concepts.mjs'
import { readDiagrams } from './svg.mjs'
import { toBlocks } from './markdown.mjs'

// 앱은 읽는 물건이다. 링크만 든 섹션과 체크리스트용 섹션은 지면을 먹기만 한다.
// (원본 문제 링크는 출처 문자열로 대신 메타 줄에 들어간다)
const SKIP_SECTIONS = new Set(['시작 전 3단계 (건너뛰지 말 것)', '원본 문제'])

export async function buildContent(repo) {
  const { config, baseline, weeks, problems, skipped } = await readStudyRepo(repo)
  const concepts = await readConcepts()
  const diagrams = await readDiagrams()

  return {
    config,
    baseline,
    skipped,
    weeks,
    problems: problems.map(p => ({
      // 인덱스에 실리는 메타 — 목록 화면은 이것만으로 다 그려진다
      meta: {
        key: p.key,
        week: p.week,
        day: p.day,
        problemId: p.problemId,
        title: p.title,
        type: p.type,
        difficulty: p.difficulty,
        topic: p.topic,
        source: p.source,
        status: p.status,
        scheduledOn: p.scheduledOn,
        solvedAt: p.solvedAt,
        attempts: p.attempts,
        timeSpentMin: p.timeSpentMin,
        concepts: p.concepts,
        diagram: p.diagram,
      },
      // 조각 파일로 나가는 본문 — 눌렀을 때만 읽힌다
      body: {
        key: p.key,
        sections: Object.entries(p.sections)
          .filter(([name]) => !SKIP_SECTIONS.has(name))
          .map(([name, text]) => ({ name, blocks: toBlocks(text) })),
        solution: p.solution ? { file: p.solution.file, lang: p.solution.lang, code: p.solution.code } : null,
      },
    })),
    concepts: concepts.map(c => ({
      meta: { id: c.id, title: c.title, tags: c.tags, diagram: c.diagram },
      body: { id: c.id, blocks: toBlocks(c.body) },
    })),
    diagrams,
  }
}
