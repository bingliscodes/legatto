#!/usr/bin/env bash
#
# backup-db.sh — dump the Legatto Postgres DB and ship it to a private Spaces
# bucket, keeping only the most recent N backups.
#
# Invoked from the droplet's crontab (see DECISIONS.md D11). The dump itself
# uses the postgres container's local trust auth, so no DB password is needed
# here; the upload reuses the app's Spaces creds from backend/.env.
#
# `set -e` means ANY failing command aborts the script with a non-zero exit, so
# cron will mail you. A silent backup failure is the worst possible outcome.

set -euo pipefail

# --- config ------------------------------------------------------------------
PROJECT_DIR="${PROJECT_DIR:-/root/legatto}"   # where the compose files live
BACKUP_BUCKET="legatto-backups"               # PRIVATE bucket — create it first
KEEP=7                                          # how many backups to retain
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP_NAME="legatto-${TIMESTAMP}.dump"

cd "$PROJECT_DIR"

# Spaces creds for the upload. SPACES_* live in backend/.env; awscli reads the
# AWS_* names, so map them across. (Sourcing an env file is a mild footgun — a
# value containing '$' would expand — but the hex/base64 creds here are safe.)
set -a; . backend/.env; set +a
export AWS_ACCESS_KEY_ID="$SPACES_KEY"
export AWS_SECRET_ACCESS_KEY="$SPACES_SECRET"
export AWS_DEFAULT_REGION="$SPACES_REGION"
ENDPOINT="$SPACES_ENDPOINT"

# temp file on the host, cleaned up on exit whether we succeed or fail
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# --- 1. dump -----------------------------------------------------------------
# TODO(you): run pg_dump INSIDE the postgres container, custom format, writing
# the dump to "$TMP" on the host.
#   facts:
#     docker compose exec -T postgres ...      # -T = no TTY (required under cron)
#     wrap pg_dump in  sh -c '...'  so $POSTGRES_USER / $POSTGRES_DB expand
#       INSIDE the container, not on the host — this quoting boundary is the
#       whole trick; get it wrong and the vars come back empty.
#     pg_dump flags:  -U <user>  -Fc  <dbname>   # -Fc = compressed custom format
#     redirect stdout of the whole exec to "$TMP"

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$TMP"
# fail loudly if the dump came back empty
[ -s "$TMP" ] || { echo "dump is empty — aborting" >&2; exit 1; }

# --- 2. upload ---------------------------------------------------------------
# TODO(you): copy "$TMP" up to  s3://$BACKUP_BUCKET/$DUMP_NAME
#   facts:
#     aws s3 cp <src> s3://<bucket>/<key> --endpoint-url "$ENDPOINT"
#     Spaces objects are private by default — do NOT pass --acl public-read.

aws s3 cp "$TMP" "s3://$BACKUP_BUCKET/$DUMP_NAME" --endpoint-url "$ENDPOINT"
echo "uploaded $DUMP_NAME"

# --- 3. prune ----------------------------------------------------------------
# TODO(you): keep only the most recent $KEEP dumps, delete the older ones.
#   hint: the filenames are timestamped, so a lexicographic sort is already
#         chronological — no date math needed.
#     list:    aws s3 ls s3://$BACKUP_BUCKET/ --endpoint-url "$ENDPOINT"
#              (last whitespace-separated column is the filename)
#     delete:  aws s3 rm s3://$BACKUP_BUCKET/<key> --endpoint-url "$ENDPOINT"
aws s3 ls "s3://$BACKUP_BUCKET/" --endpoint-url "$ENDPOINT" |
  awk '{print $NF}' |
  sort -r |        
  tail -n +$((KEEP+1)) | 
  while read -r key; do
    aws s3 rm "s3://$BACKUP_BUCKET/$key" --endpoint-url "$ENDPOINT"
  done

echo "backup complete: $DUMP_NAME"
