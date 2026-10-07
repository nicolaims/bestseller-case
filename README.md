# Recolour Request Tool

Internal tool for managing "recolour ticket" requests. A garment photo set gets a ticket, a Manager approves or rejects it, and an approved ticket is sent to an external colour partner and tracked through to completion.

Stack: Vue 3 (Vite, TypeScript, Pinia, Vue Router, Tailwind CSS) on the frontend, Express (TypeScript) on the backend. There's no database; everything is persisted to a JSON file on disk.

## Setup

Requires Node 18+.

```bash
npm install
npm run dev
```

This starts the Express API on `http://localhost:4000` and the Vite dev server on `http://localhost:5173` (it proxies `/api` and `/uploads` to the backend). Open `http://localhost:5173`.

On first boot, the server auto-seeds `server/data/db.json` from the 4 tickets in `recolour-case/Ticket 1-4`, copying their photos into `server/uploads/seed/`. To force a clean reseed at any point, run:

```bash
npm run seed
```

### Other scripts
- `npm run build`: type-checks and builds both workspaces.
- `npm run dev -w server` / `npm run dev -w client`: run one side only.

## Architecture

- **Monorepo.** npm workspaces split `server/` and `client/`. There's no shared package, so types are duplicated in `server/src/types` and `client/src/types`; the project is small enough that a shared package would add more ceremony than it saves.
- **Persistence.** A single `db.json` holds tickets, partners, and approved photos, read and written through `server/src/db/jsonDb.ts`. Writes go through an in-memory promise queue, because the partner-send simulation runs a `setTimeout` that reloads and mutates the file later and shouldn't be allowed to race a concurrent request.
- **Ticket status is a state machine**, defined in `server/src/services/ticketService.ts`: `Pending → Approved → Sent → In Progress → Completed`. A Manager reviews the whole ticket while it's `Pending`, before anything is sent to the partner. Rejecting it stamps a reason (`lastRejectionReason`) and bounces the ticket straight back to `Pending` rather than parking it in its own `Rejected` status. Invalid transitions return `409`.
- **Partner integration is simulated.** Clicking "Send to partner" flips the ticket to `Sent` and schedules a 5-second delayed flip to `In Progress`, standing in for an async webhook acknowledgement. "Simulate complete" is a manual button rather than a second timer, so the flow can be demoed on demand instead of waiting it out.
- **Roles aren't real auth.** There's no login. The frontend keeps the current role (`Operator` or `Manager`) in a Pinia store persisted to `localStorage` and sends it as an `x-role` header on every request. The server does still enforce it server-side: `approve` and `reject` return `403` without the `Manager` role, so the restriction isn't just a hidden button in the UI.
- **Approval is per ticket, not per colour.** A Manager approves or rejects the whole ticket in one decision, which creates a single `ApprovedPhoto` record and files the ticket into the Approved Library. Requested colours are just descriptive data (name, pantone, reference image) once approval has moved to the ticket level.
- **Who has a ticket is derived, not stored.** `client/src/utils/ticketOwnership.ts` maps a ticket's status (plus its partner receipt and any rejection reason) to an owner — `Operator`, `Manager`, `Partner`, or none — and a plain-English next step. That drives the owner badge shown wherever a ticket appears, and the quick-filter chips ("With: Manager", "With: Partner", …) on the Ticket Queue.
- **There's no real recolour rendering.** An approved ticket's `ApprovedPhoto` record is just an approval stamp (who, when); no image-generation step exists, so approval is a status and record change, not a pixel transformation.
- **File uploads** (new ticket photos, AOP reference swatches) go through `multer` into `server/uploads/tickets/`, capped at 25MB so catalogue-resolution JPEGs like the ones in the seed data fit comfortably.

## Assumptions

- "Photo ID" in the brief is modelled as `style_productNumber` (e.g. `15377489_5081878`), matching the naming convention of the provided mock files. A ticket covers one product's three angle shots (front, back, detail) plus however many colour variants were requested against it.
- Partners are a small fixed seed list with no partner CRUD UI, since the brief only asks to pick a partner on a ticket, not to manage partners.
- Dashboard KPIs are derived client-side from the already-fetched ticket list instead of a dedicated endpoint. That avoids having two sources of truth for the same counts.

## Out of scope, and what production would need instead

The brief didn't ask for these, and solving them properly here would add more ceremony than a PoC at this scale warrants. They're also the three gaps worth being upfront about if this were heading toward production.

### Authentication

Right now the "role" is just a header the client sets itself (`x-role: Manager`), which is trivially spoofable: anyone can send that header and act as a manager. A real deployment would need an actual identity layer, most likely OAuth2/OIDC against the company's existing identity provider if one exists, or a straightforward email-and-password flow otherwise. Either way, the server would issue a signed session cookie or JWT on login, resolve the user's role from a `users` record on every request, and never trust a role claim coming from the client. Session expiry and the ability to revoke a session (someone leaves the team, a token leaks) would need to exist too, which isn't a concern at all with the current header-based approach.

### Database

`db.json` is read and rewritten as a whole file per request. The write queue in `jsonDb.ts` only serializes the write step, not the full read-modify-write cycle, so two concurrent requests touching the same ticket could still silently clobber one of the updates. A production system would move this to Postgres (or similar), getting real transactions or row-level locking for concurrent ticket updates instead of racing on a file, proper indexes on status and partner for the queue's filters instead of scanning an array in memory, and migrations to manage schema changes as the data model evolves. Optimistic concurrency via a version column would be a reasonable middle ground if full transactions feel heavier than needed for a given write path.

### Partner integration

"Send to partner" today is a 5-second `setTimeout` sitting in server memory. If the server restarts during that window, the pending acknowledgement is gone and the ticket is stuck on `Sent` indefinitely, which is fine for a demo and not acceptable for anything real. A production integration would expose a webhook endpoint the partner calls back on, verify the callback with a signed payload (HMAC) before trusting it, and put outbound sends through retry-with-backoff and idempotency keys so a partner's own retry doesn't double-process a ticket. Routing the outbound send through a queue (SQS, BullMQ, or similar) rather than an in-process timer would also mean an in-flight send survives a restart instead of silently vanishing.

### Everything else left out

- **Real recolour rendering.** This tool models the *workflow* around a recolour request, not the colour-rendering step itself — there's no image-generation step anywhere.
- **Consistent role enforcement.** Only `approve` and `reject` check the `Manager` role server-side; `send`, `complete`, and `force-ack` have no role guard at all. A production system would apply the same check uniformly across every status-changing route once real auth is in place.
- **Shared types and fuller test coverage.** Types are duplicated between `server` and `client` instead of living in a shared workspace package, and the test suite covers the ticket state machine plus one client component rather than every controller, route, or an end-to-end flow.
