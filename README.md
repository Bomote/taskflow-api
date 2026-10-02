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
- `src/utils/seed.ts` resets the live demo to a known-clean state.

## Architecture

### Request Flow

```text
Client
  ↓
app.ts
  ├── Helmet
  ├── CORS
  ├── JSON parsing
  ├── Payload limits
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

Errors thrown during request processing are routed to `errorHandler.ts`.

### Key Components

| Component | Responsibility |
|---|---|
| `app.ts` | Configures the Express application, including proxy settings, Helmet, CORS, JSON body limits, health checks, routes, Swagger UI, the JSON 404 handler, and the error handler. |
| `server.ts` | Application entry point. Connects to the database, starts the HTTP server, and implements graceful shutdown for `SIGTERM` and `SIGINT`. |
| `config/db.ts` | Handles database lifecycle, URI validation, connection, `ping` confirmation, and `readyState` checks. |
| `utils/errorCodes.ts` | Central source of truth for API error codes, including `PAYLOAD_TOO_LARGE` (`413`). |
| `utils/validators.ts` | Contains Zod schemas and reusable validation middleware builders. |
| `middlewares/protect.ts` | Verifies JWTs using `HS256` and attaches the authenticated user payload. |
| `middlewares/errorHandler.ts` | Handles Zod validation errors, Express payload-size errors (`413`), and internal errors safely. |
| `controllers/` | Contains application/business logic. |
| `routes/` | Contains route definitions and OpenAPI JSDoc documentation. |

## Design Decisions

- **Consistent error contract:** All endpoints use a structured `{ code, message, details? }` error shape.
- **Authentication status codes:** Login failures return `401`; duplicate email registration returns `409`.
- **Register race-condition handling:** Database duplicate-key errors (`11000`) are explicitly detected and converted to `EMAIL_ALREADY_REGISTERED`. Exact user-collection count assertions verify this behavior.
- **Safe error handling:** Controllers never return caught exception messages directly to clients.
- **Mass-assignment protection:** Implemented at two layers using Zod field stripping and explicit controller field mapping.
- **Bounded input:** `description` is limited to 5,000 characters, `limit` to 15, and Express JSON body size limits return `413 PAYLOAD_TOO_LARGE`.
- **JWT algorithm pinning:** `jwt.verify` explicitly restricts accepted algorithms to `HS256`.
- **Empty update protection:** `PUT` requests with an empty body return `400 EMPTY_UPDATE`.
- **Ownership enforcement:** Task ownership is enforced at the database query level, returning `404` for unauthorized access attempts.
- **Jest transformation:** `@swc/jest` is used instead of `ts-jest`, with `tsc --noEmit` running as a separate type-check step.

## Known Issues

- **MongoDB SRV DNS resolution on Windows:** Node.js may fail to resolve `mongodb+srv://` DNS SRV records on some Windows configurations.
  - **Workaround:** Use a non-SRV MongoDB connection string.

- **Mongoose 9 TypeScript hooks:** Mongoose 9's TypeScript types required adjustments to hook implementations, which have been resolved using pure `async` / `await`.

## Progress Log

- [x] Original build, phases 1–6: core CRUD, validation, authentication, testing/documentation infrastructure, Docker/CI, and deployment.
- [x] Hardening step 1: unified error shape and corrected status codes (`401` login, `409` duplicate email).
- [x] Hardening step 2: register race condition handling and prevention of raw error-text leakage.
- [x] Hardening step 3: JWT algorithm pinning and empty-update-body rejection.
- [x] Hardening step 4: `GET /api/tasks` pagination with full edge-case coverage.
- [x] Hardening step 5: CRUD, ownership, mass-assignment, validation, authentication edge-case, and forced-failure test coverage.
- [x] Hardening step 6: corrected Swagger/OpenAPI JSDoc YAML syntax errors.
- [x] Hardening step 7: graceful shutdown, `/health/live` + `/health/ready` health-check split, and payload-size limit handling (`413`).
- [ ] Hardening step 8: build/test isolation fix.
- [ ] Hardening step 9: full README accuracy pass.
- [ ] Hardening step 10: clean-clone release rehearsal and tagged release.
