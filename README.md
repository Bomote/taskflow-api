# TaskFlow API

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

> Work in progress — Phase 1 (Core CRUD) complete, Phase 2 (Validation & Error Handling) next.

## Live Demo

_Coming in Phase 6 — will link the deployed Render URL and `/api-docs` here._

## Tech Stack

- **Runtime/Language:** Node.js, TypeScript
- **Framework:** Express
- **Database:** MongoDB (Atlas), Mongoose
- _(Coming later: Zod, JWT, Jest/Supertest, Swagger, Docker)_

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

Request flow: **client → `server.ts` → `taskRoutes.ts` → `taskController.ts` → `Task.ts` (Mongoose) → MongoDB**, with the response traveling back the same path. Each layer has one job and doesn't know how the others do theirs:

- **`config/db.ts`** — owns the entire database connection lifecycle: validates `MONGODB_URI` exists, connects via Mongoose, confirms the connection with a `ping` command, and guards against duplicate/concurrent connection attempts via `readyState`. No other file touches Mongoose's connection logic directly.
- **`models/Task.ts`** — defines the shape of a task document (fields, types, the `status` enum, the `userId` reference) — the single source of truth every other layer validates against.
- **`controllers/taskController.ts`** — the business logic: one function per CRUD operation, each responsible for reading the request, querying via Mongoose, and shaping a response with the correct status code.
- **`routes/taskRoutes.ts`** — pure wiring: maps HTTP verb + relative path to controller function. Deliberately has no knowledge of the `/api/tasks` prefix — that's assembled at mount time.
- **`server.ts`** — the assembly point: connects the DB first (refusing to start if that fails), registers middleware, mounts routers under their base paths, and only then starts listening.

## Design Decisions

- **`runValidators: true` on updates.** Mongoose doesn't re-run schema validation on `findByIdAndUpdate` by default — only on document creation. Without opting in explicitly, a `PUT` request could silently set `status` to a value outside the allowed enum, bypassing the schema's own constraint. Enabled deliberately to close that gap.
- **Status codes split by failure type, not collapsed into one generic error.** `400` for client-caused bad input (malformed ID, failed validation on create/update). `404` for a well-formed ID that simply doesn't match any document — a lookup miss, not a bad request. `500` for unexpected server-side failures (e.g. a database blip) that aren't the client's fault. Collapsing these into one code would hide information a real API consumer needs to handle errors correctly.
- **Errors are narrowed with `error instanceof Error` before being sent in a response.** `catch` blocks type `error` as `unknown` under TypeScript strict mode, and `Error` objects don't serialize their `message` through `JSON.stringify` by default — without this check, error responses would silently come back as an empty `{}`.
- **`userId` is optional for now.** Auth doesn't exist yet (Phase 3), so tasks currently have no real owner. `TODO`: make `userId` required once JWT auth is in place — an unowned task won't make sense in an authenticated app.

## Known Issues

- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups**, even when the OS itself resolves the same record correctly (confirmed via `nslookup`). Root cause not fully isolated — firewall/antivirus interference with Node's DNS layer is the leading suspicion, unconfirmed. **Workaround used in this project:** a non-SRV connection string (Atlas → Connect → Drivers → older driver version), which lists the shard hosts directly and avoids the SRV lookup entirely.

## Progress Log

- [x] Phase 1: Local setup, folder structure, database connection, core CRUD (`GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/:id`), health check — all verified against a live MongoDB Atlas connection
- [ ] Phase 2: Zod validation, centralized error handling
- [ ] Phase 3: JWT auth, security hardening
- [ ] Phase 4: Testing (Jest/Supertest), Swagger/Postman docs
- [ ] Phase 5: Docker, GitHub Actions CI
- [ ] Phase 6: Deployment, uptime monitoring, seed script