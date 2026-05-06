#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  echo "Copy $SCRIPT_DIR/.env.example to $ENV_FILE and fill values."
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# Prevent k6 global options from overriding script scenarios if they exist in outer shell.
unset K6_VUS K6_DURATION K6_ITERATIONS K6_STAGES

exec k6 run "$SCRIPT_DIR/combined-system.js"
