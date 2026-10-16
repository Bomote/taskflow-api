import { Router } from 'express';
import mongoose from 'mongoose';
import { appInfo } from '../config/appInfo.ts';

const metaRouter = Router();

/**
 * @openapi
 * /:
 *   get:
 *     summary: API entry point
 *     description: Returns the service name, version, deployed commit (when known) and links to the docs and health endpoints.
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: Service metadata
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/RootInfo' }
 */
metaRouter.get('/', (_req, res) => {
  res.status(200).json({
    name: appInfo.name,
    version: appInfo.version,
    commit: process.env.RENDER_GIT_COMMIT || null,
    docs: '/api-docs',
    openapi: '/api-docs.json',
    health: { live: '/health/live', ready: '/health/ready' },
  });
});

/**
 * @openapi
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Returns 200 whenever the process is running. Does not check the database.
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: The process is alive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HealthStatus' }
 *             example: { status: ok }
 */
metaRouter.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Returns 200 when the database connection is established, otherwise 503.
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: Ready to serve traffic
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HealthStatus' }
 *             example: { status: ok }
 *       503:
 *         description: The database is not connected
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HealthStatus' }
 *             example: { status: unavailable }
 */
metaRouter.get('/health/ready', (_req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(isConnected ? 200 : 503).json({ status: isConnected ? 'ok' : 'unavailable' });
});

export default metaRouter;