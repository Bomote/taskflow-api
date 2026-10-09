import { swaggerSpec } from '../config/swagger.ts';

describe('OpenAPI Specification Generation', () => {
  test('generates a non-empty spec containing all expected API paths', () => {
    expect(swaggerSpec).toBeDefined();
    
    const spec = swaggerSpec as { paths: Record<string, unknown> };
    expect(spec.paths).toBeDefined();

    const paths = Object.keys(spec.paths);
    expect(paths).toContain('/api/auth/register');
    expect(paths).toContain('/api/auth/login');
    expect(paths).toContain('/api/tasks');
    expect(paths).toContain('/api/tasks/{id}');
  });
});