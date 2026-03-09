#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const MIGRATIONS_DIR = resolve(ROOT_DIR, "migrations");
const WRANGLER_TOML_PATH = resolve(ROOT_DIR, "wrangler.toml");

function parseArgs(argv) {
  const args = {
    database: null,
    remote: false,
    local: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--remote") {
      args.remote = true;
    } else if (arg === "--local") {
      args.local = true;
    } else if (arg.startsWith("--database=")) {
      args.database = arg.slice("--database=".length);
    }
  }

  return args;
}

function printHelp() {
  console.log(
    [
      "Usage: node scripts/migrate.mjs [--local|--remote] [--database=NAME]",
      "",
      "Options:",
      "  --local           Apply migrations against the local D1 database (default).",
      "  --remote          Apply migrations against the remote D1 database.",
      "  --database=NAME   Override the D1 database_name.",
      "",
      "Database resolution order:",
      "  1. --database=NAME flag",
      "  2. D1_DATABASE_NAME environment variable",
      "  3. First [[d1_databases]] block in wrangler.toml (database_name).",
    ].join("\n"),
  );
}

function readDatabaseNameFromWranglerToml() {
  let contents;
  try {
    contents = readFileSync(WRANGLER_TOML_PATH, "utf8");
  } catch (err) {
    throw new Error(
      `Could not read wrangler.toml at ${WRANGLER_TOML_PATH}: ${err.message}`,
    );
  }

  const match = contents.match(
    /\[\[d1_databases\]\][\s\S]*?database_name\s*=\s*"(.*?)"/m,
  );
  if (!match) {
    throw new Error(
      "Unable to determine database_name from wrangler.toml (no [[d1_databases]] with database_name found).",
    );
  }

  return match[1];
}

function resolveDatabaseName(cliDatabase) {
  if (cliDatabase && cliDatabase.trim().length > 0) {
    return cliDatabase.trim();
  }

  if (process.env.D1_DATABASE_NAME) {
    return process.env.D1_DATABASE_NAME.trim();
  }

  return readDatabaseNameFromWranglerToml();
}

function execWrangler(args, { expectJson = false } = {}) {
  const fullArgs = ["--yes", "wrangler", ...args];

  const result = spawnSync("npx", fullArgs, {
    cwd: ROOT_DIR,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const commandStr = ["npx", ...fullArgs].join(" ");
    console.error(`\nError running command: ${commandStr}`);
    if (result.stdout) {
      console.error("STDOUT:");
      console.error(result.stdout);
    }
    if (result.stderr) {
      console.error("STDERR:");
      console.error(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  if (!expectJson) {
    return null;
  }

  const trimmed = result.stdout.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (err) {
    console.error("Failed to parse JSON output from wrangler d1 execute.");
    console.error("Raw output:");
    console.error(trimmed);
    throw err;
  }
}

function execSql(dbName, sql, { local, remote, expectJson = false } = {}) {
  const modeArgs = remote ? ["--remote"] : ["--local"];
  const args = ["d1", "execute", dbName, ...modeArgs, "--command", sql];
  if (expectJson) {
    args.push("--json");
  }
  return execWrangler(args, { expectJson });
}

function execSqlFile(dbName, filePath, { local, remote } = {}) {
  const modeArgs = remote ? ["--remote"] : ["--local"];
  const args = ["d1", "execute", dbName, ...modeArgs, "--file", filePath];
  return execWrangler(args, { expectJson: false });
}

function ensureSchemaMigrationsTable(dbName, { local, remote }) {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `;

  execSql(dbName, sql, { local, remote, expectJson: false });
}

function hasMigrationRun(dbName, filename, { local, remote }) {
  const escaped = filename.replace(/'/g, "''");
  const sql = `SELECT COUNT(*) AS cnt FROM schema_migrations WHERE filename = '${escaped}';`;
  const data = execSql(dbName, sql, { local, remote, expectJson: true });

  if (!data || !Array.isArray(data) || data.length === 0) {
    return false;
  }

  const row = data[0]?.results?.[0];
  if (!row) {
    return false;
  }

  const value = row.cnt ?? row["COUNT(*)"] ?? 0;
  return Number(value) > 0;
}

function recordMigration(dbName, filename, { local, remote }) {
  const escaped = filename.replace(/'/g, "''");
  const sql = `INSERT INTO schema_migrations (filename) VALUES ('${escaped}');`;
  execSql(dbName, sql, { local, remote, expectJson: false });
}

function getMigrationFiles() {
  let entries;
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch (err) {
    console.log(`No migrations directory found at ${MIGRATIONS_DIR}. Nothing to do.`);
    process.exit(0);
  }

  const files = entries
    .filter((name) => name.toLowerCase().endsWith(".sql"))
    .map((name) => resolve(MIGRATIONS_DIR, name))
    .filter((fullPath) => statSync(fullPath).isFile())
    .sort();

  if (files.length === 0) {
    console.log(`No migration files (.sql) found in ${MIGRATIONS_DIR}.`);
    process.exit(0);
  }

  return files;
}

async function main() {
  const argInfo = parseArgs(process.argv.slice(2));

  if (argInfo.help) {
    printHelp();
    process.exit(0);
  }

  const remote = argInfo.remote === true;
  const local = !remote; // default to local if not explicitly remote

  const dbName = resolveDatabaseName(argInfo.database);

  console.log(
    `Applying migrations for D1 database "${dbName}" (${remote ? "remote" : "local"})`,
  );

  ensureSchemaMigrationsTable(dbName, { local, remote });

  const files = getMigrationFiles();

  let appliedCount = 0;
  for (const file of files) {
    const filename = file.split("/").pop();
    if (!filename) continue;

    if (hasMigrationRun(dbName, filename, { local, remote })) {
      console.log(`Skipping already-applied migration: ${filename}`);
      continue;
    }

    console.log(`Applying migration: ${filename}`);
    execSqlFile(dbName, file, { local, remote });
    recordMigration(dbName, filename, { local, remote });
    appliedCount += 1;
  }

  if (appliedCount === 0) {
    console.log("No pending migrations. Database is up to date.");
  } else {
    console.log(`Applied ${appliedCount} migration(s).`);
  }
}

main().catch((err) => {
  console.error("Migration failed with an unexpected error:");
  console.error(err);
  process.exit(1);
});

