# NRI Law Buddy — Technical Architecture & Data Flow

> **Version:** 0.1.0 · **Date:** April 2026 · **Stack:** Next.js 14 / TypeScript / SQLite / Zustand

---

## 1. Executive Summary

NRI Law Buddy is a full-stack web application that connects overseas Indian (NRI) clients with lawyers and case managers for Indian legal services. It is a **two-portal system**:

| Portal | URL | Users |
|---|---|---|
| Client portal | `/` | NRI clients seeking legal help |
| Admin console | `/admin` | Admin staff, case managers, lawyers |

The platform manages the full case lifecycle: service selection → case submission → payment verification → legal team assignment → active case management (documents, meetings, escrow).

---

## 2. Tech Stack

### Core Framework
| Layer | Technology | Version |
|---|---|---|
| Full-stack framework | **Next.js** (App Router) | 14.2.5 |
| Language | **TypeScript** | 5.4+ |
| Runtime | **Node.js** | 20+ |
| React | **React** | 18.2 |

### UI & Styling
| Layer | Technology | Notes |
|---|---|---|
| CSS framework | **Tailwind CSS v4** | PostCSS plugin, no config file needed |
| Component library | Custom components | `clsx` for conditional classes |
| Icons | **Lucide React** | 0.562 |
| Date utilities | **date-fns** | 4.x |

### State Management
| Layer | Technology | Notes |
|---|---|---|
| Client state | **Zustand** | 5.x — single store `usePortalStore` |
| Server state | REST API + `fetch` | No React Query; manual refresh |

### Database & ORM
| Layer | Technology | Notes |
|---|---|---|
| Database | **SQLite** (via Prisma) | `prisma/dev.db` — single file |
| ORM | **Prisma Client** | 5.22 — used for typed queries |
| Raw SQL | `prisma.$queryRaw` / `$executeRaw` | Used for tables not in Prisma schema |
| Schema management | Custom migrations | `ensureCaseSchema()` / `ensureRuntimeSchema()` in `src/server/storage.ts` / `runtime-schema.ts` |
| Schema seeding | `sql.js` | `scripts/apply-schema.mjs`, `scripts/seed-admin.mjs` |

### Auth & Security
| Feature | Approach |
|---|---|
| Password hashing | PBKDF2-SHA512, 120,000 iterations, 16-byte random salt |
| Session tokens | `{sessionId}.{randomToken}` cookie; token stored as SHA-256 hash in DB |
| Session expiry | 14 days; auto-renewed if > 24 h before expiry |
| OTP signup | 6-digit CSPRNG OTP, 10-minute TTL, SHA-256 hashed in DB |
| Password reset | Same OTP pattern on `PasswordResetOtp` table |
| Rate limiting | `AuthRateLimit` table — per-bucket sliding window, blocklist with `blockedUntil` |
| Role guards | `authorize()`, `checkRole()`, `checkCaseState()`, `checkStageState()` |
| Roles | `client`, `lawyer`, `admin`, `super-admin` |
| Admin impersonation | Sessions can carry `actingAsRole` / `actingAsEmail` |
| Middleware | Request logging, `Cache-Control` headers per route pattern |

### Video Meetings
| Feature | Technology |
|---|---|
| Provider | **Jitsi Meet** (public `meet.jit.si` or self-hosted) |
| Integration | Iframe embed — no proprietary SDK |
| Room naming | Deterministic: `nri-{caseId}-{meetingId}` |
| Join URL | `{JITSI_BASE_URL}/{roomName}` |
| Window | 1 hour before → 12 hours after scheduled time |

### Email
| Feature | Technology |
|---|---|
| SMTP transport | Pure Node.js `node:net` + `node:tls` — zero external dependencies |
| TLS modes | STARTTLS (port 587) or implicit TLS (port 465) |
| Compatible with | AWS SES SMTP, SendGrid, Mailgun SMTP |
| Dev mode | Silently skips if `SES_SMTP_HOST` env var not set; OTP logged to console |

