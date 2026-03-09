#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER_TOML="${ROOT_DIR}/wrangler.toml"

# Resolve D1 database name:
# 1. Respect D1_DATABASE_NAME env var if set
# 2. Otherwise, read the first [[d1_databases]] database_name from wrangler.toml
if [[ -z "${D1_DATABASE_NAME:-}" ]]; then
  if [[ ! -f "${WRANGLER_TOML}" ]]; then
    echo "wrangler.toml not found at ${WRANGLER_TOML} and D1_DATABASE_NAME is not set."
    exit 1
  fi

  D1_DATABASE_NAME="$(awk '
    /^\[\[d1_databases\]\]/ { inblock=1 }
    inblock && /database_name/ {
      match($0, /database_name[[:space:]]*=[[:space:]]*"([^"]+)"/, m)
      if (m[1] != "") { print m[1]; exit }
    }
  ' "${WRANGLER_TOML}")"

  if [[ -z "${D1_DATABASE_NAME}" ]]; then
    echo "Could not determine D1 database_name from wrangler.toml and D1_DATABASE_NAME is not set."
    exit 1
  fi
fi

SQL=$'
PRAGMA foreign_keys = ON;
DELETE FROM order_line_items;
DELETE FROM orders;
'

echo "Cleaning local orders and order_line_items on D1 database '${D1_DATABASE_NAME}'"
npx wrangler d1 execute "${D1_DATABASE_NAME}" --local --command "${SQL}"

