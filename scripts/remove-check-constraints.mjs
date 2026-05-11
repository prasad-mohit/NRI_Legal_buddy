// Migration: remove CHECK constraints from "Case" table so AWAITING_ASSIGNMENT is allowed.
import { resolve } from "node:path";
import Database from "better-sqlite3";

const rootDir = process.cwd();
const dbPath = resolve(rootDir, "prisma", "dev.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Check current schema
const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Case'").get();
const currentSql = info?.sql ?? "";
console.log("Current Case table SQL (trimmed):");
console.log(currentSql.toString().slice(0, 600));

// Recreate without CHECK constraints using rename trick
db.pragma("foreign_keys = OFF");

db.exec(`
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
db.exec(`
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

const oldCount = db.prepare('SELECT COUNT(*) as cnt FROM "Case"').get()?.cnt;
const newCount = db.prepare('SELECT COUNT(*) as cnt FROM "_Case_new"').get()?.cnt;
console.log(`Rows: original=${oldCount} new=${newCount}`);

db.exec('DROP TABLE "Case"');
db.exec('ALTER TABLE "_Case_new" RENAME TO "Case"');

db.pragma("foreign_keys = ON");

// Verify
const verify = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Case'").get();
const newSql = verify?.sql ?? "";
if (newSql.toString().includes("CHECK")) {
  console.error("ERROR: CHECK constraint still present!");
  db.close();
  process.exit(1);
} else {
  console.log("✓ CHECK constraint removed successfully");
}

const finalCount = db.prepare('SELECT COUNT(*) as cnt FROM "Case"').get()?.cnt;
console.log(`✓ Final row count: ${finalCount}`);

db.close();
console.log("✓ Database saved");
