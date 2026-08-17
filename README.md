# sweaConnector

**자기 알고리즘 학습 저장소를 Claude에 연결하고, 읽기 전용 안드로이드 뷰어로 굽는 도구.**

Claude가 당신의 학습 저장소를 직접 읽고 씁니다 — 다음에 풀 문제를 골라 주고, 일정을 조정하고,
풀이 노트를 기록합니다. 그 결과는 폴더블에 맞춘 전자책 형태의 앱으로 언제든 꺼내 볼 수 있습니다.

```
   ┌──────────────┐   MCP    ┌──────────────┐  빌드 시 주입  ┌──────────────┐
   │  당신의 학습   │ ───────► │    Claude    │              │  안드로이드    │
   │  저장소        │ ◄─────── │              │              │  뷰어 (APK)   │
   │  (private)    │  기록     └──────────────┘              └──────────────┘
   └──────────────┘                                                ▲
          └─────────────────────────────────────────────────────────┘
```

---

## 이 저장소에 없는 것

**문제 본문도, 문제 번호도, 풀이 코드도 여기에 없습니다.** 전부 *당신의* private 저장소에만 있습니다.

많은 알고리즘 학습 플랫폼이 문제와 풀이의 공개·공유를 약관으로 금지합니다.
그래서 sweaConnector는 의도적으로 **빈 그릇**입니다 — 도구·규약·일반 CS 개념 설명만 담고,
내용은 빌드할 때 당신의 저장소에서 주입됩니다. `fixtures/` 의 예제 문제는 전부 가상입니다.

## 구성

| 디렉터리 | 역할 |
|---|---|
| `schema/` | 학습 저장소 규약 — [STUDY_REPO.md](schema/STUDY_REPO.md) |
| `pipeline/` | 학습 저장소 → `content.json` → 앱 리소스 |
| `mcp/` | MCP 서버 — Claude가 저장소를 읽고 기록하는 창구 |
| `app/` | 안드로이드 뷰어 (Kotlin · Compose) |
| `content/` | 개념 사전 + SVG 도식 (일반 CS 지식) |
| `fixtures/` | 가상 학습 저장소 (테스트용) |

## 시작하기

```bash
git clone https://github.com/rleaderjoon/sweaConnector
cd sweaConnector

# 1. 내 저장소가 규약에 맞는지 확인
node pipeline/extract.mjs --repo /path/to/my-study-repo --out content.json

# 2. Claude 에 붙이기
claude mcp add swea -- node ./mcp/index.mjs --repo /path/to/my-study-repo

# 3. 내 APK 굽기
./gradlew -p app assembleRelease      # 또는 GitHub Actions 에 맡기기
```

## 요구 사항

- Node 20+
- JDK 17+ · Android SDK (platform 35) — 로컬 빌드할 때만. Actions 로 빌드하면 불필요.

## 설계 원칙

- **읽기 전용 뷰어.** 앱에서 편집하지 않습니다. 쓰기는 Claude(MCP)를 통해 저장소로 갑니다.
- **런타임 네트워크 없음.** 콘텐츠는 빌드 시점에 APK에 구워집니다. 눌렀을 때 파싱할 것이 없어야 즉시 뜹니다.
- **폴더블 우선.** 접으면 한 페이지, 펼치면 펼친 면. 세로·가로 모두.
- **도식은 벡터.** 알고리즘 도식은 손으로 쓴 SVG → VectorDrawable. AI 생성 이미지는 그럴싸하게 틀립니다.

## 라이선스

MIT (도구·개념 설명에 한함). 당신이 주입하는 내용의 권리·약관 준수는 당신 책임입니다.
