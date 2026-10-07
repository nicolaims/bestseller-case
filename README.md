# Recolour Request Tool

Internal tool for managing "recolour ticket" requests: create a ticket for a garment photo set, send it to an external colour partner, and approve or reject the result into an Approved Photos library.

Stack: Vue 3 (Vite, TypeScript, Pinia, Vue Router, Tailwind CSS) + Express (TypeScript). Data is persisted to a JSON file on disk, no database.

## Setup

Requires Node 18+.

```bash
npm install
npm run dev
```

This starts the Express API on `http://localhost:4000` and the Vite dev server on `http://localhost:5173` (proxies `/api` and `/uploads` to the backend). Open `http://localhost:5173`.

On first boot the server auto-seeds `server/data/db.json` from the 4 tickets in `recolour-case/Ticket 1-4`, copying their photos into `server/uploads/seed/`. To force a clean reseed at any point:

```bash
npm run seed
```

### Other scripts
- `npm run build` — type-checks and builds both workspaces.
- `npm run dev -w server` / `npm run dev -w client` — run one side only.

## Architecture

- **Monorepo**: npm workspaces (`server/`, `client/`), no shared package — types are duplicated in `server/src/types` and `client/src/types` since the project is small enough that a shared package would add more ceremony than it saves.
- **Persistence**: a single `db.json` (tickets, partners, approvedPhotos), read/written through `server/src/db/jsonDb.ts`. Writes go through an in-memory promise queue so the partner-send simulation (a `setTimeout` that reloads and mutates the file later) can't race a concurrent request and corrupt it.
- **Ticket status is a state machine** (`server/src/services/ticketService.ts`): `Pending → Sent → In Progress → Completed → Approved | Rejected`, with an explicit `Rejected → Pending` requeue step rather than an implicit auto-transition. Invalid transitions return `409`.
- **Partner integration is simulated**, not real: "Send to partner" flips the ticket to `Sent` and schedules a 5s delayed flip to `In Progress` (mimicking an async webhook ack). "Simulate complete" is a manual button rather than a second timer, so the flow can be demoed on demand instead of waiting.
- **Roles are not real auth** — there's no login. The frontend keeps the current role (`Operator` / `Manager`) in a Pinia store persisted to `localStorage`, and sends it as an `x-role` header on every request. The server still enforces it: `approve`/`reject` return `403` without the `Manager` role, so the rule isn't just a hidden button.
- **Approval is per colour variant**, not per ticket: each variant gets its own approve/reject decision (one `ApprovedPhoto` created per approved variant), and the ticket's overall status is derived from its variants — it stays `Completed` while any variant is still pending, and only becomes `Approved`/`Rejected` once every variant has a decision (`recomputeStatus` in `ticketService.ts`). This matches a ticket representing one photoshoot with multiple requested colours, where each colour can be accepted or sent back independently.
- **No real recolour rendering.** An approved photo's `imagePath` reuses the ticket's existing front photo (or the AOP reference swatch) — there's no image-generation step, so approval is modelled as a status/record change, not a pixel transformation.
- **File uploads** (new ticket photos, AOP reference swatches) go through `multer` to `server/uploads/tickets/`, limit 25MB to comfortably fit catalogue-resolution JPEGs like the ones in the seed data.

## Assumptions

- "Photo ID" in the brief is modelled as `style_productNumber` (e.g. `15377489_5081878`), matching the naming convention of the provided mock files; a ticket covers one product's three angle shots (front/back/detail) and however many colour variants were requested against it.
- Partners are a small fixed seed list (no partner CRUD UI) — the brief only asks to pick a partner on a ticket, not to manage partners.
- Dashboard KPIs are derived client-side from the already-fetched ticket list rather than a dedicated endpoint, to avoid two sources of truth for the same counts.

## Out of scope

Deliberately left out of this PoC — the brief didn't ask for them, and solving them properly would add more ceremony than this scale warrants:

- **Real authentication.** There's no login or session; the current role is a client-chosen `x-role` header, which is trivially spoofable (anyone can send `x-role: Manager`). Production would need real auth (session cookies or JWT) with the role resolved server-side from a verified identity, never trusted from the request.
- **A real database.** `db.json` is read and rewritten as a whole file per request. The write queue in `jsonDb.ts` only serializes the write step, not the full read-modify-write cycle, so two concurrent requests mutating the same ticket could still silently lose one of the updates. Production would use a database with transactions (or optimistic concurrency via a version field) and proper indexing for filtering/search instead of scanning an in-memory array.
- **Real partner integration.** "Send to partner" is a 5s `setTimeout` held in server memory; a restart during that window loses the pending acknowledgement and leaves the ticket stuck on `Sent` forever. Production would replace this with an actual webhook endpoint the partner calls back, with retry and idempotency handling.
- **Real recolour rendering.** Approving a variant reuses an existing photo or reference swatch as the "approved" image rather than generating a new one — this tool models the *workflow* around a recolour request, not the colour-rendering step itself.
- **Consistent role enforcement.** Only `approve`/`reject` check the `Manager` role server-side; `send`/`complete`/`requeue` have no role guard at all. A production system would apply the same check uniformly across all status-changing routes once real auth is in place.
- **Shared types / fuller test coverage.** Types are duplicated between `server` and `client` instead of a shared workspace package, and the test suite covers the ticket state machine plus one client component rather than every controller/route or an end-to-end flow.
