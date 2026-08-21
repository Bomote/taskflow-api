# TaskFlow API

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

> 🚧 Work in progress — Phase 2 (Validation & Error Handling) complete, Phase 3 (Authentication & Security Hardening) next.

## Live Demo

_Coming in Phase 6 — will link the deployed Render URL and `/api-docs` here._

## Tech Stack

- **Runtime/Language:** Node.js, TypeScript
- **Framework:** Express
- **Database:** MongoDB (Atlas), Mongoose
- **Validation:** Zod
- _(Coming later: JWT, Jest/Supertest, Swagger, Docker)_

## Endpoints

| Method | Path              | Description             | Auth Required |
|--------|-------------------|--------------------------|----------------|
| GET    | `/health`         | Health check             | No             |
| GET    | `/api/tasks`      | List all tasks           | No _(yet)_     |
| POST   | `/api/tasks`      | Create a new task        | No _(yet)_     |
| GET    | `/api/tasks/:id`  | Fetch a task by ID       | No _(yet)_     |
| PUT    | `/api/tasks/:id`  | Update a task by ID      | No _(yet)_     |
| DELETE | `/api/tasks/:id`  | Delete a task by ID      | No _(yet)_     |

_(Auth column will update once JWT protection lands in Phase 3.)_

## Response Shape

Every endpoint responds with one of two consistent shapes:
- Success: `{ "success": true, "data": ... }`
- Failure: `{ "success": false, "error": ..., ["details" | "message"]: ... }`

## How to Run Locally

1. Clone the repo and `cd` into it.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your own MongoDB Atlas connection string.
   - If you're on Windows and hit `ECONNREFUSED` on a DNS SRV lookup despite the connection string being correct, see **Known Issues** below.
4. Run the server:
   ```
   node --env-file=.env src/server.ts
   ```
5. Confirm it's up: `curl http://localhost:5000/health`

## Architecture

Request flow: **client → `server.ts` → (route-level `validateRequest` middleware, on write operations) → `taskRoutes.ts` → `taskController.ts` → `Task.ts` (Mongoose) → MongoDB**, with any thrown error diverted at any point to `errorHandler.ts` instead of continuing down the normal path. Each layer has one job and doesn't know how the others do theirs:

- **`config/db.ts`** — owns the entire database connection lifecycle: validates `MONGODB_URI` exists, connects via Mongoose, confirms the connection with a `ping` command, and guards against duplicate/concurrent connection attempts via `readyState`.
- **`models/Task.ts`** — defines the shape of a task document (fields, types, the `status` enum, the `userId` reference) — the single source of truth every other layer validates against.
- **`utils/validators.ts`** — Zod schemas describing valid input shape for creating and updating a task, plus `validateRequest(schema)`, a single generic middleware-builder that can validate any route's body against any Zod schema.
- **`middlewares/errorHandler.ts`** — the single place every error in the app eventually lands, responsible for turning a raised error into a consistent, safe JSON response — never a raw stack trace.
- **`controllers/taskController.ts`** — the business logic: one function per CRUD operation, each responsible for querying via Mongoose and shaping a response with the correct status code.
- **`routes/taskRoutes.ts`** — pure wiring: maps HTTP verb + relative path to `validateRequest` (where relevant) and a controller function, in sequence.
- **`server.ts`** — the assembly point: connects the DB first (refusing to start if that fails), registers middleware, mounts routers, registers `errorHandler` last, and only then starts listening.

## Design Decisions

- **`validateRequest` is one generic middleware, not one per route.** It takes a Zod schema as a parameter and returns a configured Express middleware function — meaning the same piece of code validates task creation, task updates, and (later) any other resource's input, just by being called with a different schema. Avoids duplicating near-identical validation middleware for every new route.
- **`updateTaskSchema` is derived from `createTaskSchema` via `.partial()`, not hand-duplicated.** A `PUT` request shouldn't have to resend every field just to change one — `.partial()` makes every field optional while reusing the exact same underlying rules (e.g. `title`'s minimum length still applies *if* provided). If a field is ever added to the create schema, the update schema inherits it automatically instead of silently drifting out of sync.
- **Validation errors are forwarded via `next(err)`, never handled inside `validateRequest` itself.** This keeps error *formatting* in exactly one place (`errorHandler.ts`) rather than letting each piece of middleware decide its own response shape — critical for keeping error responses consistent as the app grows.
- **`errorHandler` distinguishes Zod validation errors (400) from everything else (500), and never leaks a stack trace to the client.** A `ZodError` means the client sent bad input — that's a 400, with the specific validation issues returned so the client can fix its request. Anything else is treated as an unexpected server-side failure — logged server-side via `console.error` for debugging, but returned to the client as a generic message only, since the earlier default-Express behavior (seen during testing) leaked full file paths and internal stack traces in the response body.
- **`runValidators: true` on updates.** Mongoose doesn't re-run schema validation on `findByIdAndUpdate` by default — only on document creation. Without opting in explicitly, a `PUT` request could silently set `status` to a value outside the allowed enum, bypassing the schema's own constraint. Enabled deliberately to close that gap. (Zod now also independently enforces this at the request-validation layer, before Mongoose ever sees the data — defense in depth, not redundant: Zod catches it at the HTTP boundary, Mongoose catches it at the persistence boundary.)
- **Status codes split by failure type, not collapsed into one generic error.** `400` for client-caused bad input. `404` for a well-formed ID that simply doesn't match any document. `500` for unexpected server-side failures. Collapsing these into one code would hide information a real API consumer needs to handle errors correctly.
- **`userId` is optional for now.** Auth doesn't exist yet (Phase 3), so tasks currently have no real owner. `TODO`: make `userId` required once JWT auth is in place — an unowned task won't make sense in an authenticated app.

## Known Issues

- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups**, even when the OS itself resolves the same record correctly (confirmed via `nslookup`). Root cause not fully isolated — firewall/antivirus interference with Node's DNS layer is the leading suspicion, unconfirmed. **Workaround used in this project:** a non-SRV connection string (Atlas → Connect → Drivers → older driver version), which lists the shard hosts directly and avoids the SRV lookup entirely.

## Progress Log

- [x] Phase 1: Local setup, folder structure, database connection, core CRUD, health check — verified against a live MongoDB Atlas connection
- [x] Phase 2: Zod validation on create/update, centralized error handling — verified malformed requests return clean structured JSON, not a stack trace
- [ ] Phase 3: JWT auth, security hardening
- [ ] Phase 4: Testing (Jest/Supertest), Swagger/Postman docs
- [ ] Phase 5: Docker, GitHub Actions CI
- [ ] Phase 6: Deployment, uptime monitoring, seed script