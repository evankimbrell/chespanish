#!/bin/sh
# Boot sequence for the Fly machine: the volume mounts root-owned, so fix ownership
# once (guarded — no full re-chown on every boot), seed committed fixtures
# copy-if-absent, then run the server as the unprivileged user.
set -e
D="${DATA_DIR:-/data}"
mkdir -p "$D"
[ "$(stat -c %u "$D")" = "1001" ] || chown nextjs:nodejs "$D"
cp -rn /app/seed/. "$D"/ 2>/dev/null || true
# Seeded files arrive root-owned when copied by this (root) shell — hand them over.
chown -R nextjs:nodejs "$D"/media "$D"/reports 2>/dev/null || true
exec gosu nextjs node server.js
