import prisma from "@/server/db";
import { queryRowsUnsafe } from "@/server/sql-rows";

let ensured = false;

interface PragmaTableInfoRow {
  name: string;
}

const hasColumn = async (table: string, column: string) => {
  const rows = await queryRowsUnsafe<PragmaTableInfoRow>(`PRAGMA table_info("${table}")`);
  return rows.some((row) => row.name === column);
};

const isDuplicateColumnError = (error: unknown) => {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return message.includes("duplicate column name");
};

const ensureColumn = async (table: string, column: string, sqlType: string) => {
  const exists = await hasColumn(table, column);
  if (exists) return;

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${column} ${sqlType}`);
  } catch (error) {
    if (!isDuplicateColumnError(error)) {
      throw error;
    }
  }
};

export const ensureRuntimeSchema = async () => {
  if (ensured) return;

  await ensureColumn("User", "role", "TEXT NOT NULL DEFAULT 'client'");
  await ensureColumn("User", "isEmailVerified", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("User", "signupFeePaid", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("Meeting", "chimeMeetingId", "TEXT");
  await ensureColumn("Meeting", "chimeExternalMeetingId", "TEXT");
  await ensureColumn("Meeting", "mediaRegion", "TEXT");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS EmailOtp (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      fullName TEXT NOT NULL,
      country TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      otpHash TEXT NOT NULL,
      expiresAt DATETIME NOT NULL,
      consumedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS PasswordResetOtp (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      otpHash TEXT NOT NULL,
      expiresAt DATETIME NOT NULL,
      consumedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Session (
      id TEXT PRIMARY KEY NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      subjectId TEXT NOT NULL,
      subjectEmail TEXT NOT NULL,
      role TEXT NOT NULL,
      actingAsRole TEXT,
      actingAsEmail TEXT,
      userAgent TEXT,
      ipAddress TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expiresAt DATETIME NOT NULL,
      revokedAt DATETIME
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS SupportTicket (
      id TEXT PRIMARY KEY NOT NULL,
      caseId TEXT,
      email TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Meeting (
      id TEXT PRIMARY KEY NOT NULL,
      caseId TEXT NOT NULL,
      scheduledAt TEXT NOT NULL,
      link TEXT NOT NULL,
      provider TEXT NOT NULL,
      createdByEmail TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS AuditLog (
      id TEXT PRIMARY KEY NOT NULL,
      actorEmail TEXT NOT NULL,
      actorRole TEXT NOT NULL,
      action TEXT NOT NULL,
      targetType TEXT NOT NULL,
      targetId TEXT NOT NULL,
      details TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS AuthRateLimit (
      id TEXT PRIMARY KEY NOT NULL,
      bucket TEXT NOT NULL,
      subjectHash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      windowStart DATETIME NOT NULL,
      blockedUntil DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MeetingAttendeeSession (
      id TEXT PRIMARY KEY NOT NULL,
      meetingId TEXT NOT NULL,
      caseId TEXT NOT NULL,
      attendeeId TEXT NOT NULL,
      externalUserId TEXT NOT NULL,
      userEmail TEXT NOT NULL,
      userRole TEXT NOT NULL,
      issuedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expiresAt DATETIME NOT NULL,
      revokedAt DATETIME
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_email_otp_email
    ON EmailOtp(email, createdAt DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_otp_email
    ON PasswordResetOtp(email, createdAt DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_bucket
    ON AuthRateLimit(bucket)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_support_ticket_email
    ON SupportTicket(email)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_support_ticket_status
    ON SupportTicket(status)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_support_ticket_case
    ON SupportTicket(caseId)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_meeting_case
    ON Meeting(caseId, createdAt DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_meeting_provider
    ON Meeting(provider, createdAt DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_created
    ON AuditLog(createdAt DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor
    ON AuditLog(actorEmail, createdAt DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_session_subject_email
    ON Session(subjectEmail)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_session_expires_at
    ON Session(expiresAt)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_meeting_attendee_meeting
    ON MeetingAttendeeSession(meetingId, userEmail, issuedAt DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_meeting_attendee_expires
    ON MeetingAttendeeSession(expiresAt)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Blog (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      authorEmail TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_blog_slug
    ON Blog(slug)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_blog_published
    ON Blog(published, createdAt DESC)
  `);

  ensured = true;
};


