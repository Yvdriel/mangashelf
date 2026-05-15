#!/usr/bin/env bash
# Spin up a dev server identical to the one Playwright uses, with the
# fixture library seeded and admin + regular users provisioned. Hand the
# foreground over to `next dev` so Ctrl-C kills the server cleanly.
#
# Run: `npm run e2e:dev`
set -euo pipefail

cd "$(dirname "$0")/.."

PORT=3100
URL="http://localhost:${PORT}"

if lsof -nP -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: port ${PORT} already in use. Stop the existing process first:" >&2
  lsof -nP -iTCP:${PORT} -sTCP:LISTEN >&2
  exit 1
fi

echo "==> Running Playwright setup project (wipes .test-data, copies fixtures, seeds users + library + manager row)"
npx playwright test --project=setup

cat <<EOF

==> Dev server starting on ${URL}
    Admin   : admin@test.local / testpass123
    Regular : user@test.local  / userpass123
    Stubs   : Jackett + Deluge -> 127.0.0.1:1 (fail-fast)
    AniList : live network
    Ctrl-C  : stop

EOF

# Same env block as playwright.config.ts webServer.env so behaviour matches
# what the planner + spec runs see.
export E2E=1
export DATABASE_URL="$(pwd)/.test-data/test.db"
export MANGA_DIR="$(pwd)/.test-data/manga"
export AUTO_DOWNLOAD=false
export AUTH_ORIGIN="${URL}"
export JACKETT_URL=http://127.0.0.1:1
export JACKETT_API_KEY=test
export DELUGE_URL=http://127.0.0.1:1
export DELUGE_PASSWORD=test

exec npm run dev -- --port ${PORT}
