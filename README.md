# TaskFlow API

A REST API for task management, built as a portfolio piece demonstrating production-grade Node.js/TypeScript backend practices — clean architecture, input validation, authentication, automated testing, and containerized deployment.

> 🚧 Work in progress — Phase 3 (Authentication & Security Hardening) complete, Phase 4 (Testing & Documentation) next.

## Live Demo

_Coming in Phase 6 — will link the deployed Render URL and `/api-docs` here._

## Tech Stack

- **Runtime/Language:** Node.js, TypeScript
- **Framework:** Express
- **Database:** MongoDB (Atlas), Mongoose
- **Validation:** Zod
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Security:** helmet, cors, express-rate-limit
- _(Coming later: Jest/Supertest, Swagger, Docker)_

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

## Architecture

Request flow for task routes: **client → `server.ts` (helmet, cors, json parsing) → `protect` (JWT verification) → route-level `validateRequest` (on write operations) → `taskRoutes.ts` → `taskController.ts` → `Task.ts` (Mongoose) → MongoDB**, with any thrown error diverted at any point to `errorHandler.ts`. Auth routes follow the same shape minus `protect` (you can't require a token to obtain one), with `express-rate-limit` applied instead.

- **`config/db.ts`** — owns the entire database connection lifecycle: validates `MONGODB_URI` exists, connects via Mongoose, confirms the connection with a `ping` command, and guards against duplicate/concurrent connection attempts via `readyState`.
- **`models/Task.ts`** — defines the shape of a task document, including a required `userId` reference tying every task to its owner.
- **`models/User.ts`** — defines the user document shape, with a pre-save hook that hashes the password via bcrypt before it's ever written, and `select: false` on the password field so it's excluded from query results by default.
- **`utils/validators.ts`** — Zod schemas describing valid input shape for every write endpoint (tasks and auth), plus `validateRequest(schema)`, a single generic middleware-builder reused across all of them.
- **`middlewares/protect.ts`** — verifies the `Authorization` header's JWT and attaches the decoded, type-checked user payload onto `req.user` for downstream use. Rejects with 401 on anything missing, malformed, or invalid.
- **`middlewares/errorHandler.ts`** — the single place every error in the app eventually lands, turning a raised error into a consistent, safe JSON response — never a raw stack trace.
- **`controllers/authController.ts`** — registration and login logic: duplicate-email checks, password hashing (via the model's hook), credential comparison, and JWT issuance.
- **`controllers/taskController.ts`** — CRUD logic, every query scoped to `{ ..., userId: req.user.id }` so one user can never read, modify, or delete another user's tasks.
- **`routes/taskRoutes.ts`** / **`routes/authRoutes.ts`** — pure wiring: maps HTTP verb + relative path to the relevant middleware (`protect`, `validateRequest`) and controller function, in sequence.
- **`server.ts`** — the assembly point: connects the DB first (refusing to start if that fails), registers helmet/cors/json middleware, mounts routers (auth routes behind the rate limiter), registers `errorHandler` last, and only then starts listening.

## Design Decisions

- **Task ownership is enforced at the query level, not via a fetch-then-check pattern.** Every task lookup, update, and delete filters by `{ _id: taskId, userId: req.user.id }` in a single query, rather than fetching by ID first and comparing owners afterward. A request for another user's task returns **404**, not 403 — from the requester's perspective, a task they don't own is indistinguishable from one that doesn't exist at all.
- **Login and registration return a consistent, generic "Invalid credentials" message** for both a nonexistent email and a correct email with the wrong password. Returning different messages for each case would let an attacker enumerate which emails are registered — the two failure modes are deliberately indistinguishable to the client.
- **Passwords are never handled as plaintext outside the initial request.** `User.ts`'s pre-save hook hashes the password automatically before any save — `authController.ts` never hashes anything itself. The schema field also carries `select: false`, so ordinary queries never return the hash; `login` explicitly opts back in with `.select('+password')` at the one point it's genuinely needed.
- **JWTs are signed with HS256 using a single shared secret, not RS256.** RS256 requires an asymmetric key pair; this project uses one generated secret (`openssl rand -hex 32`) shared between signing and verification, so HS256 (jsonwebtoken's default) is the correct match. The token payload is kept minimal — just the user's ID — since a JWT is signed but not encrypted, and anything in the payload is readable by anyone holding the token.
- **`req.user`'s type was tightened after the fact, not left loose.** Early versions typed the decoded JWT payload as the library's broad `string | JwtPayload`, requiring every controller to independently re-verify its shape before trusting `req.user.id`. Once it was clear `protect` is the *only* place `req.user` is ever assigned, the global type augmentation was narrowed to `AuthenticatedUser | undefined`, moving the shape-check into `protect` itself and letting every controller downstream trust `req.user.id` with a single `if (!req.user)` guard instead of repeating a full type-guard everywhere.
- **Rate limiting is scoped to `/api/auth/*`, not applied globally.** A legitimate logged-in user could plausibly exceed 100 requests in 15 minutes doing normal task CRUD; 100 login attempts in the same window from one source is almost certainly a brute-force attempt, not real usage. Scoping the limiter narrowly targets the actual risk without throttling normal use elsewhere.
- **`runValidators: true` on updates**, alongside Zod's own request-level validation — deliberate defense in depth. Zod catches invalid input at the HTTP boundary before it reaches the database layer at all; `runValidators` ensures Mongoose's own schema rules (the `status` enum, in particular) are enforced a second time at the persistence boundary, since `findOneAndUpdate` doesn't run schema validation by default.
- **Status codes are split by failure type, not collapsed into one generic error**: `400` for client-caused bad input, `401` for authentication failures, `404` for a well-formed ID that doesn't match (or doesn't belong to the caller), `500` for unexpected server-side failures.

## Known Issues

- **Node fails to resolve `mongodb+srv://` DNS SRV records on some Windows setups**, even when the OS itself resolves the same record correctly (confirmed via `nslookup`). Root cause not fully isolated — firewall/antivirus interference with Node's DNS layer is the leading suspicion, unconfirmed. **Workaround used in this project:** a non-SRV connection string (Atlas → Connect → Drivers → older driver version), which lists the shard hosts directly and avoids the SRV lookup entirely.
- **Mongoose 9's TypeScript types for `schema.pre('save', ...)` reject a hook mixing `async` with a manual `next` callback parameter** — the two calling conventions (legacy callback-style, modern promise-style) are typed as mutually exclusive overloads, not a supported hybrid. Mixing them causes every overload to fail to match, and TypeScript reports a misleading error against an unrelated overload (`createCollection`) instead of anything indicating the real cause. Resolved by using pure `async`/`await` with no `next` parameter in the password-hashing hook — errors now propagate via promise rejection instead.

## Progress Log

- [x] Phase 1: Local setup, folder structure, database connection, core CRUD, health check — verified against a live MongoDB Atlas connection
- [x] Phase 2: Zod validation on create/update, centralized error handling — verified malformed requests return clean structured JSON, not a stack trace
- [x] Phase 3: JWT auth (register/login), password hashing, protected + ownership-scoped task routes, helmet/cors/rate-limiting — verified via cross-user access tests and a real rate-limit stress test (429 confirmed at request 101)
- [ ] Phase 4: Testing (Jest/Supertest), Swagger/Postman docs
- [ ] Phase 5: Docker, GitHub Actions CI
- [ ] Phase 6: Deployment, uptime monitoring, seed script