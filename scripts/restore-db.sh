#!/usr/bin/env bash
#
# restore-db.sh — DISASTER RECOVERY. Restore a dump from Spaces into the LIVE
# database using the safe swap-by-rename strategy (Option 2): restore off to the
# side into legatto_new while the site keeps serving, then take a brief outage
# only for the rename cutover. Keeps the old DB as legatto_old for rollback.
#
# This is the one script whose job is destructive to production. It refuses to
# run without an explicit typed confirmation, and safety-dumps the current DB
# first so even a wrong-dump restore is itself reversible.

set -euo pipefail

# --- config (same pattern as backup-db.sh) -----------------------------------
PROJECT_DIR="${PROJECT_DIR:-/root/legatto}"
BACKUP_BUCKET="legatto-backups"
cd "$PROJECT_DIR"

set -a; . backend/.env; set +a
export AWS_ACCESS_KEY_ID="$SPACES_KEY"
export AWS_SECRET_ACCESS_KEY="$SPACES_SECRET"
export AWS_DEFAULT_REGION="$SPACES_REGION"
ENDPOINT="$SPACES_ENDPOINT"

# --- 1. choose + fetch the dump ----------------------------------------------
# TODO(you): use the dump named as $1, or default to the NEWEST in the bucket.
#   facts:
#     newest:  aws s3 ls s3://$BACKUP_BUCKET/ --endpoint-url "$ENDPOINT" | awk '{print $NF}' | sort | tail -n1
#     fetch:   aws s3 cp s3://$BACKUP_BUCKET/<key> /tmp/restore.dump --endpoint-url "$ENDPOINT"
# <fill: resolve the key (from $1 or newest), then cp it to /tmp/restore.dump>
key=$(aws s3 ls s3://$BACKUP_BUCKET/ --endpoint-url "$ENDPOINT" | 
  awk '{print $NF}' | 
  sort | 
  tail -n1)
  aws s3 cp "s3://$BACKUP_BUCKET/$key" /tmp/restore.dump --endpoint-url "$ENDPOINT"


# --- 2. safety-dump the CURRENT live DB (your backup dump line, verbatim) -----
# So a wrong-dump restore is itself recoverable. Local file is fine here.
SAFETY="/root/legatto-pre-restore-$(date -u +%Y%m%d-%H%M%S).dump"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$SAFETY"
[ -s "$SAFETY" ] || { echo "safety dump empty — aborting" >&2; exit 1; }
echo "safety dump: $SAFETY"

# --- 3. restore into a FRESH legatto_new (live DB still serving) --------------
# TODO(you): create legatto_new and pg_restore the fetched dump into it.
#   (if a prior aborted run left legatto_new, drop it first or createdb fails)
#   facts:  docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" legatto_new'
#           pg_restore into legatto_new — the mirror of the drill, /tmp/restore.dump via stdin
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" legatto_new'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d legatto_new' < /tmp/restore.dump

# --- 4. CONFIRM (the guardrail) ----------------------------------------------
# TODO(you): refuse to continue unless the user types exactly 'yes'.
#   facts:  read -r -p "About to replace the LIVE database. Type yes: " ans
#           [ "$ans" = yes ] || { echo aborted; exit 1; }
read -r -p "About to replace the LIVE database. type yes: " ans 
  [ "$ans" = yes ] || { echo aborted; exit 1; }

# --- 5. swap (the only downtime — keep it short) -----------------------------
# TODO(you): stop the app (releases its connections), rename, restart.
#   why stop first: a RENAME needs NO active connections to that DB, and must be
#   issued from a DIFFERENT database — use the maintenance db 'postgres'.
#   facts (each is the sh -c '…' boundary you know; the DB names are literals):
#     docker compose stop api worker
#     ...sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "ALTER DATABASE legatto RENAME TO legatto_old;"'
#     ...sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "ALTER DATABASE legatto_new RENAME TO legatto;"'
#     docker compose start api worker
#   (if a rename still says "being accessed by other users", a connection lingers:
#     ...-d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='legatto';")
docker compose stop api worker
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "ALTER DATABASE legatto RENAME TO legatto_old;"'
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "ALTER DATABASE legatto_new RENAME TO legatto;"' 
docker compose start api worker

echo "restore complete — rollback point kept as legatto_old"
echo "verify the site, then reclaim space:  docker compose exec postgres sh -c 'dropdb -U \"\$POSTGRES_USER\" legatto_old'"
