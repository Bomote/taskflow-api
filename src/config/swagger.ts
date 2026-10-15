import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { appInfo } from './appInfo.ts';
import { ERR_CODES } from '../utils/errorCodes.ts';
import { AUTH_RATE_LIMITS } from './rateLimits.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Running from source (.ts) or from the compiled build (.js): scan the matching files.
const routesExtension = path.extname(__filename) === '.js' ? 'js' : 'ts';
const routesPattern = path.join(__dirname, `../routes/*.${routesExtension}`).replace(/\\/g, '/');

// ---------------------------------------------------------------------------
// Error documentation is generated from ERR_CODES so docs cannot drift from code.
// ---------------------------------------------------------------------------

type ErrorKey = keyof typeof ERR_CODES;
const errorKeys = Object.keys(ERR_CODES) as ErrorKey[];

function errorExample(key: ErrorKey) {
  const { message } = ERR_CODES[key];
  return {
    summary: key,
    value: {
      success: false,
      error: {
        code: key,
        message,
        ...(key === 'VALIDATION_ERROR'
          ? { details: [{ field: 'email', message: 'Invalid email address' }] }
          : {}),
      },
      ...(key === 'INTERNAL_ERROR' ? { requestId: '985aa8e9-c7ea-4c4d-a051-378587c3f31b' } : {}),
    },
  };
}

function errorResponse(status: number, description: string, extra: Record<string, unknown> = {}) {
  const examples = Object.fromEntries(
    errorKeys.filter((key) => ERR_CODES[key].status === status).map((key) => [key, errorExample(key)])
  );

  return {
    description,
    ...extra,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
        examples,
      },
    },
  };
}

