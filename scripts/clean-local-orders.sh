#!/usr/bin/env bash
set -euo pipefail

D1_DATABASE_NAME="${D1_DATABASE_NAME:-test}"
TABLE_NAME="${TABLE_NAME:-orders}"

SQL="DELETE FROM ${TABLE_NAME};"

echo "Cleaning local table '${TABLE_NAME}' on D1 database '${D1_DATABASE_NAME}'"
echo "${SQL}" | npx wrangler d1 execute "${D1_DATABASE_NAME}" --local --command

