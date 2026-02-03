/**
 * Context Manager API Routes
 *
 * REST API endpoints for Claude Context Manager functionality.
 * Provides session management, health monitoring, compaction, and snapshot capabilities.
 */

import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { handleError, readJson } from "../utils/error.js";

// Context Manager singleton instance with lazy initialization
let contextManagerInstance: any = null;

// Lazy import the ContextManager to avoid initialization issues
// Use eval to bypass TypeScript analysis of the dynamic import
async function getContextManager() {
  if (!contextManagerInstance) {
    try {
      // Dynamic import using eval to completely bypass TypeScript type checking
      const importFn = new Function(
        'return import("../../../../.claude/context-manager/index.js")'
      );
      const contextManagerModule = await importFn();
      contextManagerInstance = contextManagerModule.createContextManager({
        sessionsDir: ".claude/sessions",
        autoCompactThreshold: 100,
        healthCheckInterval: 60000,
        driftThreshold: 0.7,
      });
      // Start auto-monitoring
      contextManagerInstance.start();
      console.log("[CONTEXT] Context Manager initialized and started");
    } catch (error) {
      console.error("Failed to initialize ContextManager:", error);
      return null;
    }
  }
  return contextManagerInstance;
}

// Response types for API

export interface ContextManagerStatus {
  sessionId: string | null;
  healthScore: number;
  driftScore: number;
  phase: string;
  messageCount: number;
  tokenCount: number;
  recommendations: string[];
  needsAttention: boolean;
}

export interface CreateSessionRequest {
  sessionId?: string;
  initialPrompt: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  createdAt: string;
}

export interface CompactResponse {
  originalEvents: number;
  remainingEvents: number;
  compactedEvents: number;
  summary: string;
  spaceSaved: number;
}

export interface SnapshotResponse {
  commitHash: string;
  timestamp: string;
  healthScore: number;
  description: string;
}

export interface SnapshotListResponse {
  snapshots: SnapshotResponse[];
  total: number;
}

/**
 * Create the Context Manager router
 *
 * Implements all required endpoints:
 * - GET /api/context-manager/status
 * - POST /api/context-manager/session
 * - POST /api/context-manager/compact
 * - POST /api/context-manager/snapshot
 * - GET /api/context-manager/snapshots
 */
