#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Configure tools for this process without changing the user's shell settings.
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="/opt/homebrew/opt/node@22/bin:$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
for tool in java node npm sdkmanager; do
  command -v "$tool" >/dev/null || { echo "Missing build tool: $tool"; exit 1; }
done
export APP_VARIANT=test
export EXPO_PUBLIC_APP_VARIANT=test
# Test the current working files locally. Cloud builds still require a commit.
export EAS_NO_VCS=1
# Keep local Gradle builds quieter; system properties override generated project defaults.
# Galaxy S23 uses ARM64. Scope this to the local test launcher so cloud and
# production builds keep their full device support, without editing generated files.
export GRADLE_OPTS="${GRADLE_OPTS:+$GRADLE_OPTS }-Dorg.gradle.workers.max=2 -Dorg.gradle.parallel=false -Dorg.gradle.project.reactNativeArchitectures=arm64-v8a"
echo "Local test APK: ARM64 only (Galaxy S23)"
mkdir -p builds
if [[ "${1:-}" == "--fast" ]]; then
  shift
  exec node scripts/build-local-test-fast.mjs "$@"
fi
npx --yes eas-cli@25.3.0 build --platform android --profile test --local --output "$PWD/builds/yumyumstudy-test.apk" "$@"
