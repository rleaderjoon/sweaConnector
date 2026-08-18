#!/usr/bin/env bash
# 뷰어 APK 를 굽는다.
#
# 사용법:  bash pipeline/build-apk.sh [debug|release]
#
# APK 안에는 콘텐츠가 없다. 문제도 풀이도 첫 실행에 적은 git 저장소에서 받아 온다.
# 그래서 이 APK 는 누가 써도 되고, 남에게 줘도 자기 풀이가 딸려 가지 않는다.
set -euo pipefail

VARIANT="${1:-release}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${ANDROID_HOME:=$HOME/Android/sdk}"
# wrapper 를 먼저 본다 — gradle 을 따로 깔지 않아도 되고, 버전이 사람마다 갈리지 않는다.
: "${GRADLE:=$ROOT/app/gradlew}"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"

echo "[1/2] SDK 위치 기록"
printf 'sdk.dir=%s\n' "$(cygpath -m "$ANDROID_HOME" 2>/dev/null || echo "$ANDROID_HOME")" > "$ROOT/app/local.properties"

echo "[2/2] APK 빌드 ($VARIANT)"
TASK="assemble$(printf '%s' "${VARIANT:0:1}" | tr '[:lower:]' '[:upper:]')${VARIANT:1}"
"$GRADLE" -p "$ROOT/app" ":reader:$TASK" --console=plain

find "$ROOT/app/reader/build/outputs/apk" -name '*.apk' -exec ls -la {} \;
