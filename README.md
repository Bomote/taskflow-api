# TaskFlow API

A REST API for task management, built as a portfolio project demonstrating production-grade Node.js/TypeScript backend practices, including clean architecture, input validation, authentication, automated testing, and containerized deployment.

> 🚧 **Current status:** Mid-hardening pass following an external code review. Core error contracts, pagination, test coverage, liveness/readiness health checks, and graceful shutdown are complete. Container hardening and release verification are still in progress. See the [Progress Log](#progress-log) for the exact status.

## Live Demo

- **API:** https://taskflow-api-l7hr.onrender.com/
- **Interactive docs (Swagger):** https://taskflow-api-l7hr.onrender.com/api-docs
- **Health checks:**
  - **Liveness:** https://taskflow-api-l7hr.onrender.com/health/live
  - **Readiness:** https://taskflow-api-l7hr.onrender.com/health/ready

> **Note:** The API is hosted on Render's free tier. The instance may spin down after inactivity, so the first request after a period of inactivity can take approximately 30–60 seconds.

## Tech Stack

| Category | Technology |
|---|---|
| Runtime / Language | Node.js, TypeScript |
| Framework | Express |
| Database | MongoDB Atlas, Mongoose |
| Validation | Zod |
| Authentication | JWT (`jsonwebtoken`), `bcryptjs` |
| Security | Helmet, CORS, `express-rate-limit` |
| Testing | Jest, Supertest, `mongodb-memory-server`, `@swc/jest` |
| Documentation | Swagger/OpenAPI, `swagger-jsdoc`, `swagger-ui-express`, Postman |
| DevOps | Docker, GitHub Actions CI, Render, UptimeRobot |

## Endpoints

| Method | Path | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health/live` | Liveness health check | No |
| `GET` | `/health/ready` | Readiness health check, including DB connectivity | No |
| `POST` | `/api/auth/register` | Register a new user | No |
| `POST` | `/api/auth/login` | Log in and receive a JWT | No |
| `GET` | `/api/tasks` | List the caller's tasks with pagination | Yes |
| `POST` | `/api/tasks` | Create a new task | Yes |
| `GET` | `/api/tasks/:id` | Fetch one of the caller's tasks | Yes |
| `PUT` | `/api/tasks/:id` | Update one of the caller's tasks | Yes |
| `DELETE` | `/api/tasks/:id` | Delete one of the caller's tasks | Yes |

Task routes require an `Authorization: Bearer <token>` header obtained from `/api/auth/login`.

Authentication routes (`/api/auth/*`) are rate-limited to **100 requests per 15 minutes per client**.

### Task Validation

- `title` must contain at least 3 characters.
- `description` is limited to 5,000 characters.
- `status` must be one of:
  - `pending`
  - `in-progress`
  - `completed`

## Pagination

### `GET /api/tasks`

- `page` defaults to `1`.
- `limit` defaults to `10`.
- Maximum `limit` is `15`.
- Both values must be positive integers.
- Invalid values—including zero, negative numbers, decimals, non-numeric values, arrays/repeated parameters, or values above the limit—return `400`.
- Results are sorted newest-first, with a stable secondary tie-breaker to keep ordering deterministic when multiple tasks share the same creation timestamp.
- Responses include a `pagination` object:

```json
{
  "page": 1,
  "limit": 10,
  "total": 25,
  "totalPages": 3
}
```

- Pagination metadata is scoped strictly to the authenticated user's tasks.
- Requesting a page beyond the last available page returns an empty `data` array with accurate pagination metadata rather than an error.

## Response Shape

Every endpoint follows one of two consistent response structures.

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Failure

```json
{
  "success": false,
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "fieldName",
        "message": "Validation message"
      }
    ]
  }
}
```

The `code` field is a stable, machine-checkable identifier defined centrally in `utils/errorCodes.ts`.

The `message` field is human-readable.

The optional `details` field is included for validation failures and provides a per-field breakdown.

### Request IDs

Every response, including errors such as `401`, `404`, `413`, and `400`, carries an `X-Request-Id` header.

- If the client sends a valid `X-Request-Id` (1–64 characters from `A–Z`, `a–z`, `0–9`, `.`, `_`, `-`), the server echoes it back.
- Otherwise the server generates a UUID. Invalid values are replaced silently, never rejected.
- Unexpected failures (`500 INTERNAL_ERROR`) also include the same ID in the response body, so a reported failure can be matched to the server log line that recorded it:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected internal error"
  },
  "requestId": "985aa8e9-c7ea-4c4d-a051-378587c3f31b"
}
```

The server log entry for the same failure is prefixed with `[<requestId>]`. Error details and stack traces appear only in the log, never in the response.

Browser clients can read the header because CORS exposes `X-Request-Id`.

## How to Run Locally

### Without Docker

1. Clone the repository and change into the project directory.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and provide:
   - Your MongoDB Atlas connection string.
   - A generated `JWT_SECRET`.

   Generate a secure secret with:

   ```bash
   openssl rand -hex 32
   ```

   > **Windows note:** If you encounter `ECONNREFUSED` during a DNS SRV lookup despite having a correct connection string, see [Known Issues](#known-issues).

4. Start the server:

   ```bash
   node --env-file=.env src/server.ts
   ```

5. Confirm that the API is running:

   ```bash
   curl http://localhost:5000/health/live
   ```

### With Docker

1. Complete steps 1–3 above.

2. Build the Docker image:

   ```bash
   docker build -t taskflow-api .
   ```

3. Run the container:

   ```bash
   docker run -p 5000:5000 --env-file .env taskflow-api
   ```

### Explore the API

Once the server is running, open:

```text
http://localhost:5000/api-docs
```

Alternatively, import `TaskFlow.postman_collection.json` from the repository root into Postman.

## Testing

Run the full test suite:

```bash
npm test
```

Run TypeScript type checking:

```bash
npm run typecheck
```

The test suite runs against an in-memory MongoDB instance, while type checking separately covers both application and test files.

Both checks run automatically in CI on every push or pull request to `main`.

### Demo data seeding

`npm run seed` resets the public demo account to a known state.

**What it deletes and recreates**

- Deletes the user `demo@taskflow.example` (if it exists) and every task belonging to that user.
- Creates that user again, with four sample tasks.
- Touches no other user and no other task.

The demo password (`DemoUserPass!123`) is intentionally public so visitors can log in.

**Safeguards**

The script refuses to run unless you opt in explicitly:

- `CONFIRM_SEED` must be exactly `true`. Any other value, or none, is refused.
- It treats the target as production when `NODE_ENV` is `production` or when the database host is not local (this includes every Atlas connection string). A production target also requires `ALLOW_PRODUCTION_SEED=true`.
- Refusals happen before any database connection is made, and the connection string is never printed.

**Running it (PowerShell)**

```powershell
# Local or test database
$env:CONFIRM_SEED = 'true'
npm run seed
Remove-Item Env:CONFIRM_SEED

# Live demo database (Atlas)
$env:CONFIRM_SEED = 'true'
$env:ALLOW_PRODUCTION_SEED = 'true'
npm run seed
Remove-Item Env:CONFIRM_SEED, Env:ALLOW_PRODUCTION_SEED
```

The seed script is not part of the production build or Docker image. Run it from a development machine whose `.env` points at the target database.

### Test Coverage

Tests are located in `src/tests/`.

#### `auth.test.ts`

Covers:

- User registration and login.
- Duplicate registration handling.
- Database count verification for duplicate registrations.
- Consistent authentication failure responses.

#### `tasks.test.ts`

Coverage is organized into the following areas:

- **Core CRUD happy paths**
  - Create
  - List
  - Fetch
  - Update
  - Delete

- **Authentication edge cases**
  - Missing authorization header.
  - Malformed token.
  - Expired token.

- **Validation edge cases**
  - Malformed ObjectId.
  - Empty update body.
  - Invalid status.
  - Empty-string title.
  - Over-length description.
  - Unknown fields ignored.
  - Oversized payloads returning `413 PAYLOAD_TOO_LARGE`.

- **Mass-assignment / ownership integrity**
  - Client-supplied `userId` is ignored on create and update.
  - Client-supplied `_id` is ignored on create and update.

- **Cross-user ownership**
  - A user's task cannot be read, updated, or deleted by another user.
  - Unauthorized access consistently returns `404`.

- **Pagination**
  - Default values.
  - Maximum limit boundary.
  - Invalid input variants.
  - Empty and past-the-end pages.
  - Result slicing.
  - Per-user total isolation.

- **Forced failure handling**
  - Simulated model errors return a generic `INTERNAL_ERROR`.
  - Sensitive strings and stack traces are not exposed to clients.
  - The failure is logged server-side with the request ID.

#### `requestId.test.ts`

- **Header on every response type**
  - `200`, `401`, `404`, `400` (validation), `413`, and `400 INVALID_JSON` all include a UUID-format `X-Request-Id`.
- **Client-supplied IDs**
  - A safe ID is echoed unchanged.
  - IDs that are too long or contain disallowed characters are replaced with a generated UUID.
- **Failure correlation**
  - A forced `500` returns the same ID in the header and the body.
  - The server log contains that ID.
  - The error message is never exposed to the client.

### Test Database Isolation

A `globalSetup` / `globalTeardown` pair starts a fresh `mongodb-memory-server` instance once per test run.

Tests therefore never interact with the real MongoDB Atlas database.

## API Documentation

### Swagger / OpenAPI

Swagger UI is served at:

```text
/api-docs
```

The documentation is generated from JSDoc comments above the routes and includes corrected YAML indentation and syntax.

The interface is fully interactive and supports **Try it out** with Bearer-token authentication.

### Postman

The repository includes:

```text
TaskFlow.postman_collection.json
```

The collection automatically:

1. Generates a fresh random email/password during registration.
2. Stores the generated credentials in collection variables.
3. Captures the JWT returned by login.
4. Captures the ID of newly created tasks.

## CI/CD & Deployment

- `.github/workflows/ci.yml` runs on every push and pull request to `main`.
- CI pipeline:
  1. Checkout repository.
  2. Set up Node.js.
  3. Run `npm ci`.
  4. Run `npm run typecheck`.
  5. Run `npm test`.
- `JWT_SECRET` is provided through a GitHub Actions repository secret.
- The application is deployed on **Render** using the repository's `Dockerfile`.
- Environment variables are configured through the Render dashboard.
- **UptimeRobot** monitors `/health/live` every 5 minutes.
- Demo data can be reset with the seed script; see [Demo data seeding](#demo-data-seeding).

## Architecture

### Request Flow

```text
Client
  ↓
app.ts
  ├── Request ID (X-Request-Id)
  ├── Helmet
  ├── CORS
  ├── JSON parsing (100 kb limit)
  └── Health checks
  ↓
protect
  └── JWT verification
  ↓
Route-level validation
  ├── validateRequest
  └── validateQuery
  ↓
taskRoutes.ts
  ↓
taskController.ts
  ↓
Task.ts
  ↓
MongoDB
```

Errors thrown during request processing, including rejected promises from async controllers, are routed to `errorHandler.ts`.

### Key Components

| Component | Responsibility |
|---|---|
| `app.ts` | Configures the Express application: request IDs first, then proxy settings, Helmet, CORS, JSON body limits, health checks, routes, Swagger UI, the JSON 404 handler, and the error handler. |
| `server.ts` | Application entry point. Connects to the database, starts the HTTP server, and implements graceful shutdown for `SIGTERM` and `SIGINT`. |
| `config/db.ts` | Handles database lifecycle, URI validation, connection, `ping` confirmation, and `readyState` checks. |
| `utils/errorCodes.ts` | Central source of truth for API error codes, including `PAYLOAD_TOO_LARGE` (`413`) and `INVALID_JSON` (`400`). |
| `utils/validators.ts` | Contains Zod schemas and reusable validation middleware builders. |
| `middlewares/requestId.ts` | Assigns every request an ID (validated client value or generated UUID) and sets the `X-Request-Id` response header. |
| `middlewares/protect.ts` | Verifies JWTs using `HS256` and attaches the authenticated user payload. |
| `middlewares/errorHandler.ts` | Central error handler. Maps Zod validation errors, malformed JSON (`400`), and oversized payloads (`413`); logs unexpected errors with the request ID and returns a generic `500` that includes only the ID. |
| `controllers/` | Contains application/business logic. |
| `routes/` | Contains route definitions and OpenAPI JSDoc documentation. |

## Design Decisions

- **Consistent error contract:** All endpoints use a structured `{ code, message, details? }` error shape.
- **Authentication status codes:** Login failures return `401`; duplicate email registration returns `409`.
- **Register race-condition handling:** Database duplicate-key errors (`11000`) are explicitly detected and converted to `EMAIL_ALREADY_REGISTERED`. Exact user-collection count assertions verify this behavior.
- **Safe error handling:** Responses never contain caught exception messages or stack traces. Details go only to the server log.
- **Single error path:** Controllers do not catch unexpected errors. Express 5 forwards rejected promises from async handlers to `errorHandler.ts`, so every unexpected failure is logged with its request ID and answered with the same generic `500`. (This relies on Express 5 behaviour; on Express 4 an unhandled async error would leave the request hanging.) The one exception is `registerUser`, which handles the duplicate-key case itself and rethrows everything else.
- **Request ID first:** The request-ID middleware runs before every other middleware, so even rejections by the JSON parser (`413`, malformed JSON) carry an `X-Request-Id`.
- **Untrusted client IDs:** A client-supplied `X-Request-Id` is accepted only if it matches `^[A-Za-z0-9._-]{1,64}$`; anything else is replaced by a UUID. This prevents log injection and oversized headers.
- **Malformed JSON is a client error:** An unparseable body returns `400 INVALID_JSON`. Previously it fell through to a `500`.
- **Mass-assignment protection:** Implemented at two layers using Zod field stripping and explicit controller field mapping.
- **Bounded input:** `description` is limited to 5,000 characters, `limit` to 15, and Express JSON body size limits return `413 PAYLOAD_TOO_LARGE`.
- **JWT algorithm pinning:** `jwt.verify` explicitly restricts accepted algorithms to `HS256`.
- **Empty update protection:** `PUT` requests with an empty body return `400 EMPTY_UPDATE`.
- **Ownership enforcement:** Task ownership is enforced at the database query level, returning `404` for unauthorized access attempts.
- **Jest transformation:** `@swc/jest` is used instead of `ts-jest`, with `tsc --noEmit` running as a separate type-check step.
- **Seed opt-in and production guard:** The seed script requires `CONFIRM_SEED=true` exactly, and production-like targets additionally require `ALLOW_PRODUCTION_SEED=true`. The checks run before any database connection and live in a pure, separately tested module.
- **Fail-closed host detection:** The seed guard parses the connection string as text (`new URL()` rejects multi-host Atlas URIs). Anything it cannot positively identify as local is treated as production.
  

## Known Issues

- **MongoDB SRV DNS resolution on Windows:** Node.js may fail to resolve `mongodb+srv://` DNS SRV records on some Windows configurations.
  - **Workaround:** Use a non-SRV MongoDB connection string.
- **Mongoose 9 TypeScript hooks:** Mongoose 9's TypeScript types required adjustments to hook implementations, which have been resolved using pure `async` / `await`.
- **Dev-only `npm audit` findings (checked October 2026):** 19 moderate findings remain, all caused by `sprintf-js` (no patched version exists) inside Jest's coverage tooling. They are not in the production image (`npm audit --omit=dev` reports 0), and the only suggested "fix" would downgrade Jest across five major versions. To be re-checked when the Jest toolchain or `sprintf-js` updates.