export function createContextManagerRouter() {
  const router = new Hono();

  /**
   * GET /api/context-manager/status
   *
   * Get current health status of the context manager
   */
  router.get("/status", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json<ContextManagerStatus>(
          {
            sessionId: null,
            healthScore: 0,
            driftScore: 0,
            phase: "unavailable",
            messageCount: 0,
            tokenCount: 0,
            recommendations: ["Context manager not available"],
            needsAttention: true,
          },
          503
        );
      }

      const status = await cm.getStatus();
      const currentSession = cm.getCurrentSession();

      if (!status) {
        return c.json<ContextManagerStatus>({
          sessionId: null,
          healthScore: 100,
          driftScore: 0,
          phase: "idle",
          messageCount: 0,
          tokenCount: 0,
          recommendations: [],
          needsAttention: false,
        });
      }

      return c.json<ContextManagerStatus>({
        sessionId: currentSession?.id || null,
        healthScore: Math.round(status.healthScore * 100),
        driftScore: status.driftScore,
        phase: status.phase,
        messageCount: currentSession?.metrics.messageCount || 0,
        tokenCount: currentSession?.metrics.totalTokens || 0,
        recommendations: status.recommendations,
        needsAttention: status.healthScore < 0.5 || status.driftScore > 0.7,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/session
   *
   * Create a new session
   */
  router.post("/session", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const body = await readJson<CreateSessionRequest>(c);

      if (!body || !body.initialPrompt) {
        return c.json({ error: "initialPrompt is required" }, 400);
      }

      // Generate session ID if not provided
      const sessionId = body.sessionId || randomUUID();
      const createdAt = new Date().toISOString();

      // Create the session
      cm.createSession(sessionId, body.initialPrompt);

      return c.json<CreateSessionResponse>(
        {
          sessionId,
          createdAt,
        },
        201
      );
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/context-manager/session
   *
   * Get the current active session
   */
  router.get("/session", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const session = cm.getCurrentSession();

      if (!session) {
        return c.json({ error: "No active session" }, 404);
      }

      return c.json(session);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * DELETE /api/context-manager/session
   *
   * End the current session
   */
  router.delete("/session", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const currentSession = cm.getCurrentSession();

      if (!currentSession) {
        return c.json({ error: "No active session" }, 404);
      }

      cm.endSession(currentSession.id);

      return c.json({
        sessionId: currentSession.id,
        message: "Session ended successfully",
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/compact
   *
   * Trigger compaction of the current session
   */
  router.post("/compact", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const currentSession = cm.getCurrentSession();

      if (!currentSession) {
        return c.json({ error: "No active session to compact" }, 404);
      }

      // Read optional compaction options
      const body = await readJson<{
        keepRecentEvents?: number;
        compactThreshold?: number;
      }>(c);

      const result = await cm.compact({
        keepRecentEvents: body?.keepRecentEvents || 50,
        compactThreshold: body?.compactThreshold || 100,
      });

      return c.json<CompactResponse>({
        originalEvents: result.originalEvents,
        remainingEvents: result.remainingEvents,
        compactedEvents: result.compactedEvents,
        summary: result.summary,
        spaceSaved: result.spaceSaved,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/snapshot
   *
   * Create a snapshot of the current session
   */
  router.post("/snapshot", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const currentSession = cm.getCurrentSession();

      if (!currentSession) {
        return c.json({ error: "No active session to snapshot" }, 404);
      }

      // Read optional snapshot options
      const body = await readJson<{ description?: string }>(c);
      const snapshot = await cm.createSnapshot(body?.description);

      return c.json<SnapshotResponse>(
        {
          commitHash: snapshot.commitHash,
          timestamp: snapshot.timestamp,
          healthScore: snapshot.healthScore,
          description: snapshot.description,
        },
        201
      );
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/context-manager/snapshots
   *
   * List all snapshots for the current session
   */
  router.get("/snapshots", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const snapshots = cm.getSnapshots();

      return c.json<SnapshotListResponse>({
        snapshots: snapshots.map((s: SnapshotResponse) => ({
          commitHash: s.commitHash,
          timestamp: s.timestamp,
          healthScore: s.healthScore,
          description: s.description,
        })),
        total: snapshots.length,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/context-manager/snapshots/latest
   *
   * Get the latest snapshot
   */
  router.get("/snapshots/latest", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const snapshot = cm.getLatestSnapshot();

      if (!snapshot) {
        return c.json({ error: "No snapshots found" }, 404);
      }

      return c.json<SnapshotResponse>({
        commitHash: snapshot.commitHash,
        timestamp: snapshot.timestamp,
        healthScore: snapshot.healthScore,
        description: snapshot.description,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/context-manager/snapshots/healthiest
   *
   * Get the healthiest snapshot
   */
  router.get("/snapshots/healthiest", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const snapshot = cm.getHealthiestSnapshot();

      if (!snapshot) {
        return c.json({ error: "No snapshots found" }, 404);
      }

      return c.json<SnapshotResponse>({
        commitHash: snapshot.commitHash,
        timestamp: snapshot.timestamp,
        healthScore: snapshot.healthScore,
        description: snapshot.description,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/snapshots/:commitHash/restore
   *
   * Restore a session from a snapshot
   */
  router.post("/snapshots/:commitHash/restore", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const commitHash = c.req.param("commitHash");

      if (!commitHash) {
        return c.json({ error: "commitHash is required" }, 400);
      }

      await cm.restoreSnapshot(commitHash);

      return c.json({
        commitHash,
        message: "Snapshot restored successfully",
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/context-manager/stats
   *
   * Get overall statistics for all sessions
   */
  router.get("/stats", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const stats = cm.getStats();

      return c.json(stats);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/context-manager/sessions
   *
   * List all sessions
   */
  router.get("/sessions", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const sessions = cm.listSessions();

      return c.json({
        sessions,
        total: sessions.length,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/context-manager/sessions/:sessionId
   *
   * Get a specific session by ID
   */
  router.get("/sessions/:sessionId", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const sessionId = c.req.param("sessionId");

      if (!sessionId) {
        return c.json({ error: "sessionId is required" }, 400);
      }

      const session = cm.getSession(sessionId);

      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      return c.json(session);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * DELETE /api/context-manager/sessions/:sessionId
   *
   * Delete a specific session
   */
  router.delete("/sessions/:sessionId", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const sessionId = c.req.param("sessionId");

      if (!sessionId) {
        return c.json({ error: "sessionId is required" }, 400);
      }

      cm.deleteSession(sessionId);

      return c.json({
        sessionId,
        message: "Session deleted successfully",
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/track/message
   *
   * Track a user or assistant message
   */
  router.post("/track/message", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const body = await readJson<{ role: "user" | "assistant"; content: string }>(c);

      if (!body || !body.role || !body.content) {
        return c.json({ error: "role and content are required" }, 400);
      }

      cm.trackMessage(body.role, body.content);

      return c.json({
        role: body.role,
        message: "Message tracked successfully",
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/track/tool
   *
   * Track a tool execution
   */
  router.post("/track/tool", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const body = await readJson<{ name: string; args: unknown; result: unknown }>(c);

      if (!body || !body.name) {
        return c.json({ error: "name is required" }, 400);
      }

      cm.trackTool(body.name, body.args, body.result);

      return c.json({
        name: body.name,
        message: "Tool execution tracked successfully",
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/track/error
   *
   * Track an error
   */
  router.post("/track/error", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const body = await readJson<{ error: string | Error }>(c);

      if (!body || !body.error) {
        return c.json({ error: "error is required" }, 400);
      }

      cm.trackError(body.error);

      return c.json({
        message: "Error tracked successfully",
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/context-manager/drift
   *
   * Analyze topic drift for the current session
   */
  router.get("/drift", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const result = await cm.analyzeDrift();

      if (!result) {
        return c.json({
          driftScore: 0,
          needsDeepAnalysis: false,
          message: "No active session",
        });
      }

      return c.json(result);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/trim
   *
   * Trim conversation output
   */
  router.post("/trim", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      const currentSession = cm.getCurrentSession();

      if (!currentSession) {
        return c.json({ error: "No active session" }, 404);
      }

      // Read optional trim options
      const body = await readJson<{
        maxOutputLength?: number;
        trimMethod?: "truncate" | "ellipsis" | "smart";
      }>(c);

      const result = cm.trimOutput(body || {});

      if (!result) {
        return c.json({ error: "Failed to trim output" }, 500);
      }

      return c.json(result);
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/start
   *
   * Start auto-monitoring
   */
  router.post("/start", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      cm.start();
      return c.json({ success: true, monitoring: cm.isMonitoring() });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/context-manager/stop
   *
   * Stop auto-monitoring
   */
  router.post("/stop", async (c) => {
    try {
      const cm = await getContextManager();
      if (!cm) {
        return c.json({ error: "Context manager not available" }, 503);
      }

      cm.stop();
      return c.json({ success: true, monitoring: cm.isMonitoring() });
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
