#!/usr/bin/env bash
# 학습 저장소 -> content.json -> APK
#
# 사용법:  bash pipeline/build-apk.sh <학습저장소경로> [debug|release]
#
# 콘텐츠는 빌드 시점에 APK 에 구워진다. 런타임 네트워크가 없어야 눌렀을 때 즉시 뜬다.
set -euo pipefail

REPO="${1:?학습 저장소 경로가 필요합니다}"
VARIANT="${2:-release}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${ANDROID_HOME:=$HOME/Android/sdk}"
: "${GRADLE:=gradle}"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"

ASSETS="$ROOT/app/reader/src/main/assets"
mkdir -p "$ASSETS"

echo "[1/3] 콘텐츠 추출"
node "$ROOT/pipeline/extract.mjs" --repo "$REPO" --out "$ASSETS/content.json"

echo "[2/3] SDK 위치 기록"
printf 'sdk.dir=%s\n' "$(cygpath -m "$ANDROID_HOME" 2>/dev/null || echo "$ANDROID_HOME")" > "$ROOT/app/local.properties"

echo "[3/3] APK 빌드 ($VARIANT)"
TASK="assemble$(printf '%s' "${VARIANT:0:1}" | tr '[:lower:]' '[:upper:]')${VARIANT:1}"
"$GRADLE" -p "$ROOT/app" ":reader:$TASK" --console=plain

find "$ROOT/app/reader/build/outputs/apk" -name '*.apk' -exec ls -la {} \;
