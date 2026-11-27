#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_CMD="$ROOT_DIR/vm/ssh-vm.sh"

tar -C "$ROOT_DIR" \
  --exclude='node_modules' \
  --exclude='backend/data' \
  --exclude='frontend/dist' \
  --exclude='frontend/android' \
  --exclude='vm/*.img' \
  --exclude='vm/*.qcow2' \
  --exclude='vm/*.iso' \
  --exclude='vm/id_*' \
  --exclude='vm/*.pid' \
  --exclude='vm/*.log' \
  -cf - .gitignore .dockerignore Dockerfile docker-compose.yml README.md backend frontend vm/provision.sh vm/build-all.sh vm/fetch-apk.sh vm/meta-data vm/ssh-vm.sh vm/start-vm.sh vm/stop-vm.sh vm/sync-to-vm.sh vm/user-data | "$SSH_CMD" "mkdir -p /home/dev/finance && tar -C /home/dev/finance -xf -"

echo "Synced project files to VM:/home/dev/finance"
