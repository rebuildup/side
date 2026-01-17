import fsSync from 'node:fs';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { DatabaseSync } from 'node:sqlite';
import type { Workspace, Deck, TerminalSession } from './types.js';
import {
  PORT,
  HOST,
  NODE_ENV,
  BASIC_AUTH_USER,
  BASIC_AUTH_PASSWORD,
  CORS_ORIGIN,
  MAX_FILE_SIZE,
  hasStatic,
  distDir,
  dbPath
} from './config.js';
import { securityHeaders } from './middleware/security.js';
import { corsMiddleware } from './middleware/cors.js';
import { basicAuthMiddleware } from './middleware/auth.js';
import { apiRateLimitMiddleware } from './middleware/rateLimit.js';
import { checkDatabaseIntegrity, handleDatabaseCorruption, initializeDatabase, loadPersistedState } from './utils/database.js';
import { createWorkspaceRouter, getConfigHandler } from './routes/workspaces.js';
import { createDeckRouter } from './routes/decks.js';
import { createFileRouter } from './routes/files.js';
import { createTerminalRouter } from './routes/terminals.js';
import { setupWebSocketServer, setupTerminalCleanup } from './websocket.js';

export function createServer() {
  // Check database integrity before opening
  if (fsSync.existsSync(dbPath) && !checkDatabaseIntegrity(dbPath)) {
    handleDatabaseCorruption(dbPath);
  }

  // Initialize database
  const db = new DatabaseSync(dbPath);
  initializeDatabase(db);

  // Initialize state
  const workspaces = new Map<string, Workspace>();
  const workspacePathIndex = new Map<string, string>();
  const decks = new Map<string, Deck>();
  const terminals = new Map<string, TerminalSession>();

  // Load persisted state
  loadPersistedState(db, workspaces, workspacePathIndex, decks);

  // Create Hono app
  const app = new Hono();

  // Global middleware
  app.use('*', securityHeaders);
  app.use('*', corsMiddleware);
  app.use('/api/*', apiRateLimitMiddleware);

  // Basic auth middleware
  if (basicAuthMiddleware) {
    app.use('/api/*', basicAuthMiddleware);
  }

  // Mount routers
  app.route('/api/workspaces', createWorkspaceRouter(db, workspaces, workspacePathIndex));
  app.route('/api/decks', createDeckRouter(db, workspaces, decks));
  app.route('/api/terminals', createTerminalRouter(decks, terminals));

  // Config endpoint
  app.get('/api/config', getConfigHandler());

  // File routes - mount at /api to handle /api/files, /api/preview, /api/file
  const fileRouter = createFileRouter(workspaces);
  app.route('/api', fileRouter);

  // Serve static files
  if (hasStatic) {
    const serveAssets = serveStatic({ root: distDir });
    const serveIndex = serveStatic({ root: distDir, path: 'index.html' });
    app.use('/assets/*', serveAssets);
    app.get('*', async (c, next) => {
      if (c.req.path.startsWith('/api')) {
        return c.text('Not found', 404);
      }
      return serveIndex(c, next);
    });
  }

  // Start server
  const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST });

  // Setup WebSocket and terminal cleanup
  setupWebSocketServer(server, terminals);
  setupTerminalCleanup(terminals);

  // Server startup
  server.on('listening', () => {
    const baseUrl = `http://localhost:${PORT}`;
    console.log(`Deck IDE server listening on ${baseUrl}`);
    console.log(`UI: ${baseUrl}`);
    console.log(`API: ${baseUrl}/api`);
    console.log('');
    console.log('Security Status:');
    console.log(`  - Basic Auth: ${BASIC_AUTH_USER && BASIC_AUTH_PASSWORD ? 'enabled (user: ' + BASIC_AUTH_USER + ')' : 'DISABLED (WARNING: API is publicly accessible!)'}`);
    console.log(`  - Rate Limiting: ${NODE_ENV === 'development' && !process.env.ENABLE_RATE_LIMIT ? 'disabled (development mode)' : 'enabled'}`);
    console.log(`  - Max File Size: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
    console.log(`  - CORS Origin: ${CORS_ORIGIN || (NODE_ENV === 'development' ? '*' : 'NOT SET')}`);
    console.log(`  - Environment: ${NODE_ENV}`);
  });

  return server;
}
