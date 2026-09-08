# TaskFlow API

[![Code Testing and CI](https://github.com/Bomote/taskflow-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Bomote/taskflow-api/actions/workflows/ci.yml)

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

> Work in progress — Phase 5 (Containerization & CI/CD) complete, Phase 6 (Deployment) next.

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
- **Docs:** Swagger/OpenAPI (swagger-jsdoc, swagger-ui-express), Postman
- **DevOps:** Docker, GitHub Actions CI

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

Task routes require `Authorization: Bearer <token>`, obtained via `/api/auth/login`. `/api/auth/*` routes are rate-limited (100 requests / 15 min per client). Full interactive documentation is available at `/api-docs` once the server is running.

## Response Shape

Every endpoint responds with one of two consistent shapes:
- Success: `{ "success": true, "data": ... }`
- Failure: `{ "success": false, "error": ..., ["details" | "message"]: ... }`

## How to Run Locally

**Without Docker:**
1. Clone the repo and `cd` into it.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your own MongoDB Atlas connection string and a generated `JWT_SECRET` (`openssl rand -hex 32`).
   - If you're on Windows and hit `ECONNREFUSED` on a DNS SRV lookup despite the connection string being correct, see **Known Issues** below.
4. Run the server: `node --env-file=.env src/server.ts`
5. Confirm it's up: `curl http://localhost:5000/health`

**With Docker:**
1. Steps 1–3 above.
2. `docker build -t taskflow-api .`
3. `docker run -p 5000:5000 --env-file .env taskflow-api`

Either way, explore and test interactively at `http://localhost:5000/api-docs`, or import `TaskFlow.postman_collection.json` into Postman.

## Testing

```
npm test           # runs the full suite against an in-memory MongoDB instance
npm run typecheck  # separate type-check step — see Design Decisions below for why this is separate
```

Both run automatically in CI (GitHub Actions) on every push/PR to `main` — see the badge above.

Tests live in `src/test/`: `auth.test.ts` covers registration and login (including negative cases), `tasks.test.ts` covers authenticated task CRUD and rejects unauthenticated/malformed-token requests. A `globalSetup`/`globalTeardown` pair spins up a fresh `mongodb-memory-server` instance once per run and tears it down after, so tests never touch the real Atlas database.

## API Documentation

- **Swagger/OpenAPI** — served at `/api-docs`, generated from JSDoc comments above each route. Fully interactive, including "Try it out" with Bearer-token auth.
- **Postman** — `TaskFlow.postman_collection.json` at the repo root. Registration generates a fresh random email/password and captures them into collection variables; login captures the returned JWT; task creation captures the new task's ID — the whole collection runs top-to-bottom with no manual copy-pasting.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`: checkout → Node setup → `npm ci` → `npm run typecheck` → `npm test`. `JWT_SECRET` is provided via a GitHub Actions repository secret, generated separately from (and unrelated to) the value in any local or deployed `.env` — the test suite only needs *a* defined secret to satisfy the app's own startup checks, not the real one.

## Architecture

Request flow for task routes: **client → `app.ts` (helmet, cors, json parsing) → `protect` (JWT verification) → route-level `validateRequest` (on write operations) → `taskRoutes.ts` → `taskController.ts` → `Task.ts` (Mongoose) → MongoDB**, with any thrown error diverted at any point to `errorHandler.ts`. Auth routes follow the same shape minus `protect`, with `express-rate-limit` applied instead.

- **`app.ts`** — builds and fully configures the Express app (middleware, routes, Swagger UI, error handler) and exports it directly, with no `.listen()` call and no database connection — this is what makes the app importable and testable via Supertest with zero real network/DB side effects.
- **`server.ts`** — the actual entry point: imports the configured app, connects to the database, and starts listening. Compiled to `dist/server.js` for both the `npm run build` output and the Docker image's `CMD`.
- **`config/db.ts`** — owns the entire database connection lifecycle.
- **`config/swagger.ts`** — the OpenAPI definition and the glob pattern telling `swagger-jsdoc` where to find route documentation comments.
- **`models/Task.ts`** / **`models/User.ts`** — document shapes; `User.ts` hashes passwords via a pre-save hook and excludes the hash from query results by default.
- **`utils/validators.ts`** — Zod schemas plus `validateRequest(schema)`, a single generic middleware-builder reused across every write endpoint.
- **`middlewares/protect.ts`** — verifies the JWT and attaches a type-checked user payload onto `req.user`.
- **`middlewares/errorHandler.ts`** — the single place every error in the app lands.
- **`controllers/`** — business logic; every task query is scoped to the requesting user.
- **`routes/`** — pure wiring, with `@openapi` JSDoc comments above each route.
- **`test/testSetup.ts`** / **`test/testTeardown.ts`** — Jest global setup/teardown for the in-memory MongoDB instance.
- **`Dockerfile`** — copies dependency manifests and installs before copying source, so dependency layers stay cached across rebuilds that only touch application code; compiles TypeScript inside the image; runs the compiled output, not the TypeScript source.
- **`.github/workflows/ci.yml`** — automated typecheck + test run on every push/PR.

## Design Decisions

- **`app.ts` and `server.ts` are deliberately separate files**, so the app can be imported by Supertest with no side effects.
- **Task ownership is enforced at the query level.** Every task lookup, update, and delete filters by `{ _id: taskId, userId: req.user.id }`. A request for another user's task returns **404**, not 403.
- **Login and registration return a consistent, generic "Invalid credentials" message** for both a nonexistent email and a wrong password, to avoid letting an attacker enumerate registered emails.
- **Tests run against an in-memory MongoDB (`mongodb-memory-server`)**, not a shared Atlas test database — fast, isolated, and reproducible without external infrastructure, including inside CI.
- **`@swc/jest` is used instead of `ts-jest`**, since the project's TypeScript version outpaced `ts-jest`'s supported peer range. `tsc --noEmit` runs as its own script (and its own CI step) to cover the type-checking `@swc/jest` intentionally skips.
- **Swagger documentation is hand-written in JSDoc comments, not auto-generated from the Zod schemas.** Each route's documented response codes were traced against the actual controller logic rather than assumed, since documentation describing behavior the code doesn't have is worse than no documentation at all.
- **The Docker build copies `package*.json` and runs `npm install` before copying the rest of the source.** Docker caches each instruction as a layer and only invalidates a layer (and everything after it) when its inputs change — ordering it this way means an ordinary code change doesn't force a full dependency reinstall on every rebuild.
- **The container runs the compiled `dist/server.js`, not the TypeScript source**, matching how the image is actually built (`npm run build` inside the Dockerfile) — a genuinely different code path from local development, verified separately by running the built image rather than assuming it behaves like `node --env-file=.env src/server.ts` does.
- **CI's `JWT_SECRET` is a dedicated value stored as a GitHub Actions secret, generated separately from any real local or deployed secret.** The test suite only needs a defined value to satisfy the app's own "is this configured" checks — there's no reason for a CI-only secret to share sensitivity with a production one.
- **JWTs are signed with HS256 using a single shared secret, not RS256.** Passwords are hashed via a pre-save hook and excluded from query results by default (`select: false`).
- **Status codes are split by failure type**: `400` client-caused bad input, `401` authentication failures, `404` a well-formed ID that doesn't match (or isn't owned by the caller), `500` unexpected server-side failures.

## Known Issues

- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups.** **Workaround:** a non-SRV connection string (Atlas → Connect → Drivers → older driver version).
- **Mongoose 9's TypeScript types for `schema.pre('save', ...)` reject a hook mixing `async` with a manual `next` parameter.** Resolved with pure `async`/`await`, no `next` parameter.
- **`ts-jest`'s current release does not support TypeScript 7.** `@swc/jest` is used instead — see Design Decisions.
- **The Postman collection's task-creation request uses a static title.** Re-running the collection creates additional tasks with the same title rather than erroring — not a bug (no uniqueness constraint on task titles), just a minor tidiness gap versus the auto-generated auth fixtures.