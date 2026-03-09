#!/usr/bin/env bash
set -euo pipefail

npm run migrate:local
npm run build
npx wrangler dev
