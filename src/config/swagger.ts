import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesPattern = __dirname.includes('dist')
  ? path.join(__dirname, '../routes/*.js')
  : path.join(__dirname, '../routes/*.ts');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: { title: 'TaskFlow API', version: '1.0.0', description: 'REST API for task management' },
    servers: [
      { url: 'http://localhost:5000', description: 'Local development' },
      { url: 'https://taskflow-api-l7hr.onrender.com', description: 'Live' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Validation failed' },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { field: { type: 'string' }, message: { type: 'string' } },
                  },
                },
              },
            },
            requestId: { type: 'string', description: 'Correlation ID included only on internal server errors' },
          },
        },
      },
    },
  },
  apis: [routesPattern],
};

export const swaggerSpec = swaggerJsdoc(options);

export const swaggerUiServe = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(swaggerSpec);