### Testing
| Tool | Version | Usage |
|---|---|---|
| **Vitest** | 1.6 | Unit tests for Zustand store |
| Test files | `src/store/*.test.ts` | 5 tests, 2 test files |

---

## 3. Project Structure

```
nri-law-buddy/
├── core/
│   └── stateMachine.js         # Centralised case + stage state machine (plain JS for dual import)
├── docs/
│   ├── schema.sql               # Reference SQL schema
│   └── architecture.md          # This document
├── prisma/
│   ├── schema.prisma            # Prisma schema (User, Case, VaultDocument…)
│   └── dev.db                   # SQLite database file
├── public/                      # Static assets
├── scripts/
│   ├── apply-schema.mjs         # Recreate DB from docs/schema.sql using sql.js
│   ├── seed-admin.mjs           # Create/replace admin user from env vars
│   └── remove-check-constraints.mjs  # One-time migration: remove CHECK from Case table
└── src/
    ├── middleware.ts             # Next.js middleware: request IDs, cache headers
    ├── app/
    │   ├── layout.tsx           # Root layout
    │   ├── page.tsx             # Client portal entry point → <ClientPortal />
    │   ├── admin/page.tsx       # Admin console (single-page, all state in React)
    │   ├── blog/                # Public blog pages
    │   ├── meeting/             # Meeting room page (Jitsi iframe)
    │   └── api/                 # All API routes (see §5)
    ├── components/
    │   └── client-portal.tsx    # Full client portal UI (~1200 LOC)
    ├── core/                    # (symlinked to /core root)
    ├── lib/
    │   ├── api-client.ts        # Typed fetch wrappers for the client store
    │   ├── services.ts          # Legal service catalogue (7 services)
    │   └── razorpay-checkout.ts # Razorpay JS SDK loader (future/optional)
    ├── server/                  # Server-only modules
    │   ├── admin.ts             # Admin user CRUD + password verification
    │   ├── audit-log.ts         # AuditLog table write/read
    │   ├── auth.ts              # Password hashing/verification, email validation
    │   ├── backup-export.ts     # Full data export
    │   ├── blogs.ts             # Blog CRUD
    │   ├── db.ts                # Prisma client singleton
    │   ├── guards.ts            # checkRole, checkCaseState, checkStageState
    │   ├── logger.ts            # Structured JSON logger
    │   ├── mailer.ts            # SMTP mailer (Node.js built-ins only)
    │   ├── meetings.ts          # Meeting read helpers
    │   ├── monitoring.ts        # Health + metrics snapshot
    │   ├── otp.ts               # OTP create/verify for signup + reset
    │   ├── password-reset.ts    # Password reset flow
    │   ├── payments.ts          # Razorpay order/verify helpers
    │   ├── rate-limit.ts        # Sliding-window rate limiter
    │   ├── request-meta.ts      # IP + User-Agent extraction
    │   ├── route-auth.ts        # authorize() — session verification middleware
    │   ├── runtime-schema.ts    # CREATE TABLE IF NOT EXISTS for all non-Prisma tables
    │   ├── session.ts           # Session create/resolve/revoke + cookies
    │   ├── sql-rows.ts          # Raw SQL query helper
    │   ├── storage.ts           # Core case CRUD + document + video + escrow
    │   ├── tickets.ts           # Support ticket CRUD
    │   ├── types.ts             # Shared TypeScript interfaces
    │   ├── users.ts             # Client user CRUD
    │   └── videoMeetings.ts     # Jitsi meeting creation + join token
    └── store/
        ├── usePortalStore.ts    # Zustand store — full client journey state
        ├── usePortalStore.test.ts
        └── usePortalStore.payment.test.ts
```

---

## 4. Database Schema

SQLite is used with two parallel schema management systems:

1. **Prisma schema** (`prisma/schema.prisma`) — defines `User`, `Case`, `VaultDocument`, `VideoReservation`
2. **Runtime migrations** (`src/server/runtime-schema.ts`) — creates all additional tables via `CREATE TABLE IF NOT EXISTS` on first request

### Tables

| Table | Manager | Purpose |
|---|---|---|
| `User` | Prisma | Client accounts (fullName, email, country, passwordHash, role) |
| `AdminUser` | Prisma | Admin/staff accounts (separate from User) |
| `Case` | Prisma + runtime | Core case record (caseStatus, stageStatus, timeline, escrow…) |
| `VaultDocument` | Prisma | Uploaded documents (name, type, status, accessList) |
| `VideoReservation` | Prisma | Jitsi meeting slots (scheduledAt, link) |
| `EmailOtp` | Runtime | Signup OTPs (hashed, 10-min TTL) |
| `PasswordResetOtp` | Runtime | Password reset OTPs |
| `Session` | Runtime | Auth sessions (tokenHash, expiresAt, revokedAt) |
| `CaseManager` | Runtime | Roster of case managers |
| `Practitioner` | Runtime | Roster of lawyers/practitioners |
| `Meeting` | Runtime | Full Jitsi meeting records (roomName, link, provider) |
| `MeetingAttendeeSession` | Runtime | Scoped join tokens per attendee |
| `AuditLog` | Runtime | Immutable audit trail |
| `AuthRateLimit` | Runtime | Per-bucket rate limit windows |
| `SupportTicket` | Runtime | Client support tickets |
| `Blog` | Runtime | Blog posts (slug, published) |

### Case State Machine

Defined in `core/stateMachine.js` — plain JS for import from both TS server and JS scripts.

```
CaseStatus transitions:
  SUBMITTED ──────────────────────────────────────────► AWAITING_ASSIGNMENT
       │                                                        │
       ▼                                                        │
  UNDER_REVIEW ────► AWAITING_CLIENT_APPROVAL ─► PAYMENT_PENDING
       │                      │                        │
       │                      ▼                        ▼
       └──────────────────────────────────► AWAITING_ASSIGNMENT ──► IN_PROGRESS ──► CLOSED

StageStatus transitions:
  PENDING ──► AWAITING_PAYMENT ──► PAYMENT_SUBMITTED ──► PAID ──► IN_PROGRESS ──► COMPLETE
```

The `AWAITING_ASSIGNMENT` status is the pivot point: payment approved, but legal team not yet assigned.

---

## 5. API Routes

All routes live under `src/app/api/`. Every route uses `authorize()` for session verification.

### Auth (`/api/auth/`)
| Route | Method | Description |
|---|---|---|
| `/auth/signup` | POST | Step 1: validate, hash password, create OTP, send email |
| `/auth/signup/start` | POST | Alias: start signup |
| `/auth/signup/verify` | POST | Step 2: verify OTP, create User + Session |
| `/auth/login` | POST | OTP-based login (or password login) |
| `/auth/logout` | POST | Revoke session cookie |
| `/auth/reset/start` | POST | Create password-reset OTP |
| `/auth/reset/verify` | POST | Verify OTP + set new password |
| `/auth/session` | GET | Return current session user info |

### Cases (`/api/cases/`)
| Route | Method | Description |
|---|---|---|
| `/cases` | GET | List cases for authed user |
| `/cases` | POST | Create new case |
| `/cases/[caseId]` | GET | Get single case (auth + ownership check) |
| `/cases/[caseId]` | PATCH | Update case: document upload, payment proof, video slot, escrow advance, bank instructions |

### Video (`/api/video/`)
| Route | Method | Description |
|---|---|---|
| `/video/create` | POST | Create Jitsi meeting for a case (admin/lawyer only) |
| `/video/join` | GET | Get join URL + validate time window |
| `/video/join` | DELETE | Revoke meeting attendee session |

### Meetings (`/api/meetings/`)
| Route | Method | Description |
|---|---|---|
| `/meetings` | GET | List meetings for authed user |
| `/meetings` | POST | Create meeting (alias for video/create) |

