import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn } from 'node-pty';

const DEFAULT_ROOT = process.env.DEFAULT_ROOT || 'C:/workspace';
const PORT = Number(process.env.PORT || 8787);

const app = express();
app.use(express.json({ limit: '2mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', '..', 'web', 'dist');
const hasStatic = fsSync.existsSync(distDir);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const decks = new Map();
const terminals = new Map();

function createDeck(name) {
  const deck = {
    id: crypto.randomUUID(),
    name: name || `Deck ${decks.size + 1}`,
    root: DEFAULT_ROOT,
    createdAt: new Date().toISOString()
  };
  decks.set(deck.id, deck);
  return deck;
}

function resolveSafePath(inputPath = '') {
  const root = path.resolve(DEFAULT_ROOT);
  const resolved = path.resolve(root, inputPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    const error = new Error('Path escapes root');
    error.status = 400;
    throw error;
  }
  return resolved;
}

function handleError(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    error: error.message || 'Unexpected error'
  });
}

createDeck('Core');

app.get('/api/decks', (req, res) => {
  res.json(Array.from(decks.values()));
});

app.post('/api/decks', (req, res) => {
  const deck = createDeck(req.body?.name);
  res.status(201).json(deck);
});

app.get('/api/files', async (req, res) => {
  try {
    const requestedPath = req.query.path || '';
    const target = resolveSafePath(requestedPath);
    const stats = await fs.stat(target);
    if (!stats.isDirectory()) {
      const error = new Error('Path is not a directory');
      error.status = 400;
      throw error;
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
    res.json(mapped);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/file', async (req, res) => {
  try {
    const target = resolveSafePath(req.query.path || '');
    const contents = await fs.readFile(target, 'utf8');
    res.json({ path: req.query.path, contents });
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/file', async (req, res) => {
  try {
    const target = resolveSafePath(req.body?.path || '');
    const contents = req.body?.contents ?? '';
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents, 'utf8');
    res.json({ path: req.body?.path, saved: true });
  } catch (error) {
    handleError(res, error);
  }
});

if (hasStatic) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.sendStatus(404);
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.post('/api/terminals', (req, res) => {
  const id = crypto.randomUUID();
  const shell =
    process.env.SHELL ||
    (process.platform === 'win32' ? 'powershell.exe' : 'bash');
  const term = spawn(shell, [], {
    cwd: DEFAULT_ROOT,
    cols: 120,
    rows: 32,
    env: process.env
  });
  terminals.set(id, term);
  res.status(201).json({ id });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (socket, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const match = url.pathname.match(/\/api\/terminals\/(.+)/);
  if (!match) {
    socket.close();
    return;
  }
  const id = match[1];
  const term = terminals.get(id);
  if (!term) {
    socket.close();
    return;
  }

  term.onData((data) => {
    socket.send(data);
  });

  socket.on('message', (data) => {
    term.write(data.toString());
  });

  socket.on('close', () => {
    term.kill();
    terminals.delete(id);
  });
});

server.listen(PORT, () => {
  const baseUrl = `http://localhost:${PORT}`;
  console.log(`Deck IDE server listening on ${baseUrl}`);
  console.log(`UI: ${baseUrl}`);
  console.log(`API: ${baseUrl}/api`);
});
