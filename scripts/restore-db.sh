# 1. pull the dump from Spaces to the host  (creds already mapped in your shell)
aws s3 ls s3://legatto-backups/ --endpoint-url "$SPACES_ENDPOINT"       # find the newest name
aws s3 cp "s3://legatto-backups/legatto-<ts>.dump" /tmp/restore.dump --endpoint-url "$SPACES_ENDPOINT"

# 2. create a SCRATCH db in the same container — does NOT touch legatto
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" legatto_restore_test'

# 3. restore the dump into legatto_restore_test   ← YOUR line
#    facts: it mirrors your pg_dump line.
#      - tool is pg_restore (because -Fc), not psql
#      - target:  -d legatto_restore_test   (NOT $POSTGRES_DB — that's the live one)
#      - -T on the exec (you're piping), and feed /tmp/restore.dump in via stdin
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d legatto_restore_test' < /tmp/restore.dump

# 4. prove the rows came back
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d legatto_restore_test -c "SELECT * FROM tracks;"'
#    → you should see the track you re-uploaded. THAT is the drill passing.

# 5. tear down the scratch db
docker compose exec postgres sh -c 'dropdb -U "$POSTGRES_USER" legatto_restore_test'