### Payments (`/api/payments/`)
| Route | Method | Description |
|---|---|---|
| `/payments/razorpay/verify` | POST | Verify Razorpay HMAC signature (future — currently mock) |

### Tickets (`/api/tickets/`)
| Route | Method | Description |
|---|---|---|
| `/tickets` | GET | List tickets for authed user |
| `/tickets` | POST | Create support ticket |

### Admin (`/api/admin/`)
| Route | Method | Description |
|---|---|---|
| `/admin/auth/login` | POST | Admin login → returns session cookie |
| `/admin/auth/impersonate` | POST | Super-admin impersonation of a user |
| `/admin/cases` | GET | All cases with full join (paymentProofs, caseManagerMeta…) |
| `/admin/cases/[caseId]/payment-instructions` | POST | Set bank instructions shown to client |
| `/admin/clients` | GET | All registered client users |
| `/admin/documents` | GET | All vault documents |
| `/admin/videos` | GET | All video reservations |
| `/admin/sessions` | GET / POST | List sessions; revoke by ID |
| `/admin/users` | GET / POST | Admin user management |
| `/admin/roster` | GET / POST | Get or update CaseManager + Practitioner roster |
| `/admin/roster/seed` | POST | Seed default 3 managers + 3 lawyers |
| `/admin/assignments` | POST | Assign case manager + lawyer to a case → moves to IN_PROGRESS |
| `/admin/payments/approve` | POST | Approve payment → moves caseStatus to AWAITING_ASSIGNMENT |
| `/admin/monitoring` | GET | System health + metrics snapshot |
| `/admin/export` | GET | Full data export (backup) |
| `/admin/blogs` | GET / POST | Blog CRUD |
| `/admin/tickets` | GET / POST | Admin view of support tickets |

---

## 6. Client Portal — UI Architecture

File: `src/components/client-portal.tsx`

```
<ClientPortal>           ← checks auth, redirects admins to /admin
  <LandingPage />        ← unauthenticated: marketing + login/signup modal
  <PortalShell>          ← authenticated shell (sidebar + main)
    <DashboardView />    ← checklist, banners, assignments, timeline
    <ServiceCatalog />   ← 3-step funnel: pick service → brief+docs → submit
    <CaseView />         ← payment proof, status banner, timeline, assignments
    <DocumentVault />    ← document list + upload (locked until lawyer assigned)
    <VideoScheduler />   ← Jitsi meeting schedule (locked until lawyer assigned)
    <EscrowTracker />    ← milestone unlock (locked until lawyer assigned)
  </PortalShell>
</ClientPortal>
```

**Feature lock:** All tabs except Dashboard, Services, and My Case are locked behind `lawyerActivated = Boolean(assignedPractitioner)`.

**Status display:** A single `caseStatusDisplay(caseStatus)` function maps raw `caseStatus` enum values to human-readable labels + colors. No raw enum strings are shown to users.

---

## 7. Admin Console — UI Architecture

File: `src/app/admin/page.tsx`

Single-page React app. All state in `useState`. On login, loads all data in parallel via `loadAll()`.

```
AdminConsole
  ├── Login screen          ← POST /api/admin/auth/login
  └── Authenticated console
        ├── Sidebar nav (9 tabs)
        ├── Dashboard         ← summary cards, recent cases, upcoming meetings
        ├── Cases             ← tabbed by caseStatus (SUBMITTED / PAYMENT_PENDING /
        │                        AWAITING_ASSIGNMENT / IN_PROGRESS / CLOSED)
        │     └── Case card
        │           ├── Status badge (from getCaseStatusConfig())
        │           ├── Payment proofs + Verify & approve button
        │           ├── Bank instructions editor
        │           └── Assignment dropdowns (unlocked after payment approved)
        ├── Clients           ← registered users
        ├── Roster            ← manage case managers + practitioners
        ├── Sessions          ← active/all sessions, revoke
        ├── Admin Users       ← create admin accounts
        ├── Blogs             ← blog post management
        ├── Documents         ← all vault documents
        └── Meetings          ← all video reservations
```

