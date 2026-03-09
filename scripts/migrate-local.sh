#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/migrations"
D1_DATABASE_NAME="${D1_DATABASE_NAME:-test}"

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "Migrations directory not found at ${MIGRATIONS_DIR}"
  exit 0
fi

shopt -s nullglob
SQL_FILES=("${MIGRATIONS_DIR}"/*.sql)

if [[ ${#SQL_FILES[@]} -eq 0 ]]; then
  echo "No migration files found in ${MIGRATIONS_DIR}"
  exit 0
fi

for file in "${SQL_FILES[@]}"; do
  echo "Applying migration (local): ${file}"
  npx wrangler d1 execute "${D1_DATABASE_NAME}" --local --file="${file}"
done
