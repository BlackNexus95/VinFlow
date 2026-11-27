#!/usr/bin/env bash
set -euo pipefail

VM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec ssh \
  -F /dev/null \
  -i "$VM_DIR/id_ed25519" \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o LogLevel=ERROR \
  -p 2229 \
  dev@127.0.0.1 "$@"