---

## 8. Zustand Store — State Machine

File: `src/store/usePortalStore.ts`

The store is the client-side state machine. On load it calls `syncCases()` or `refreshCaseStatus()` to hydrate from the server.

### Key state fields
| Field | Type | Description |
|---|---|---|
| `user` | `ClientProfile` | Authenticated user details |
| `stage` | `JourneyStage` | UI navigation stage (service-selection → payment-pending → lawyer-assigned…) |
| `caseId` | `string` | Active case ID |
| `caseStatus` | `CaseStatus` | Server-authoritative case status |
| `paymentStatus` | `pending \| approved` | Server-authoritative payment status |
| `platformFeePaid` | `boolean` | true when admin has approved payment |
| `paymentCaptured` | `boolean` | true when client has submitted proof |
| `assignedCaseManager` | object | Set by admin on assignment |
| `assignedPractitioner` | object | Set by admin; triggers all feature unlocks |
| `documents` | array | In-memory document list |
| `escrowMilestones` | array | Escrow unlock states |
| `timeline` | array | Chronological case events |

### Key actions
| Action | Description |
|---|---|
| `loginUser` | Set user profile (from OTP verify) |
| `hydrateAuthSession` | Load session from `/api/auth/session` on page load |
| `syncCases` | Fetch all cases for user, ingest the most recent |
| `refreshCaseStatus` | Fetch single case by `caseId`, update all fields |
| `ingestCaseRecord` | Normalise and apply a server case record to store |
| `selectService` | Pick a legal service |
| `capturePlatformFee` | Create case on server (no Razorpay) → stage = payment-pending |
| `submitPaymentProof` | PATCH case with proof → server stores in `paymentProofs` JSON |
| `scheduleVideoCall` | Create Jitsi meeting (requires `assignedPractitioner`) |
| `addDocument` | PATCH case with document (any non-closed status) |
| `advanceEscrow` | Unlock next escrow milestone (requires `assignedPractitioner`) |

---

## 9. End-to-End Data Flow

### 9.1 Client Signup
```
Browser                     Next.js API                   SQLite
  │                              │                            │
  ├─POST /api/auth/signup/start─►│                            │
  │   {email, password, name}    ├─hashPassword()─────────────┤
  │                              ├─createSignupOtp()──────────►│ INSERT EmailOtp
  │                              ├─sendSmtp(otp)──────────────►│ (SMTP or console)
  │◄─200 {otpId}─────────────────┤                            │
  │                              │                            │
  ├─POST /api/auth/signup/verify►│                            │
  │   {otpId, otp}               ├─verifyOtp()────────────────►│ SELECT EmailOtp
  │                              ├─createUser()───────────────►│ INSERT User
  │                              ├─createSession()────────────►│ INSERT Session
  │◄─200 + Set-Cookie────────────┤                            │
```

### 9.2 Case Submission (Client)
```
Browser (Zustand)           Next.js API                   SQLite
  │                              │                            │
  ├─capturePlatformFee()─────────┤                            │
  ├─POST /api/cases─────────────►│                            │
  │ {user, serviceId, stage,     ├─authorize()────────────────►│ SELECT Session
  │  caseStatus:SUBMITTED}       ├─createCase()───────────────►│ INSERT Case
  │◄─200 {caseId}────────────────┤                            │
  │                              │                            │
  │  (stage = "payment-pending") │                            │
  │                              │                            │
  ├─submitPaymentProof()─────────┤                            │
  ├─PATCH /api/cases/:id────────►│                            │
  │ {paymentProof:{url,note}}    ├─authorize()───────────────►│ SELECT Session
  │                              ├─checkCaseState()──────────►│ SELECT Case
  │                              ├─updateCase() ─────────────►│ UPDATE Case
  │◄─200 {case}──────────────────┤  (paymentProofs JSON,       │
  │                              │   stageStatus=PAYMENT_SUBMITTED)
```

