import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, pbkdf2Sync, createHash } from "node:crypto";
import Database from "better-sqlite3";

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

const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.prepare(
  `INSERT OR REPLACE INTO AdminUser (id, email, displayName, role, passwordHash, createdAt)
   VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
).run(
  `ADMIN-${Date.now()}`,
  email,
  displayName,
  role,
  passwordHash,
);

db.close();

const checksum = createHash("sha256").update(password).digest("hex");
console.log("Admin seed complete:");
console.log(`  email: ${email}`);
console.log(`  password hint: sha256:${checksum.slice(0, 8)}`);
