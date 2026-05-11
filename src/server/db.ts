import { type Database as SqlJsDatabase } from "sql.js";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

// ---------------------------------------------------------------------------
// SQLite database path
// ---------------------------------------------------------------------------
const DB_PATH = process.env.SQLITE_DB_PATH ?? resolve(process.cwd(), "prisma", "dev.db");

// Ensure directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Singleton database connection (sql.js)
// ---------------------------------------------------------------------------
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;

declare global {
  // eslint-disable-next-line no-var
  var __sqlite: SqlJsDatabase | undefined;
  // eslint-disable-next-line no-var
  var __sqliteInitPromise: Promise<SqlJsDatabase> | undefined;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persistDb(db: SqlJsDatabase) {
  if (saveTimer) return; // debounce writes
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const data = db.export();
      writeFileSync(DB_PATH, Buffer.from(data));
    } catch {
      // ignore write errors in edge cases
    }
  }, 100);
}

async function initDb(): Promise<SqlJsDatabase> {
  if (global.__sqlite) return global.__sqlite;
  if (global.__sqliteInitPromise) return global.__sqliteInitPromise;

  global.__sqliteInitPromise = (async () => {
    // Use eval to bypass webpack bundling of sql.js
    const requireFn = typeof __webpack_require__ === "function"
      ? __non_webpack_require__
      : require;
    const initSqlJs = requireFn("sql.js/dist/sql-asm.js"); // eslint-disable-line
    const SQL = await initSqlJs();
    let db: SqlJsDatabase;
    if (existsSync(DB_PATH)) {
      const buffer = readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
    db.run("PRAGMA foreign_keys = ON");
    global.__sqlite = db;
    return db;
  })();

  return global.__sqliteInitPromise;
}

const getDb = async (): Promise<SqlJsDatabase> => {
  return initDb();
};

// ---------------------------------------------------------------------------
// Tagged template literal helper
// ---------------------------------------------------------------------------
function buildQuery(strings: TemplateStringsArray, values: unknown[]): { sql: string; params: unknown[] } {
  let sql = "";
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < values.length) {
      sql += "?";
      params.push(values[i]);
    }
  }
  return { sql: sql.trim(), params };
}

// ---------------------------------------------------------------------------
// Model proxy helpers (minimal Prisma-compatible model API)
// ---------------------------------------------------------------------------
type WhereClause = Record<string, unknown>;
type DataObject = Record<string, unknown>;

function generateId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 25);
}