### 9.3 Admin Payment Approval
```
Admin Browser               Next.js API                   SQLite
  │                              │                            │
  ├─POST /api/admin/payments/approve                          │
  │  {caseId}                    ├─authorize() ──────────────►│ SELECT Session
  │                              ├─checkRole(admin/super-admin)
  │                              ├─checkCaseState()──────────►│ SELECT Case
  │                              ├─checkStageState()──────────┤
  │                              ├─validateCaseTransition()   │
  │                              ├─prisma.case.update()──────►│ UPDATE Case
  │                              │  caseStatus=AWAITING_ASSIGNMENT
  │                              │  stageStatus=PAID
  │                              │  paymentStatus=approved
  │                              │  platformFeePaid=true
  │                              ├─logAction(payment.approved)►│ INSERT AuditLog
  │◄─200 {case}──────────────────┤                            │
  │  (case card moves to         │                            │
  │   AWAITING_ASSIGNMENT tab)   │                            │
```

### 9.4 Legal Team Assignment
```
Admin Browser               Next.js API                   SQLite
  │                              │                            │
  ├─POST /api/admin/assignments  │                            │
  │  {caseId, caseManager,       ├─authorize()───────────────►│ SELECT Session
  │   practitioner}              ├─checkRole()                │
  │                              ├─SELECT CaseManager────────►│
  │                              ├─SELECT Practitioner────────┤
  │                              ├─prisma.case.update()──────►│ UPDATE Case
  │                              │  caseStatus=IN_PROGRESS     │
  │                              │  stage=lawyer-assigned      │
  │                              │  caseManagerMeta=JSON       │
  │                              │  practitionerMeta=JSON      │
  │◄─200 {case}──────────────────┤                            │
  │                              │                            │
Client Browser (next poll)        │                            │
  ├─refreshCaseStatus()──────────► GET /api/cases/:id────────►│ SELECT Case
  │◄─assignedPractitioner set────┤                            │
  │  All tabs unlock             │                            │
```

### 9.5 Video Meeting (Post-Assignment)
```
Browser (Zustand)           Next.js API (video/create)   SQLite
  │                              │                            │
  ├─scheduleVideoCall(slot)──────┤                            │
  ├─POST /api/video/create──────►│                            │
  │  {caseId, scheduledAt}       ├─authorize()───────────────►│ SELECT Session
  │                              ├─getCase()─────────────────►│ SELECT Case
  │                              ├─generateRoomName()         │
  │                              │  = nri-{caseId}-{uuid}     │
  │                              ├─INSERT Meeting────────────►│
  │                              ├─INSERT VideoReservation───►│
  │                              ├─updateCase(timeline)──────►│ UPDATE Case
  │◄─200 {meeting:{id,link,..}}──┤                            │
  │                              │                            │
  ├─GET /api/video/join?id=──────►│           (at meeting time)│
  │                              ├─validateTimeWindow()       │
  │                              ├─INSERT MeetingAttendeeSession►│
  │◄─200 {joinUrl}───────────────┤                            │
  │  (iframe src = joinUrl)      │                            │
```

---

## 10. Security Architecture

### Authentication
- **Clients** use OTP-based auth (email OTP → session cookie)
- **Admins** use password auth (PBKDF2 hash → session cookie)
- Sessions stored as hashed tokens — raw token never persisted
- Cookie: `HttpOnly`, `SameSite=Strict`, `Secure` (production), 14-day expiry
- Timing-safe comparison on all password + token verification paths

### Authorisation
```
Request → middleware (log + cache headers)
        → authorize(roles[]) — verifies session cookie
        → checkRole() — role must be in allowed list
        → checkCaseState() — case must be in valid status
        → checkStageState() — stage must be in valid status
        → business logic
```

