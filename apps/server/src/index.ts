import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { WebSocketServer, type WebSocket } from 'ws';
import { spawn, type IDisposable, type IPty } from 'node-pty';
import { DatabaseSync } from 'node:sqlite';

type Workspace = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
};

type Deck = {
  id: string;
  name: string;
  root: string;
  workspaceId: string;
  createdAt: string;
};

type TerminalSession = {
  id: string;
  deckId: string;
  title: string;
  createdAt: string;
  term: IPty;
  sockets: Set<WebSocket>;
  buffer: string;
  lastActive: number;
  dispose: IDisposable | null;
};

type HttpError = Error & { status?: number };

const DEFAULT_ROOT = process.env.DEFAULT_ROOT || os.homedir();
const PORT = Number(process.env.PORT || 8787);

const app = new Hono();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', '..', 'web', 'dist');
const hasStatic = fsSync.existsSync(distDir);
const dataDir = path.resolve(__dirname, '..', '..', 'data');
const dbPath = process.env.DB_PATH || path.join(dataDir, 'deck-ide.db');
fsSync.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);

app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

const workspaces = new Map<string, Workspace>();
const workspacePathIndex = new Map<string, string>();
const decks = new Map<string, Deck>();
const terminals = new Map<string, TerminalSession>();
const TERMINAL_BUFFER_LIMIT = Number(
  process.env.TERMINAL_BUFFER_LIMIT || 50000
);
const TERMINAL_IDLE_TIMEOUT_MS = Number(
  process.env.TERMINAL_IDLE_TIMEOUT_MS || 30 * 60 * 1000
);

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    normalized_path TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const insertWorkspace = db.prepare(
  'INSERT INTO workspaces (id, name, path, normalized_path, created_at) VALUES (?, ?, ?, ?, ?)'
);
const insertDeck = db.prepare(
  'INSERT INTO decks (id, name, root, workspace_id, created_at) VALUES (?, ?, ?, ?, ?)'
);

function normalizeWorkspacePath(inputPath = '') {
  return path.resolve(inputPath || DEFAULT_ROOT);
}

function getWorkspaceKey(workspacePath: string) {
  const normalized = workspacePath.replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function getWorkspaceName(workspacePath: string, index: number) {
  const trimmed = workspacePath.replace(/[\\/]+$/, '');
  const base = path.basename(trimmed);
  return base || `Project ${index}`;
}

function createHttpError(message: string, status: number): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function createWorkspace(inputPath: string, name?: string) {
  const resolvedPath = normalizeWorkspacePath(inputPath);
  const key = getWorkspaceKey(resolvedPath);
  if (workspacePathIndex.has(key)) {
    throw createHttpError('Workspace path already exists', 409);
  }
  const workspace: Workspace = {
    id: crypto.randomUUID(),
    name: name || getWorkspaceName(resolvedPath, workspaces.size + 1),
    path: resolvedPath,
    createdAt: new Date().toISOString()
  };
  workspaces.set(workspace.id, workspace);
  workspacePathIndex.set(key, workspace.id);
  insertWorkspace.run(
    workspace.id,
    workspace.name,
    workspace.path,
    key,
    workspace.createdAt
  );
  return workspace;
}

function requireWorkspace(workspaceId: string) {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    throw createHttpError('Workspace not found', 404);
  }
  return workspace;
}

function createDeck(name: string | undefined, workspaceId: string) {
  const workspace = requireWorkspace(workspaceId);
  const deck: Deck = {
    id: crypto.randomUUID(),
    name: name || `Deck ${decks.size + 1}`,
    root: workspace.path,
    workspaceId,
    createdAt: new Date().toISOString()
  };
  decks.set(deck.id, deck);
  insertDeck.run(
    deck.id,
    deck.name,
    deck.root,
    deck.workspaceId,
    deck.createdAt
  );
  return deck;
}

function appendToTerminalBuffer(session: TerminalSession, data: string) {
  session.buffer += data;
  if (session.buffer.length > TERMINAL_BUFFER_LIMIT) {
    session.buffer = session.buffer.slice(
      session.buffer.length - TERMINAL_BUFFER_LIMIT
    );
  }
}

function getNextTerminalIndex(deckId: string) {
  let count = 0;
  terminals.forEach((session) => {
    if (session.deckId === deckId) {
      count += 1;
    }
  });
  return count + 1;
}

