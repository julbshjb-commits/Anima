#!/usr/bin/env bash
# Applique les migrations sur un Postgres jetable et lance les tests RLS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DIR="$(mktemp -d)"
if [ "$(id -u)" = 0 ]; then RUN="runuser -u postgres --"; chown postgres "$DIR"; else RUN=""; fi
trap '$RUN "$PGBIN/pg_ctl" -D "$DIR" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
$RUN "$PGBIN/initdb" -D "$DIR" -U postgres -A trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DIR" -o "-p 54329 -k /tmp -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL="psql -h /tmp -p 54329 -U postgres -d postgres -q -v ON_ERROR_STOP=1"
$PSQL -f "$ROOT/supabase/tests/00_stub_supabase.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do $PSQL -f "$f"; done
$PSQL -f "$ROOT/supabase/tests/10_rls_test.sql"
