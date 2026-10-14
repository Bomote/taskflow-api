import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import app from '../app.ts';
import { swaggerSpec } from '../config/swagger.ts';

const EXPECTED_OPERATIONS: Record<string, string[]> = {
  '/': ['get'],
  '/health/live': ['get'],
  '/health/ready': ['get'],
  '/api/auth/register': ['post'],
  '/api/auth/login': ['post'],
  '/api/tasks': ['get', 'post'],
  '/api/tasks/{id}': ['get', 'put', 'delete'],
};

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

describe('OpenAPI specification', () => {
  test('documents exactly the expected paths and methods', () => {
    const documented = Object.fromEntries(
      Object.entries(swaggerSpec.paths as Record<string, Record<string, unknown>>).map(
        ([pathName, pathItem]) => [pathName, HTTP_METHODS.filter((method) => method in pathItem)]
      )
    );

    expect(documented).toEqual(EXPECTED_OPERATIONS);
  });

  test('is a valid OpenAPI document', async () => {
    await expect(SwaggerParser.validate(structuredClone(swaggerSpec) as never)).resolves.toBeDefined();
  });

  test('derives the documented error codes from the real error codes', () => {
    const codes = swaggerSpec.components.schemas.ErrorResponse.properties.error.properties.code.enum;

    expect(codes).toEqual(
      expect.arrayContaining([
        'INVALID_JSON',
        'PAYLOAD_TOO_LARGE',
        'TOO_MANY_REQUESTS',
        'INTERNAL_ERROR',
      ])
    );
  });
});

describe('GET /api-docs.json', () => {
  test('serves the non-empty specification with a request ID', async () => {
    const response = await request(app).get('/api-docs.json');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.paths).length).toBe(Object.keys(EXPECTED_OPERATIONS).length);
    expect(response.headers['x-request-id']).toBeDefined();
  });
});

describe('GET /', () => {
  test('returns service metadata with links to the docs and health endpoints', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      docs: '/api-docs',
      openapi: '/api-docs.json',
      health: { live: '/health/live', ready: '/health/ready' },
    });
    expect(typeof response.body.name).toBe('string');
    expect(typeof response.body.version).toBe('string');
    expect(response.headers['x-request-id']).toBeDefined();
  });
});