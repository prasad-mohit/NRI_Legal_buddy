-- NRI Law Buddy SQLite schema (Prisma-aligned)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY NOT NULL,
  fullName TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  isEmailVerified INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS AdminUser (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL,
  role TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Case" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  serviceId TEXT NOT NULL,
  stage TEXT NOT NULL,
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
  escrowMilestones TEXT NOT NULL,
  timeline TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CaseManager (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  specialization TEXT NOT NULL,
  weeklyLoad INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Practitioner (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  bar TEXT NOT NULL,
  focus TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS VaultDocument (
  id TEXT PRIMARY KEY NOT NULL,
  caseId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  uploadedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caseId) REFERENCES "Case"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS VideoReservation (
  id TEXT PRIMARY KEY NOT NULL,
  caseId TEXT NOT NULL,
  scheduledAt TEXT NOT NULL,
  link TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caseId) REFERENCES "Case"(id) ON DELETE CASCADE
);

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
);

CREATE TABLE IF NOT EXISTS PasswordResetOtp (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  otpHash TEXT NOT NULL,
  expiresAt DATETIME NOT NULL,
  consumedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS SupportTicket (
  id TEXT PRIMARY KEY NOT NULL,
  caseId TEXT,
  email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Meeting (
  id TEXT PRIMARY KEY NOT NULL,
  caseId TEXT NOT NULL,
  scheduledAt TEXT NOT NULL,
  link TEXT NOT NULL,
  provider TEXT NOT NULL,
  createdByEmail TEXT NOT NULL,
  chimeMeetingId TEXT,
  chimeExternalMeetingId TEXT,
  mediaRegion TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY NOT NULL,
  actorEmail TEXT NOT NULL,
  actorRole TEXT NOT NULL,
  action TEXT NOT NULL,
  targetType TEXT NOT NULL,
  targetId TEXT NOT NULL,
  details TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS AuthRateLimit (
  id TEXT PRIMARY KEY NOT NULL,
  bucket TEXT NOT NULL,
  subjectHash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  windowStart DATETIME NOT NULL,
  blockedUntil DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_userId ON "Case"(userId);
CREATE INDEX IF NOT EXISTS idx_document_caseId ON VaultDocument(caseId);
CREATE INDEX IF NOT EXISTS idx_video_caseId ON VideoReservation(caseId);
CREATE INDEX IF NOT EXISTS idx_email_otp_email ON EmailOtp(email, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_otp_email ON PasswordResetOtp(email, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_bucket ON AuthRateLimit(bucket);
CREATE INDEX IF NOT EXISTS idx_support_ticket_email ON SupportTicket(email);
CREATE INDEX IF NOT EXISTS idx_support_ticket_status ON SupportTicket(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_case ON SupportTicket(caseId);
CREATE INDEX IF NOT EXISTS idx_meeting_case ON Meeting(caseId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_provider ON Meeting(provider, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON AuditLog(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON AuditLog(actorEmail, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_session_subject_email ON Session(subjectEmail);
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON Session(expiresAt);
CREATE INDEX IF NOT EXISTS idx_meeting_attendee_meeting ON MeetingAttendeeSession(meetingId, userEmail, issuedAt DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_attendee_expires ON MeetingAttendeeSession(expiresAt);

CREATE TRIGGER IF NOT EXISTS trg_case_updatedAt
AFTER UPDATE ON "Case"
FOR EACH ROW
BEGIN
  UPDATE "Case" SET updatedAt = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
