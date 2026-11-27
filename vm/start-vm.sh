#!/usr/bin/env bash
set -euo pipefail

VM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISK="$VM_DIR/finance-dev.qcow2"
SEED="$VM_DIR/seed.iso"
PIDFILE="$VM_DIR/vm.pid"
LOGFILE="$VM_DIR/console.log"

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "VM is already running (PID $(cat "$PIDFILE"))."
  exit 0
fi

if [[ ! -f "$DISK" ]]; then
  echo "VM disk not found at $DISK" >&2
  exit 1
fi

exec qemu-system-x86_64 \
  -name finance-dev \
  -enable-kvm \
  -cpu host \
  -smp 4 \
  -m 3072 \
  -drive "file=$DISK,format=qcow2,if=virtio" \
  -drive "file=$SEED,format=raw,if=virtio,readonly=on" \
  -netdev "user,id=net0,hostfwd=tcp:127.0.0.1:2229-:22,hostfwd=tcp::3001-:3001,hostfwd=tcp::5173-:5173" \
  -device virtio-net-pci,netdev=net0 \
  -display none \
  -serial "file:$LOGFILE" \
  -monitor none \
  -pidfile "$PIDFILE" \
  -daemonize
