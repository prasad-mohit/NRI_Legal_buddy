# Local Execution Assessment (Node 20.5.1)

| Area | Current State | Gap for "full working app" | Local-first option |
| --- | --- | --- | --- |
| Authentication | Client-only mock login (Zustand) | No persistence or session hand-off | Keep mock login but persist the session via API cookies/object store |
| Service selection & case creation | Store-only timeline | Cannot be shared across devices or after refresh | Add `/api/cases` endpoint with in-memory store for dev; swap to DB remotely |
| Platform fee & escrow | Pure UI logic | No payment intent, no ledger | Mock payment intent endpoint returning reference IDs |
| Case manager / practitioner | Randomized client-side | Not observable by ops team | Expose `/api/dispatch` to record assignment events |
| Video scheduling | Local state only | Needs scheduling + meeting links | Provide `/api/video` stub creating meeting tokens |
| Document vault uploads | Local placeholders | No storage, no share links | Accept uploads -> store metadata locally, fallback to S3 when deployed |
| Deployment | Next.js app only | Need server env toggles | Provide `.env.example`, Dockerfile, and remote API base toggles |

**Conclusion:** implement lightweight API routes (running in the same Next.js server) that emulate the future microservices. They keep the Optum Node 20.5.1 runtime happy, while providing a contract identical to what a remote deployment would expect.