function createTerminalSession(deck: Deck, title?: string) {
  const id = crypto.randomUUID();
  const shell =
    process.env.SHELL ||
    (process.platform === 'win32' ? 'powershell.exe' : 'bash');
  const env = {
    ...process.env,
    TERM: process.env.TERM || 'xterm-256color'
  };
  const term = spawn(shell, [], {
    cwd: deck.root,
    cols: 120,
    rows: 32,
    env
  });
  const resolvedTitle = title || `Terminal ${getNextTerminalIndex(deck.id)}`;
  const session: TerminalSession = {
    id,
    deckId: deck.id,
    title: resolvedTitle,
    createdAt: new Date().toISOString(),
    term,
    sockets: new Set(),
    buffer: '',
    lastActive: Date.now(),
    dispose: null
  };
  session.dispose = term.onData((data) => {
    appendToTerminalBuffer(session, data);
    session.lastActive = Date.now();
    session.sockets.forEach((socket) => {
      if (socket.readyState === 1) {
        socket.send(data);
      }
    });
  });
  term.onExit(() => {
    session.sockets.forEach((socket) => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    });
    terminals.delete(id);
  });
  terminals.set(id, session);
  return session;
}

function resolveSafePath(workspacePath: string, inputPath = '') {
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(root, inputPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw createHttpError('Path escapes root', 400);
  }
  return resolved;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function handleError(c: Context, error: unknown) {
  const status = ((error as HttpError)?.status ?? 500) as ContentfulStatusCode;
  const message = getErrorMessage(error) || 'Unexpected error';
  return c.json({ error: message }, status);
}

async function readJson<T>(c: Context): Promise<T | null> {
  try {
    return await c.req.json<T>();
  } catch {
    return null;
  }
}

function loadPersistedState() {
  const workspaceRows = db
    .prepare(
      'SELECT id, name, path, created_at FROM workspaces ORDER BY created_at ASC'
    )
    .all();
  workspaceRows.forEach((row) => {
    const id = String(row.id);
    const name = String(row.name);
    const workspacePath = String(row.path);
    const createdAt = String(row.created_at);
    const workspace: Workspace = {
      id,
      name,
      path: workspacePath,
      createdAt
    };
    workspaces.set(id, workspace);
    workspacePathIndex.set(getWorkspaceKey(workspacePath), id);
  });

  const deckRows = db
    .prepare(
      'SELECT id, name, root, workspace_id, created_at FROM decks ORDER BY created_at ASC'
    )
    .all();
  deckRows.forEach((row) => {
    const workspaceId = String(row.workspace_id);
    if (!workspaces.has(workspaceId)) return;
    const deck: Deck = {
      id: String(row.id),
      name: String(row.name),
      root: String(row.root),
      workspaceId,
      createdAt: String(row.created_at)
    };
    decks.set(deck.id, deck);
  });
}

loadPersistedState();

app.get('/api/workspaces', (c) => {
  return c.json(Array.from(workspaces.values()));
});

app.post('/api/workspaces', async (c) => {
  try {
    const body = await readJson<{ path?: string; name?: string }>(c);
    if (!body?.path) {
      throw createHttpError('path is required', 400);
    }
    const workspace = createWorkspace(body.path, body.name);
    return c.json(workspace, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.get('/api/config', (c) => {
  return c.json({ defaultRoot: normalizeWorkspacePath(DEFAULT_ROOT) });
});

app.get('/api/decks', (c) => {
  return c.json(Array.from(decks.values()));
});

app.post('/api/decks', async (c) => {
  try {
    const body = await readJson<{ name?: string; workspaceId?: string }>(c);
    const workspaceId = body?.workspaceId;
    if (!workspaceId) {
      throw createHttpError('workspaceId is required', 400);
    }
    const deck = createDeck(body?.name, workspaceId);
    return c.json(deck, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.get('/api/terminals', (c) => {
  const deckId = c.req.query('deckId');
  if (!deckId) {
    return c.json({ error: 'deckId is required' }, 400);
  }
  const sessions: Array<{ id: string; title: string; createdAt: string }> = [];
  terminals.forEach((session) => {
    if (session.deckId === deckId) {
      sessions.push({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt
      });
    }
  });
  sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return c.json(sessions);
});

app.get('/api/files', async (c) => {
  try {
    const workspaceId = c.req.query('workspaceId');
    if (!workspaceId) {
      throw createHttpError('workspaceId is required', 400);
    }
    const workspace = requireWorkspace(workspaceId);
    const requestedPath = c.req.query('path') || '';
    const target = resolveSafePath(workspace.path, requestedPath);
    const stats = await fs.stat(target);
    if (!stats.isDirectory()) {
      throw createHttpError('Path is not a directory', 400);
    }
    const entries = await fs.readdir(target, { withFileTypes: true });
    const normalizedBase = requestedPath.replace(/\\/g, '/');
    const mapped = entries.map((entry) => {
      const entryPath = normalizedBase
        ? `${normalizedBase}/${entry.name}`
        : entry.name;
      return {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'dir' : 'file'
      };
    });
    mapped.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return c.json(mapped);
  } catch (error) {
    return handleError(c, error);
  }
});

app.get('/api/preview', async (c) => {
  try {
    const rootInput = c.req.query('path') || DEFAULT_ROOT;
    const requestedPath = c.req.query('subpath') || '';
    const rootPath = normalizeWorkspacePath(rootInput);
    const target = resolveSafePath(rootPath, requestedPath);
    const stats = await fs.stat(target);
    if (!stats.isDirectory()) {
      throw createHttpError('Path is not a directory', 400);
    }
    const entries = await fs.readdir(target, { withFileTypes: true });
    const normalizedBase = String(requestedPath || '').replace(/\\/g, '/');
    const mapped = entries.map((entry) => {
      const entryPath = normalizedBase
        ? `${normalizedBase}/${entry.name}`
        : entry.name;
      return {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'dir' : 'file'
      };
    });
    mapped.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return c.json(mapped);
  } catch (error) {
    return handleError(c, error);
  }
});

app.get('/api/file', async (c) => {
  try {
    const workspaceId = c.req.query('workspaceId');
    if (!workspaceId) {
      throw createHttpError('workspaceId is required', 400);
    }
    const workspace = requireWorkspace(workspaceId);
    const target = resolveSafePath(workspace.path, c.req.query('path') || '');
    const contents = await fs.readFile(target, 'utf8');
    return c.json({ path: c.req.query('path'), contents });
  } catch (error) {
    return handleError(c, error);
  }
});

app.put('/api/file', async (c) => {
  try {
    const body = await readJson<{
      workspaceId?: string;
      path?: string;
      contents?: string;
    }>(c);
    const workspaceId = body?.workspaceId;
    if (!workspaceId) {
      throw createHttpError('workspaceId is required', 400);
    }
    const workspace = requireWorkspace(workspaceId);
    const target = resolveSafePath(workspace.path, body?.path || '');
    const contents = body?.contents ?? '';
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents, 'utf8');
    return c.json({ path: body?.path, saved: true });
  } catch (error) {
    return handleError(c, error);
  }
});

app.post('/api/terminals', async (c) => {
  try {
    const body = await readJson<{ deckId?: string; title?: string }>(c);
    const deckId = body?.deckId;
    if (!deckId || !decks.has(deckId)) {
      throw createHttpError('deckId is required', 400);
    }
    const deck = decks.get(deckId);
    if (!deck) {
      throw createHttpError('deck not found', 404);
    }
    const session = createTerminalSession(deck, body?.title);
    return c.json({ id: session.id, title: session.title }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

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

const server = serve({ fetch: app.fetch, port: PORT });
const wss = new WebSocketServer({ server });

wss.on('connection', (socket, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const match = url.pathname.match(/\/api\/terminals\/(.+)/);
  if (!match) {
    socket.close();
    return;
  }
  const id = match[1];
  const session = terminals.get(id);
  if (!session) {
    socket.close();
    return;
  }

  session.sockets.add(socket);
  session.lastActive = Date.now();
  if (session.buffer) {
    socket.send(session.buffer);
  }

  socket.on('message', (data) => {
    session.lastActive = Date.now();
    const message = data.toString();
    if (message.startsWith('\u0000resize:')) {
      const payload = message.slice('\u0000resize:'.length);
      const [colsRaw, rowsRaw] = payload.split(',');
      const cols = Number(colsRaw);
      const rows = Number(rowsRaw);
      if (Number.isFinite(cols) && Number.isFinite(rows)) {
        session.term.resize(cols, rows);
      }
      return;
    }
    session.term.write(message);
  });

  socket.on('close', () => {
    session.sockets.delete(socket);
    session.lastActive = Date.now();
  });
});

setInterval(() => {
  const now = Date.now();
  terminals.forEach((session, id) => {
    if (
      session.sockets.size === 0 &&
      now - session.lastActive > TERMINAL_IDLE_TIMEOUT_MS
    ) {
      session.dispose?.dispose();
      session.term.kill();
      terminals.delete(id);
    }
  });
}, 60_000).unref();

server.on('listening', () => {
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`Deck IDE server listening on ${baseUrl}`);
  console.log(`UI: ${baseUrl}`);
  console.log(`API: ${baseUrl}/api`);
});
