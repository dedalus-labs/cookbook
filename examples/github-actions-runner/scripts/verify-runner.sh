#!/bin/bash
# Fails closed: exits non-zero unless the registered runner is actually
# online. This is the difference between "terraform said apply succeeded"
# and "a job could really be scheduled on this runner right now."
set -euo pipefail

REPO="${1:-dedalus-labs/cookbook}"

status="$(gh api "repos/${REPO}/actions/runners" -q '.runners[] | select(.labels[].name == "dedalus") | .status' | head -1)"

if [ -z "$status" ]; then
  echo "no runner with the 'dedalus' label is registered against ${REPO}" >&2
  exit 1
fi

if [ "$status" != "online" ]; then
  echo "runner is registered but status=${status}, not online" >&2
  exit 1
fi

echo "runner online and ready"
