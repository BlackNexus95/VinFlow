#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_CMD="$ROOT_DIR/vm/ssh-vm.sh"

mkdir -p "$ROOT_DIR/release"
"$SSH_CMD" "cat /home/dev/finance/release/finflow-debug.apk" > "$ROOT_DIR/release/finflow-debug.apk"

# Also copy generated Capacitor android project sources (excluding heavy build/.gradle caches)
"$SSH_CMD" "tar -C /home/dev/finance/frontend --exclude='android/.gradle' --exclude='android/build' --exclude='android/app/build' -cf - android" | tar -C "$ROOT_DIR/frontend" -xf -

ls -lh "$ROOT_DIR/release/finflow-debug.apk"
