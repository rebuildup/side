import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { Workspace } from '../types.js';
import { DEFAULT_ROOT } from '../config.js';
import { createHttpError, handleError, readJson } from '../utils/error.js';
import { normalizeWorkspacePath, getWorkspaceKey, getWorkspaceName } from '../utils/path.js';

export function createWorkspaceRouter(
  db: DatabaseSync,
  workspaces: Map<string, Workspace>,
  workspacePathIndex: Map<string, string>
) {
  const router = new Hono();

  const insertWorkspace = db.prepare(
    'INSERT INTO workspaces (id, name, path, normalized_path, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  function createWorkspace(inputPath: string, name?: string): Workspace {
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

  router.get('/', (c) => {
    return c.json(Array.from(workspaces.values()));
  });

  router.post('/', async (c) => {
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

  return router;
}

export function getConfigHandler() {
  return (c: any) => {
    return c.json({ defaultRoot: normalizeWorkspacePath(DEFAULT_ROOT) });
  };
}

export function requireWorkspace(workspaces: Map<string, Workspace>, workspaceId: string): Workspace {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    throw createHttpError('Workspace not found', 404);
  }
  return workspace;
}