### Rate Limiting
- Login attempts: per-IP + per-email sliding window
- Signup OTPs: invalidates all previous OTPs for same email on new request
- `AuthRateLimit` table tracks attempts, window start, blocked-until timestamp

### Input Validation
- Passwords: min 10 chars, upper + lower + digit + special required
- Emails: regex + lowercase normalization
- Case transitions: validated by `validateCaseTransition()` / `validateStageTransition()` — throws on illegal moves
- API payloads: TypeScript + explicit null checks (no Zod/Joi, trusts internal callers)

### Data Access
- Documents: `accessList` field = comma-separated `userId,caseManagerId,practitionerId` — restricts who can access vault
- Meetings: `accessList` on `Meeting` table mirrors the same pattern
- Admin APIs: all require `admin` or `super-admin` role; client APIs enforce row-level ownership by email

### Audit Trail
- Every significant action writes to `AuditLog`: `actorEmail`, `actorRole`, `action`, `targetId`, `details`
- Actions tracked: `payment.approved`, `assignment.saved`, `document.uploaded`, `session.created`, etc.

---

## 11. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | No | Prisma database URL (defaults to `file:./dev.db`) |
| `SES_SMTP_HOST` | No | SMTP server hostname (email disabled if not set) |
| `SES_SMTP_PORT` | No | SMTP port (default 587) |
| `SES_USER` | No | SMTP username |
| `SES_PASS` | No | SMTP password |
| `EMAIL_FROM` | No | Sender email address |
| `JITSI_BASE_URL` | No | Jitsi server base URL (default: `https://meet.jit.si`) |
| `APP_BASE_URL` | No | Public app URL (for meeting join links) |
| `NEXT_PUBLIC_API_BASE_URL` | No | API base URL for client-side fetch |
| `ADMIN_EMAIL` | Seed only | Email for admin seeding script |
| `ADMIN_PASSWORD` | Seed only | Password for admin seeding script |
| `ADMIN_NAME` | Seed only | Display name for admin seeding script |

---

## 12. Deployment Considerations

### Current State (Local Dev)
- SQLite single file: simple, zero config, not suitable for multi-process production
- No object storage: documents are metadata-only (names, types, status) — no file bytes stored
- No queue/background jobs: all operations are synchronous request/response

### Production Migration Path
1. **Database:** Replace SQLite with PostgreSQL by updating `prisma/schema.prisma` provider and running `prisma migrate deploy`
2. **File storage:** Add S3/R2 for actual document binary upload; store URL in `VaultDocument.summary` or add a `url` field
3. **Session store:** Current DB sessions are fine for moderate scale; add Redis cache if needed
4. **Email:** Set `SES_SMTP_*` env vars for AWS SES (or any SMTP)
5. **Video:** Set `JITSI_BASE_URL` to a self-hosted Jitsi server for privacy
6. **Scaling:** Stateless Next.js servers can be horizontally scaled; SQLite must be replaced first

---

## 13. Legal Services Catalogue

7 services defined in `src/lib/services.ts`:

| ID | Label | Turnaround |
|---|---|---|
| `property-dispute` | Property Dispute Resolution | 2–4 weeks initial assessment |
| `investment-compliance` | Investments & FEMA Compliance | 5–7 business days |
| `nri-adoption` | NRI Adoption Facilitation | 8–16 weeks |
| `parental-abduction` | International Parental Abduction | Emergency priority |
| `marriage-desertion` | Marriage Desertion & Maintenance | 3–6 weeks initial |
| `will-probate` | Will Drafting & Probate | 2–3 weeks |
| `succession-certificate` | Succession Certificate | 4–8 weeks |

---

## 14. Test Coverage

| File | Tests | Coverage |
|---|---|---|
| `usePortalStore.test.ts` | 2 | Full journey flow + reset |
| `usePortalStore.payment.test.ts` | 3 | Case creation, idempotency, payment proof submission |

Run tests: `npm test` (Vitest)

---

*Document auto-generated from codebase analysis. Last updated: April 2026.*
