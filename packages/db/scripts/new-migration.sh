#!/usr/bin/env bash
# Writes the SQL for schema.prisma changes as the next numbered file in
# prisma/migrations (the folder wrangler applies to D1). It diffs against the
# existing migrations using a throwaway shadow DB, so no local database file
# is needed. Usage: pnpm --filter @surescore/db migration [snake_case_name]
set -euo pipefail
cd "$(dirname "$0")/.."

name="${1:-schema_update}"
last=$(ls prisma/migrations | grep -E '^[0-9]{4}_' | sort | tail -1)
next=$(printf '%04d' $((10#${last%%_*} + 1)))
shadow=$(mktemp -u)/shadow.db
mkdir -p "$(dirname "$shadow")"
trap 'rm -rf "$(dirname "$shadow")"' EXIT

sql=$(npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "file:$shadow" --script)

if grep -q "empty migration" <<<"$sql"; then
  echo "No schema changes to migrate."
  exit 0
fi

mkdir "prisma/migrations/${next}_${name}"
printf '%s\n' "$sql" > "prisma/migrations/${next}_${name}/migration.sql"
echo "Created prisma/migrations/${next}_${name}. Apply with: pnpm --filter @surescore/api db:migrate:local"
