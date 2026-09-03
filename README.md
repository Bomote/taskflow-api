# TaskFlow API

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

> 🚧 Work in progress — Phase 4 testing (Jest/Supertest) complete, Swagger/Postman docs next.

## Live Demo

_Coming in Phase 6 — will link the deployed Render URL and `/api-docs` here._

## Tech Stack

- **Runtime/Language:** Node.js, TypeScript
- **Framework:** Express
- **Database:** MongoDB (Atlas), Mongoose
- **Validation:** Zod
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Security:** helmet, cors, express-rate-limit
- **Testing:** Jest, Supertest, mongodb-memory-server, @swc/jest
- _(Coming later: Swagger, Docker)_

## Endpoints

| Method | Path                | Description             | Auth Required |
|--------|---------------------|--------------------------|----------------|
| GET    | `/health`           | Health check             | No             |
| POST   | `/api/auth/register`| Register a new user      | No             |
| POST   | `/api/auth/login`   | Log in, receive a JWT    | No             |
| GET    | `/api/tasks`        | List the caller's tasks  | Yes            |
| POST   | `/api/tasks`        | Create a new task        | Yes            |
| GET    | `/api/tasks/:id`    | Fetch one of the caller's tasks by ID | Yes |
| PUT    | `/api/tasks/:id`    | Update one of the caller's tasks      | Yes |
| DELETE | `/api/tasks/:id`    | Delete one of the caller's tasks      | Yes |

Task routes require `Authorization: Bearer <token>`, obtained via `/api/auth/login`. `/api/auth/*` routes are rate-limited (100 requests / 15 min per client).

## Response Shape

Every endpoint responds with one of two consistent shapes:
- Success: `{ "success": true, "data": ... }`
- Failure: `{ "success": false, "error": ..., ["details" | "message"]: ... }`

## How to Run Locally

1. Clone the repo and `cd` into it.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your own MongoDB Atlas connection string and a generated `JWT_SECRET` (`openssl rand -hex 32`).
   - If you're on Windows and hit `ECONNREFUSED` on a DNS SRV lookup despite the connection string being correct, see **Known Issues** below.
4. Run the server:
   ```
   node --env-file=.env src/server.ts
   ```
5. Confirm it's up: `curl http://localhost:5000/health`
6. Register a user, log in, and use the returned token as a `Bearer` token on task requests.

## Testing

```
npm test        # runs the full suite against an in-memory MongoDB instance
npm run typecheck  # separate type-check step — see Design Decisions below for why this is separate
```

Tests live in `src/test/`: `auth.test.ts` covers registration and login (including the negative cases — duplicate email, wrong password, nonexistent email), `tasks.test.ts` covers authenticated task CRUD and rejects unauthenticated/malformed-token requests. A `globalSetup`/`globalTeardown` pair spins up a fresh `mongodb-memory-server` instance once for the entire run and tears it down after, so tests never touch the real Atlas database.

## Architecture

Request flow for task routes: **client → `app.ts` (helmet, cors, json parsing) → `protect` (JWT verification) → route-level `validateRequest` (on write operations) → `taskRoutes.ts` → `taskController.ts` → `Task.ts` (Mongoose) → MongoDB**, with any thrown error diverted at any point to `errorHandler.ts`. Auth routes follow the same shape minus `protect`, with `express-rate-limit` applied instead.

