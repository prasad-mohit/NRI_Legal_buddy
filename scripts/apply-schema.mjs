import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import initSqlJs from "sql.js";

const rootDir = process.cwd();
const schemaPath = resolve(rootDir, "docs", "schema.sql");
const dbPath = resolve(rootDir, "prisma", "dev.db");

const schemaSql = await readFile(schemaPath, "utf8");

const SQL = await initSqlJs({
  locateFile: (file) => resolve(rootDir, "node_modules", "sql.js", "dist", file),
});

const db = new SQL.Database();
db.exec(schemaSql);

const data = db.export();
await mkdir(dirname(dbPath), { recursive: true });
await writeFile(dbPath, Buffer.from(data));

console.log(`SQLite database created at ${dbPath}`);
