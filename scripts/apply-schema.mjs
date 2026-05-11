import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const rootDir = process.cwd();
const schemaPath = resolve(rootDir, "docs", "schema.sql");
const dbPath = resolve(rootDir, "prisma", "dev.db");

const schemaSql = readFileSync(schemaPath, "utf8");

const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(schemaSql);
db.close();

console.log(`SQLite database created at ${dbPath}`);