function buildInsert(table: string, data: DataObject): { sql: string; params: unknown[] } {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  const columns = entries.map(([k]) => k);
  const params = entries.map(([, v]) => v);
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO "${table}" (${columns.join(", ")}) VALUES (${placeholders})`;
  return { sql, params };
}

function buildUpdate(table: string, where: WhereClause, data: DataObject): { sql: string; params: unknown[] } {
  const dataEntries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (dataEntries.length === 0) {
    // Nothing to update, just return a no-op
    const whereEntries = Object.entries(where);
    const whereClauses = whereEntries.map(([k]) => `${k} = ?`);
    const whereParams = whereEntries.map(([, v]) => v);
    return { sql: `UPDATE "${table}" SET updatedAt = CURRENT_TIMESTAMP WHERE ${whereClauses.join(" AND ")}`, params: whereParams };
  }
  const setClauses = dataEntries.map(([k]) => `${k} = ?`);
  const setParams = dataEntries.map(([, v]) => v);

  const whereEntries = Object.entries(where);
  const whereClauses = whereEntries.map(([k]) => `${k} = ?`);
  const whereParams = whereEntries.map(([, v]) => v);

  const sql = `UPDATE "${table}" SET ${setClauses.join(", ")}, updatedAt = CURRENT_TIMESTAMP WHERE ${whereClauses.join(" AND ")}`;
  return { sql, params: [...setParams, ...whereParams] };
}

function buildSelect(table: string, where: WhereClause): { sql: string; params: unknown[] } {
  const entries = Object.entries(where);
  const clauses = entries.map(([k]) => `${k} = ?`);
  const params = entries.map(([, v]) => v);
  const sql = `SELECT * FROM "${table}" WHERE ${clauses.join(" AND ")} LIMIT 1`;
  return { sql, params };
}

// ---------------------------------------------------------------------------
// sql.js query helpers
// ---------------------------------------------------------------------------
function queryAll(db: SqlJsDatabase, sql: string, params: unknown[]): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params.map(v => v === undefined ? null : v));
  }
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

function runStatement(db: SqlJsDatabase, sql: string, params: unknown[]): void {
  db.run(sql, params.map(v => v === undefined ? null : v));
}

function getChanges(db: SqlJsDatabase): number {
  const result = queryAll(db, "SELECT changes() as cnt", []);
  return (result[0]?.cnt as number) ?? 0;
}

function createModelProxy(tableName: string) {
  return {
    async findUnique(args: { where: WhereClause }) {
      const db = await getDb();
      const { sql, params } = buildSelect(tableName, args.where);
      const rows = queryAll(db, sql, params);
      persistDb(db);
      return rows[0] ?? null;
    },
    async findMany(args?: { where?: WhereClause; orderBy?: Record<string, "asc" | "desc"> }) {
      const db = await getDb();
      let sql = `SELECT * FROM "${tableName}"`;
      const params: unknown[] = [];
      if (args?.where) {
        const entries = Object.entries(args.where);
        if (entries.length > 0) {
          sql += " WHERE " + entries.map(([k]) => `${k} = ?`).join(" AND ");
          params.push(...entries.map(([, v]) => v));
        }
      }
      if (args?.orderBy) {
        const orderEntries = Object.entries(args.orderBy);
        if (orderEntries.length > 0) {
          sql += " ORDER BY " + orderEntries.map(([k, dir]) => `${k} ${dir.toUpperCase()}`).join(", ");
        }
      }
      const rows = queryAll(db, sql, params);
      persistDb(db);
      return rows;
    },
    async create(args: { data: DataObject }) {
      const db = await getDb();
      const data = { ...args.data };
      if (!data.id) {
        data.id = generateId();
      }
      if (!data.createdAt) {
        data.createdAt = new Date().toISOString();
      }
      const { sql, params } = buildInsert(tableName, data);
      runStatement(db, sql, params);
      // Return the inserted row
      const rows = queryAll(db, `SELECT * FROM "${tableName}" WHERE id = ?`, [data.id]);
      persistDb(db);
      return (rows[0] ?? data) as Record<string, unknown>;
    },
    async update(args: { where: WhereClause; data: DataObject }) {
      const db = await getDb();
      const { sql, params } = buildUpdate(tableName, args.where, args.data);
      runStatement(db, sql, params);
      // Return updated row
      const { sql: selectSql, params: selectParams } = buildSelect(tableName, args.where);
      const rows = queryAll(db, selectSql, selectParams);
      persistDb(db);
      return rows[0] as Record<string, unknown>;
    },
  };
}

// ---------------------------------------------------------------------------
// Prisma-compatible wrapper
// ---------------------------------------------------------------------------
const prisma = {
  async $queryRaw<T = unknown[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    const db = await getDb();
    const { sql, params } = buildQuery(strings, values);
    const rows = queryAll(db, sql, params);
    persistDb(db);
    return rows as T;
  },

  async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number> {
    const db = await getDb();
    const { sql, params } = buildQuery(strings, values);
    runStatement(db, sql, params);
    persistDb(db);
    return getChanges(db);
  },

  async $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number> {
    const db = await getDb();
    if (values.length === 0) {
      db.run(sql);
      persistDb(db);
      return 0;
    }
    runStatement(db, sql, values);
    persistDb(db);
    return getChanges(db);
  },

  async $queryRawUnsafe<T = unknown[]>(sql: string, ...values: unknown[]): Promise<T> {
    const db = await getDb();
    if (values.length === 0) {
      const rows = queryAll(db, sql, []);
      persistDb(db);
      return rows as T;
    }
    const rows = queryAll(db, sql, values);
    persistDb(db);
    return rows as T;
  },

  // Model proxies
  get case() { return createModelProxy("Case"); },
  get meeting() { return createModelProxy("Meeting"); },
  get videoReservation() { return createModelProxy("VideoReservation"); },
  get vaultDocument() { return createModelProxy("VaultDocument"); },
  get user() { return createModelProxy("User"); },
  get session() { return createModelProxy("Session"); },
  get blog() { return createModelProxy("Blog"); },
};

export default prisma;
