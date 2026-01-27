# Deployment Roadmap

## Goals
1. **Local parity:** run everything inside the Next.js dev server on Node 20.5.1 with mocked integrations.
2. **Remote-ready:** isolate API contracts so that an external server (Node 20.11+/container) can swap in real services without changing the UI.
3. **Operational clarity:** document environment variables, seed data, and scripts for both modes.

## Components
- `App Router UI` (already present)
- `Case & Dispatch API` (new `/api/cases` route)
- `Video scheduling API` (new `/api/video` route)
- `Document vault API` (new `/api/vault` route storing local JSON files)
- `Escrow simulation` (progress endpoint that mimics release workflow)

## Action Plan
1. **Introduce local data layer:** `src/server/storage.ts` with in-memory + JSON-file persistence; uses `globalThis` to survive hot reloads.
2. **API contracts:**
   - `POST /api/cases` – create intake, returns `caseId` and assignment snapshot.
   - `PATCH /api/cases/:id` – advance stages, update escrow milestones.
   - `POST /api/video` – reserve SecureMeet slot and echo meeting link.
   - `POST /api/vault` – store metadata + base64 placeholder.
3. **Store integration:** update Zustand actions to call fetchers inside `src/lib/client.ts` so state stays in sync with API responses.
4. **Config toggles:** `.env.example` with `NEXT_PUBLIC_API_BASE_URL` + `DATA_DIR`; Dockerfile + `npm run dev:remote` stub.
5. **Docs:** README + `docs/local-limitations.md` updated with instructions.