- **`app.ts`** — builds and fully configures the Express app (middleware, routes, error handler) and exports it directly, with no `.listen()` call and no database connection — this is what makes the app importable and testable via Supertest with zero real network/DB side effects.
- **`server.ts`** — the actual entry point: imports the configured app from `app.ts`, connects to the database, and starts listening. The only file that ever calls `connectDB()` outside of tests.
- **`config/db.ts`** — owns the entire database connection lifecycle: validates `MONGODB_URI` exists, connects via Mongoose, confirms the connection with a `ping` command, and guards against duplicate/concurrent connection attempts via `readyState`.
- **`models/Task.ts`** — defines the shape of a task document, including a required `userId` reference tying every task to its owner.
- **`models/User.ts`** — defines the user document shape, with a pre-save hook that hashes the password via bcrypt before it's ever written, and `select: false` on the password field so it's excluded from query results by default.
- **`utils/validators.ts`** — Zod schemas describing valid input shape for every write endpoint, plus `validateRequest(schema)`, a single generic middleware-builder reused across all of them.
- **`middlewares/protect.ts`** — verifies the `Authorization` header's JWT and attaches the decoded, type-checked user payload onto `req.user` for downstream use. Rejects with 401 on anything missing, malformed, or invalid.
- **`middlewares/errorHandler.ts`** — the single place every error in the app eventually lands, turning a raised error into a consistent, safe JSON response — never a raw stack trace.
- **`controllers/authController.ts`** — registration and login logic: duplicate-email checks, password hashing (via the model's hook), credential comparison, and JWT issuance.
- **`controllers/taskController.ts`** — CRUD logic, every query scoped to `{ ..., userId: req.user.id }` so one user can never read, modify, or delete another user's tasks.
- **`routes/taskRoutes.ts`** / **`routes/authRoutes.ts`** — pure wiring: maps HTTP verb + relative path to the relevant middleware and controller function, in sequence.
- **`test/testSetup.ts`** / **`test/testTeardown.ts`** — Jest global setup/teardown: start and stop the in-memory MongoDB instance once per test run, exposing its URI via both `globalThis` and `process.env.MONGODB_URI` so the app's real `connectDB()` works unmodified in tests.

## Design Decisions

- **`app.ts` and `server.ts` are deliberately separate files.** The original single `server.ts` built the Express app, connected the database, and called `.listen()` all as side effects of one module — meaning simply *importing* it (as a test needs to) would try to connect to a real database and bind a real port. Splitting the fully-configured, side-effect-free `app` out into its own file is what makes the app testable via Supertest at all.
- **Task ownership is enforced at the query level, not via a fetch-then-check pattern.** Every task lookup, update, and delete filters by `{ _id: taskId, userId: req.user.id }` in a single query. A request for another user's task returns **404**, not 403 — from the requester's perspective, a task they don't own is indistinguishable from one that doesn't exist.
- **Login and registration return a consistent, generic "Invalid credentials" message** for both a nonexistent email and a correct email with the wrong password, to avoid letting an attacker enumerate registered emails. This is directly covered by an automated test asserting the exact message text, not just the status code.
- **Tests run against an in-memory MongoDB (`mongodb-memory-server`), not a shared test database on Atlas.** This keeps the suite fast (no network round-trip), fully isolated (no risk of tests reading/writing real or shared data), and reproducible in CI without provisioning external infrastructure. A single instance is started once via Jest's `globalSetup` and stopped via `globalTeardown`, rather than per test file, since spinning up a fresh in-memory server is comparatively expensive and only needs to happen once per run.
- **`@swc/jest` is used instead of `ts-jest`, with type-checking run as a separate `npm run typecheck` step.** The project's TypeScript version outpaced `ts-jest`'s supported peer range, and rather than force an unverified install or downgrade TypeScript, `@swc/jest` (a Rust-based compiler) was used to transform test files instead — much faster, but it strips types without checking them. `tsc --noEmit` is run as its own script to cover what `@swc/jest` intentionally doesn't, keeping "fast test execution" and "type safety" as explicitly separate, composable steps rather than assuming one tool has to do both.
- **Passwords are never handled as plaintext outside the initial request.** `User.ts`'s pre-save hook hashes the password automatically before any save; the schema field carries `select: false`, and `login` explicitly opts back in with `.select('+password')` at the one point it's genuinely needed.
- **JWTs are signed with HS256 using a single shared secret, not RS256**, matching the single-secret setup this project actually has. The token payload is kept minimal — just the user's ID — since a JWT is signed but not encrypted.
- **`req.user`'s type was tightened after the fact.** The global `Express.Request` augmentation was narrowed to `AuthenticatedUser | undefined` once it was clear `protect` is the only place `req.user` is ever assigned, moving the shape-check into `protect` itself so every controller downstream can trust `req.user.id` with a single `if (!req.user)` guard.
- **Rate limiting is scoped to `/api/auth/*`, not applied globally**, since repeated login attempts are a realistic attack pattern in a way repeated authenticated task requests generally aren't.
- **Status codes are split by failure type**: `400` for client-caused bad input, `401` for authentication failures, `404` for a well-formed ID that doesn't match (or doesn't belong to the caller), `500` for unexpected server-side failures.

## Known Issues

- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups**, even when the OS itself resolves the same record correctly (confirmed via `nslookup`). Root cause not fully isolated — firewall/antivirus interference with Node's DNS layer is the leading suspicion, unconfirmed. **Workaround used in this project:** a non-SRV connection string (Atlas → Connect → Drivers → older driver version), which lists the shard hosts directly and avoids the SRV lookup entirely.
- **Mongoose 9's TypeScript types for `schema.pre('save', ...)` reject a hook mixing `async` with a manual `next` callback parameter** — resolved by using pure `async`/`await` with no `next` parameter in the password-hashing hook.
- **`ts-jest`'s current release does not support TypeScript 7** (its declared peer range is `>=4.3 <7`), which this project is on. Rather than force an unverified install, `@swc/jest` is used instead — see Design Decisions above.

## Progress Log

- [x] Phase 1: Local setup, folder structure, database connection, core CRUD, health check
- [x] Phase 2: Zod validation on create/update, centralized error handling
- [x] Phase 3: JWT auth (register/login), password hashing, protected + ownership-scoped task routes, helmet/cors/rate-limiting
- [x] Phase 4 (testing): Jest + Supertest + mongodb-memory-server, 11 passing tests across auth and task flows, `app`/`server` split for testability
- [ ] Phase 4 (docs): Swagger/OpenAPI, Postman collection
- [ ] Phase 5: Docker, GitHub Actions CI
- [ ] Phase 6: Deployment, uptime monitoring, seed script