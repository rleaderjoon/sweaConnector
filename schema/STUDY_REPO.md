# 학습 저장소 규약 (Study Repo Convention) — v1

sweaConnector는 **당신의 학습 저장소를 읽기만** 합니다. 저장소는 당신 소유이고 private이어도 됩니다.
이 문서는 sweaConnector가 무엇을 어떻게 읽는지에 대한 계약입니다.

> **중요**: sweaConnector 저장소(public)에는 문제 본문·문제 번호·풀이 코드를 넣지 않습니다.
> 그런 내용은 전부 당신의 private 학습 저장소에만 존재합니다. 공개 저장소는 빈 그릇입니다.

---

## 1. 최소 요구 사항

```
<your-study-repo>/
├─ STUDY_PLAN.md              (선택) 일정 문서
└─ src/
   ├─ w1d1_1001_prefixsum/    문제 폴더
   │  ├─ NOTES.md             ← 기록의 원본
   │  ├─ Main.java            ← 풀이
   │  └─ input.txt
   └─ w1d2_2001_ledger/
      ├─ NOTES.md
      ├─ Solution.java
      ├─ UserSolution.java    ← 풀이 (API 구현형)
      └─ sample_input.txt
```

`src/` 아래 디렉터리 하나가 문제 하나입니다. 언어는 무엇이든 됩니다.

## 2. 폴더 이름

```
w<week>d<day>_<problemId>_<slug>      w1d1_1001_prefixsum
w<week>d<day>_<slug>                  w1d5_dijkstra_drill      (problemId 없음 = 연습)
```

`week`/`day`는 정수, `problemId`는 있으면 정수, `slug`는 자유. 이 규칙에서 벗어난 폴더는 건너뜁니다.

## 3. NOTES.md

### 3-1. 프론트매터 (권장, 없어도 됨)

```yaml
---
title: 이진수 표현
type: basic          # basic | pro
topic: [비트연산]
difficulty: D3
status: solved       # todo | attempting | solved | failed
attempts: 1
solvedAt: 2026-08-17
timeSpentMin: 45
concepts: [bitmask]  # 개념 사전 항목 id
diagram: bitmask-lower-n   # 도식 id
---
```

프론트매터가 있으면 **항상 그것이 이깁니다.** 없으면 아래 3-2로 추론합니다.
MCP가 진도를 기록할 때 이 블록을 만들어 줍니다 — 직접 쓸 필요 없습니다.

### 3-2. 프론트매터가 없을 때의 추론

| 필드 | 추론 방법 |
|---|---|
| `title` | 첫 `# 제목` 줄에서 문제 번호를 뗀 나머지 |
| `type` | `UserSolution.*` 가 있으면 `pro`, 없으면 `basic` |
| `topic` / `difficulty` | 본문 표의 `| 유형 |` / `| 난이도 |` 행 |
| `status` | 풀이 파일의 유효 코드 줄 수가 **같은 type 파일들의 최빈값**보다 크면 `attempting` 이상 |

> 최빈값 기준선은 부트스트랩용 근사입니다. 절반 넘게 풀리면 뒤집히므로,
> 그때까지는 MCP가 프론트매터를 채워 두게 됩니다.

### 3-3. 본문 섹션

`## <제목>` 단위로 잘라 그대로 전달합니다. 아래 제목은 특별 취급합니다:

| 섹션 | 쓰임 |
|---|---|
| `## 접근 힌트` | 상세 화면 상단 |
| `## 풀이 기록` | 시도 이력 |
| `## 실패 원인` | 체크박스를 집계해 회고 화면에 |
| `## 다시 푼다면` | 상세 화면 하단 |

없는 섹션은 그냥 비어 있는 것으로 처리합니다.

## 4. 풀이 파일 선택 규칙

우선순위대로 처음 발견된 하나를 "풀이"로 봅니다.

```
UserSolution.*  →  Main.*  →  Solution.*  →  그 외 소스 파일 중 가장 큰 것
```

`Solution.*`는 API 구현형에서 제공되는 껍데기라 `UserSolution.*`보다 낮은 순위입니다.

## 5. 무시하는 것

`bin/`, `*.class`, `.metadata/`, `.git/`, `node_modules/`, 점으로 시작하는 디렉터리.

## 6. 출력

파이프라인은 위를 읽어 `content.json` 하나로 만듭니다. 앱은 이 JSON만 봅니다.

```json
{
  "generatedAt": "...",
  "weeks":    [{ "week": 1, "problems": ["w1d1_1001_prefixsum", "..."] }],
  "problems": [{ "key": "w1d1_1001_prefixsum", "week": 1, "day": 1, "problemId": 1001,
                 "title": "구간 합 빠르게 구하기", "type": "basic", "status": "solved",
                 "topic": ["누적합"], "difficulty": "D2",
                 "sections": { "접근 힌트": "..." },
                 "solution": { "file": "Main.java", "lang": "java", "code": "..." } }],
  "concepts": [{ "id": "union-find", "title": "Union-Find", "body": "...", "diagram": "union-find-compress" }]
}
```
