import SwaggerParser from '@apidevtools/swagger-parser';
import { swaggerSpec } from '../dist/config/swagger.js';

const EXPECTED_OPERATIONS = {
  '/': ['get'],
  '/health/live': ['get'],
  '/health/ready': ['get'],
  '/api/auth/register': ['post'],
  '/api/auth/login': ['post'],
  '/api/tasks': ['get', 'post'],
  '/api/tasks/{id}': ['get', 'put', 'delete'],
};

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const problems = [];

function resolveResponse(response) {
  if (!response?.$ref) return response;
  const name = response.$ref.replace('#/components/responses/', '');
  return swaggerSpec.components?.responses?.[name];
}

function operationsOf(pathItem) {
  return HTTP_METHODS.filter((method) => pathItem?.[method]);
}

// 1. Structural validity (clone: the parser dereferences in place).
try {
  await SwaggerParser.validate(structuredClone(swaggerSpec));
} catch (error) {
  problems.push(`Invalid OpenAPI document: ${error.message}`);
}

// 2. Exact route list.
const documentedPaths = Object.keys(swaggerSpec.paths ?? {});
for (const [pathName, methods] of Object.entries(EXPECTED_OPERATIONS)) {
  const pathItem = swaggerSpec.paths?.[pathName];
  if (!pathItem) {
    problems.push(`Missing path: ${pathName}`);
    continue;
  }
  const documented = operationsOf(pathItem);
  for (const method of methods) {
    if (!documented.includes(method)) problems.push(`Missing operation: ${method.toUpperCase()} ${pathName}`);
  }
  for (const method of documented) {
    if (!methods.includes(method)) problems.push(`Unexpected operation: ${method.toUpperCase()} ${pathName}`);
  }
}
for (const pathName of documentedPaths) {
  if (!(pathName in EXPECTED_OPERATIONS)) problems.push(`Unexpected path: ${pathName}`);
}

// 3. Documentation policy, per operation.
let operationCount = 0;
for (const [pathName, pathItem] of Object.entries(swaggerSpec.paths ?? {})) {
  for (const method of operationsOf(pathItem)) {
    operationCount += 1;
    const operation = pathItem[method];
    const label = `${method.toUpperCase()} ${pathName}`;
    const responses = operation.responses ?? {};
    const isMeta = (operation.tags ?? []).includes('Meta');

    const requireResponse = (code, reason) => {
      if (!responses[code]) problems.push(`${label}: missing ${code} response (${reason})`);
    };

    if (!isMeta) requireResponse('500', 'every API operation');
    if (operation.requestBody) {
      requireResponse('400', 'has a request body');
      requireResponse('413', 'has a request body');
    }
    if (operation.security?.length) requireResponse('401', 'requires authentication');
    if (pathName.startsWith('/api/auth/')) requireResponse('429', 'rate limited');

    for (const [code, response] of Object.entries(responses)) {
      const resolved = resolveResponse(response);
      if (!resolved) {
        problems.push(`${label}: ${code} response could not be resolved`);
      } else if (!resolved.headers?.['X-Request-Id']) {
        problems.push(`${label}: ${code} response does not document the X-Request-Id header`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`OpenAPI validation failed (${problems.length} problem${problems.length === 1 ? '' : 's'}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`OpenAPI valid: ${documentedPaths.length} paths, ${operationCount} operations.`);