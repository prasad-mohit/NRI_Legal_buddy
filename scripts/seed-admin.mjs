import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomBytes, pbkdf2Sync, createHash } from "node:crypto";
import initSqlJs from "sql.js";

const rootDir = process.cwd();
const dbPath = resolve(rootDir, "prisma", "dev.db");

const email = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_NAME ?? "System Administrator";
const role = process.env.ADMIN_ROLE ?? "super-admin";

if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed an admin user.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(password, salt, 120_000, 64, "sha512").toString("hex");
const passwordHash = `${salt}:${hash}`;

const SQL = await initSqlJs({
  locateFile: (file) => resolve(rootDir, "node_modules", "sql.js", "dist", file),
});

const dbFile = await readFile(dbPath).catch(() => null);
const db = dbFile ? new SQL.Database(dbFile) : new SQL.Database();

db.run(
  `INSERT OR REPLACE INTO AdminUser (id, email, displayName, role, passwordHash, createdAt)
   VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  [
    `ADMIN-${Date.now()}`,
    email,
    displayName,
    role,
    passwordHash,
  ]
);

const data = db.export();
await mkdir(dirname(dbPath), { recursive: true });
await writeFile(dbPath, Buffer.from(data));

const checksum = createHash("sha256").update(password).digest("hex");
console.log("Admin seed complete:");
console.log(`  email: ${email}`);
console.log(`  password hint: sha256:${checksum.slice(0, 8)}`);
