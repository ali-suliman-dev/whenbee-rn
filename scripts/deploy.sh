#!/usr/bin/env bash
set -euo pipefail

# Whenbee one-command deploy. Wraps the battle-tested device scripts in
# .claude/skills/whenbee-device/scripts/ so there is a single entry point.
#
#   ./scripts/deploy.sh android   # Release APK → plugged-in Android phone (data-safe install -r)
#   ./scripts/deploy.sh ios       # Release build → iPhone via devicectl (free-team signing)
#   ./scripts/deploy.sh sim       # dev build + Metro on the iOS simulator (npm run ios)
#
# Env overrides (optional):
#   WHENBEE_ANDROID_SERIAL  target a specific adb device
#   WHENBEE_DEVICE          iPhone UDID   WHENBEE_TEAM  Apple team id

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEVICE_SCRIPTS="${REPO_DIR}/.claude/skills/whenbee-device/scripts"

case "${1:-}" in
  android)
    exec bash "${DEVICE_SCRIPTS}/build-and-launch-android.sh"
    ;;
  ios)
    exec bash "${DEVICE_SCRIPTS}/build-and-launch.sh"
    ;;
  sim)
    cd "${REPO_DIR}" && exec npm run ios
    ;;
  *)
    echo "Usage: ./scripts/deploy.sh {android|ios|sim}"
    echo "  android  Release APK to Android device (keeps app data)"
    echo "  ios      Release build to iPhone"
    echo "  sim      dev build on iOS simulator"
    exit 1
    ;;
esac
