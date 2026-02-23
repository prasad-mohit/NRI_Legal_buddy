````markdown
# NRI Law Buddy – Concierge Control Room

Modern Next.js 16 + Tailwind portal that lets Non-Resident Indians authenticate, pick curated legal services, pay a flat platform fee, get Uber-style case manager + lawyer assignments, schedule secure video consults, track escrow milestones with Indian Bank, and manage a zero-trust document vault.

## ✨ Feature Highlights

- **Login + Persona gating** – captures name/email/country before entering the control room.
- **Service catalogue** – seven NRI-focused legal mandates with rich context and compliance notes.
- **Fee capture + Dispatch** – a $50 platform fee unlocks automatic case manager assignment.
- **Assignment desk** – mirrors Uber-style routing for case managers and curated practitioners.
- **Case timeline** – realtime, color-coded audit trail of every workflow event.
- **Escrow tracker** – milestone-based 60/40 release visual tied to Indian Bank partner.
- **Video scheduler** – suggests slots and confirms SecureMeet-style calls from inside the app.
- **Document vault** – AES-inspired vault with summaries, statuses, and mock uploads.
- **Guardrails & notifications** – trust messaging reminding clients not to negotiate fees outside the platform.

## 🧱 Tech Stack

- [Next.js 16 App Router](https://nextjs.org), React 19, TypeScript
- Tailwind CSS v4 for utility-first styling + custom theming
- Zustand state store orchestrating the entire concierge journey
- Lucide icons, date-fns helpers, Vitest for deterministic state tests

## 🗺️ Project Structure

```
src/
 ├─ app/               # Next.js app router entry points
 ├─ components/        # ClientPortal UI + sections
 ├─ lib/               # Service catalogue & data models
 └─ store/             # Zustand store + Vitest specs
docs/                  # Product requirements + notes
```

## ✅ Prerequisites

- **Node.js 20.5.x LTS** (tested on Optum-managed 20.5.1). No upgrade required.
- npm 9+ (ships with Optum Node build).

## 🚀 Run Locally

```bash
# NRI Law Buddy – Concierge Control Room

Modern Next.js App Router portal for NRI legal coordination. Clients authenticate, select a mandate, request the platform fee, receive admin approvals and assignments, schedule secure video consults, track escrow milestones, and manage a compliant document vault.

## ✨ Feature Highlights

- **Client + admin login** with role-aware routing.
- **Service catalogue** and compliance notes.
- **Payment approval workflow** before assignments and scheduling unlock.
- **Assignment desk** for case managers and practitioners.
- **Escrow milestones** and audit timeline.
- **Secure document vault** with metadata capture.
- **Admin console** for approvals, roster upload, and case oversight.

## 🧱 Tech Stack

- [Next.js 14 App Router](https://nextjs.org), React 18, TypeScript
- Tailwind CSS v4
- Zustand for client workflow state
- Prisma client with SQLite (raw SQL + SQL.js schema setup)
- Vitest for state tests

## �️ Project Structure

```
src/
 ├─ app/               # Next.js app router entry points
 ├─ components/        # Client portal UI + sections
 ├─ lib/               # Service catalogue & API client
 ├─ server/            # Raw SQL helpers
 └─ store/             # Zustand store + Vitest specs
docs/                  # Schema notes
scripts/               # SQL.js schema tooling
```

## ✅ Prerequisites

- **Node.js 20.x LTS**
- npm 9+

## 🚀 Installation

```bash
npm install
```

> **Note:** This repository does not include `package-lock.json` to ensure dependencies are installed from your local npm registry. Your first `npm install` will generate a fresh `package-lock.json` based on your environment.

### Database setup (required)

Set credentials for the first admin before seeding:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Strong#Pass123' npm run db:apply-schema
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Strong#Pass123' npm run db:seed-admin
```

### Run the app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## 🧪 Quality Gates

```bash
npm run lint
npm run test
```