const options: swaggerJsdoc.Options = {
  // Throw on malformed JSDoc instead of silently dropping the affected path.
  failOnErrors: true,
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'TaskFlow API',
      version: appInfo.version,
      description:
        'REST API for task management. Every response carries an X-Request-Id header; ' +
        'unexpected (500) errors also repeat the ID in the body for log correlation.',
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Local development' },
      { url: 'https://taskflow-api-l7hr.onrender.com', description: 'Live' },
    ],
    tags: [
      { name: 'Auth', description: 'Registration and login (rate limited)' },
      { name: 'Tasks', description: "The authenticated user's tasks" },
      { name: 'Meta', description: 'Service metadata and health probes' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      headers: {
        XRequestId: {
          description:
            'Correlation ID for this request. Echoes a valid client-supplied X-Request-Id ' +
            '(1-64 characters of A-Z, a-z, 0-9, ".", "_", "-"); otherwise a generated UUID.',
          schema: { type: 'string', maxLength: 64 },
        },
      },
      parameters: {
        TaskId: {
          in: 'path',
          name: 'id',
          required: true,
          description: 'Task ID (24-character hexadecimal ObjectId). Any other format returns INVALID_ID.',
          schema: { type: 'string', examples: ['66f1a2b3c4d5e6f708192a3b'] },
        },
      },
      responses: {
        BadRequest: errorResponse(
          400,
          'The request was rejected: VALIDATION_ERROR, INVALID_JSON, INVALID_ID or EMPTY_UPDATE.'
        ),
        Unauthorized: errorResponse(
          401,
          'Missing or invalid token (UNAUTHORIZED), or wrong credentials on login (INVALID_CREDENTIALS).'
        ),
        NotFound: errorResponse(404, 'The requested resource does not exist.'),
        Conflict: errorResponse(409, 'The resource already exists.'),
        PayloadTooLarge: errorResponse(413, 'The request body exceeds the 100 kb limit.'),
        TooManyRequests: errorResponse(
          429,
                    `Auth rate limit exceeded (${AUTH_RATE_LIMITS.limit} requests per ${AUTH_RATE_LIMITS.windowMs / 60_000} minutes per IP, shared by register and login).`,
          {
            headers: {
              'Retry-After': {
                description: 'Seconds until the rate limit window resets.',
                schema: { type: 'integer' },
              },
            },
          }
        ),
        InternalError: errorResponse(
          500,
          'Unexpected server error. The body carries requestId, which matches the X-Request-Id header and the server log.'
        ),
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', enum: errorKeys },
                message: { type: 'string' },
                details: {
                  type: 'array',
                  description: 'Present on VALIDATION_ERROR only.',
                  items: {
                    type: 'object',
                    properties: { field: { type: 'string' }, message: { type: 'string' } },
                  },
                },
              },
            },
            requestId: {
              type: 'string',
              description: 'Correlation ID. Included only on INTERNAL_ERROR; every response also has the X-Request-Id header.',
            },
          },
        },
        Task: {
          type: 'object',
          required: ['_id', 'title', 'status', 'userId', 'createdAt', 'updatedAt'],
          properties: {
            _id: { type: 'string', examples: ['66f1a2b3c4d5e6f708192a3b'] },
            title: { type: 'string', minLength: 3 },
            description: { type: 'string', maxLength: 5000 },
            status: { type: 'string', enum: ['pending', 'in-progress', 'completed'] },
            userId: { type: 'string', description: 'ID of the owning user.' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            __v: { type: 'integer', description: 'Mongoose document version key.' },
          },
        },
        Pagination: {
          type: 'object',
          required: ['page', 'limit', 'total', 'totalPages'],
          properties: {
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 15 },
            total: { type: 'integer', minimum: 0 },
            totalPages: { type: 'integer', minimum: 0 },
          },
        },
        TaskResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/Task' },
          },
        },
        TaskListResponse: {
          type: 'object',
          required: ['success', 'data', 'pagination'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
        CreateTaskRequest: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 3 },
            description: { type: 'string', maxLength: 5000 },
            status: { type: 'string', enum: ['pending', 'in-progress', 'completed'] },
          },
        },
        UpdateTaskRequest: {
          type: 'object',
          minProperties: 1,
          description: 'At least one field is required; an empty update returns EMPTY_UPDATE.',
          properties: {
            title: { type: 'string', minLength: 3 },
            description: { type: 'string', maxLength: 5000 },
            status: { type: 'string', enum: ['pending', 'in-progress', 'completed'] },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            password: {
              type: 'string',
              minLength: 8,
              description:
                'At least 8 characters and at most 72 bytes when encoded as UTF-8 (bcrypt ignores anything beyond 72 bytes), ' +
                'with at least one uppercase letter, one lowercase letter, one number and one special character.',
            },
          },
        },
        RegisterResponse: {
          type: 'object',
          required: ['success', 'message'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            message: { type: 'string', examples: ['User John Doe created'] },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        LoginResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              required: ['token'],
              properties: {
                token: { type: 'string', description: 'JWT, valid for one hour.' },
              },
            },
          },
        },
        HealthStatus: {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', enum: ['ok', 'unavailable'] } },
        },
        RootInfo: {
          type: 'object',
          required: ['name', 'version', 'docs', 'openapi', 'health'],
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            commit: {
              type: ['string', 'null'],
              description: 'Deployed Git commit when the host provides it (Render sets RENDER_GIT_COMMIT).',
            },
            docs: { type: 'string', examples: ['/api-docs'] },
            openapi: { type: 'string', examples: ['/api-docs.json'] },
            health: {
              type: 'object',
              properties: { live: { type: 'string' }, ready: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  apis: [routesPattern],
};

// ---------------------------------------------------------------------------
// Post-processing: guarantee the X-Request-Id header is documented on every
// response (inline ones here, shared ones inside components.responses).
// ---------------------------------------------------------------------------

type Spec = Record<string, any>;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

function addRequestIdHeader(response: Spec) {
  if (response.$ref) {
    return;
  }
  response.headers = {
    'X-Request-Id': { $ref: '#/components/headers/XRequestId' },
    ...(response.headers ?? {}),
  };
}

function buildSpec(): Spec {
  const spec = swaggerJsdoc(options) as Spec;

  for (const response of Object.values<Spec>(spec.components?.responses ?? {})) {
    addRequestIdHeader(response);
  }

  for (const pathItem of Object.values<Spec>(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      for (const response of Object.values<Spec>(pathItem[method]?.responses ?? {})) {
        addRequestIdHeader(response);
      }
    }
  }

  return spec;
}

export const swaggerSpec = buildSpec();

export const swaggerUiServe = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(swaggerSpec);