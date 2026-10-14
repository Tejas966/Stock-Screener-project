#!/usr/bin/env bash
# Runs every automated test suite (macOS/Linux). Requires MySQL running and .env configured.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
status=0
echo "== Python (pytest) ==";  (cd "$root/backend-python" && .venv/bin/python -m pytest) || status=1
echo "== PHP (PHPUnit) ==";    (cd "$root/backend-php" && vendor/bin/phpunit) || status=1
echo "== Node (node:test) =="; (cd "$root/backend-node" && npm test) || status=1
echo "== Frontend (Vitest) =="; (cd "$root/frontend" && npm test) || status=1
exit $status
