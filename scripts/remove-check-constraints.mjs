// Migration: remove CHECK constraints from "Case" table so AWAITING_ASSIGNMENT is allowed.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import initSqlJs from "sql.js";

const rootDir = process.cwd();
const dbPath = resolve(rootDir, "prisma", "dev.db");

const SQL = await initSqlJs({
  locateFile: (file) => resolve(rootDir, "node_modules", "sql.js", "dist", file),
});

const dbFile = await readFile(dbPath);
const db = new SQL.Database(dbFile);

// Check current schema
const info = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='Case'");
const currentSql = info[0]?.values[0]?.[0] ?? "";
console.log("Current Case table SQL (trimmed):");
console.log(currentSql.toString().slice(0, 600));

// Recreate without CHECK constraints using rename trick
db.run("PRAGMA foreign_keys = OFF");

db.run(`
  CREATE TABLE IF NOT EXISTS "_Case_new" (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    serviceId TEXT NOT NULL,
    stage TEXT NOT NULL,
    caseStatus TEXT NOT NULL DEFAULT 'SUBMITTED',
    stageStatus TEXT NOT NULL DEFAULT 'PENDING',
    platformFeePaid INTEGER NOT NULL DEFAULT 0,
    paymentStatus TEXT NOT NULL DEFAULT 'pending',
    caseDetails TEXT,
    caseSummary TEXT,
    caseManagerMeta TEXT,
    practitionerMeta TEXT,
    caseManagerId TEXT,
    practitionerId TEXT,
    videoSlot TEXT,
    videoLink TEXT,
    documentCount INTEGER NOT NULL DEFAULT 0,
    escrowMilestones TEXT NOT NULL DEFAULT '[]',
    timeline TEXT NOT NULL DEFAULT '[]',
    bankInstructions TEXT,
    paymentPlan TEXT,
    paymentProofs TEXT,
    terms TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  )
`);

// Copy all existing data
db.run(`
  INSERT INTO "_Case_new"
    (id, userId, serviceId, stage, caseStatus, stageStatus, platformFeePaid, paymentStatus,
     caseDetails, caseSummary, caseManagerMeta, practitionerMeta, caseManagerId, practitionerId,
     videoSlot, videoLink, documentCount, escrowMilestones, timeline,
     bankInstructions, paymentPlan, paymentProofs, terms, createdAt, updatedAt)
  SELECT
    id, userId, serviceId, stage,
    COALESCE(caseStatus, 'SUBMITTED'),
    COALESCE(stageStatus, 'PENDING'),
    platformFeePaid, paymentStatus,
    caseDetails, caseSummary, caseManagerMeta, practitionerMeta, caseManagerId, practitionerId,
    videoSlot, videoLink, documentCount,
    COALESCE(escrowMilestones, '[]'),
    COALESCE(timeline, '[]'),
    bankInstructions, paymentPlan, paymentProofs, terms, createdAt, updatedAt
  FROM "Case"
`);

const oldCount = db.exec('SELECT COUNT(*) FROM "Case"')[0]?.values[0]?.[0];
const newCount = db.exec('SELECT COUNT(*) FROM "_Case_new"')[0]?.values[0]?.[0];
console.log(`Rows: original=${oldCount} new=${newCount}`);

db.run('DROP TABLE "Case"');
db.run('ALTER TABLE "_Case_new" RENAME TO "Case"');

db.run("PRAGMA foreign_keys = ON");

// Verify
const verify = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='Case'");
const newSql = verify[0]?.values[0]?.[0] ?? "";
if (newSql.toString().includes("CHECK")) {
  console.error("ERROR: CHECK constraint still present!");
  process.exit(1);
} else {
  console.log("✓ CHECK constraint removed successfully");
}

const finalCount = db.exec('SELECT COUNT(*) FROM "Case"')[0]?.values[0]?.[0];
console.log(`✓ Final row count: ${finalCount}`);

const data = db.export();
await writeFile(dbPath, Buffer.from(data));
console.log("✓ Database saved");
