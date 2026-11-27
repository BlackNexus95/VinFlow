#!/usr/bin/env bash
set -euo pipefail

VM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDFILE="$VM_DIR/vm.pid"

if [[ ! -f "$PIDFILE" ]]; then
  echo "VM is not running (no pidfile)."
  exit 0
fi

PID="$(cat "$PIDFILE")"
if kill -0 "$PID" 2>/dev/null; then
  ssh -F /dev/null -i "$VM_DIR/id_ed25519" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -p 2229 dev@127.0.0.1 "sudo poweroff" 2>/dev/null || kill "$PID"
  for _ in $(seq 1 20); do
    kill -0 "$PID" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" || true
  fi
  echo "VM stopped."
else
  echo "VM process $PID not running."
fi
rm -f "$PIDFILE"
