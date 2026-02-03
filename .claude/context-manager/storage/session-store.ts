import * as fs from "node:fs";
import * as path from "node:path";
import { sync as mkdirpSync } from "mkdirp";
import type { ClaudeSession } from "../types";

/**
 * Session storage layer with fsync for data safety
 */
export class SessionStore {
  private readonly sessionsDir: string;

  constructor(baseDir: string = ".claude") {
    this.sessionsDir = path.join(baseDir, "sessions");
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      mkdirpSync(this.sessionsDir);
    }
  }

  private getPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Create a new session with initial prompt
   */
  create(sessionId: string, initialPrompt: string): ClaudeSession {
    const now = new Date().toISOString();
    const session: ClaudeSession = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      metadata: {
        initialPrompt,
        phase: "initialization",
        healthScore: 1.0,
      },
      metrics: {
        totalTokens: 0,
        messageCount: 0,
        errorCount: 0,
        retryCount: 0,
        driftScore: 0.0,
      },
      topicTracking: {
        keywords: [],
        filePaths: [],
      },
      events: [
        {
          timestamp: now,
          type: "message",
          data: { prompt: initialPrompt },
        },
      ],
      snapshots: [],
    };

    this.write(sessionId, session);
    return session;
  }

  /**
   * Get session by ID, returns null if not found
   */
  get(sessionId: string): ClaudeSession | null {
    const filePath = this.getPath(sessionId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as ClaudeSession;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid session JSON for ${sessionId}: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  /**
   * Update session with partial data, automatically updates updatedAt
   */
  update(sessionId: string, updates: Partial<ClaudeSession>): void {
    const existing = this.get(sessionId);
    if (!existing) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const merged: ClaudeSession = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString(), // Update timestamp
    };

    this.write(sessionId, merged);
  }

  /**
   * Delete session by ID
   */
  delete(sessionId: string): void {
    const filePath = this.getPath(sessionId);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * List all sessions
   */
  list(): ClaudeSession[] {
    const sessions: ClaudeSession[] = [];

    if (!fs.existsSync(this.sessionsDir)) {
      return sessions;
    }

    const files = fs.readdirSync(this.sessionsDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const sessionId = file.slice(0, -5);
        const session = this.get(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
    }

    // Sort by createdAt descending (newest first)
    return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Get file path for a session (public accessor)
   */
  getPublicPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Write session data with fsync for durability
   */
  private write(sessionId: string, session: ClaudeSession): void {
    const filePath = this.getPath(sessionId);
    const tmpPath = `${filePath}.tmp`;
    let fd: number | null = null;

    try {
      // Write to temp file first
      const content = JSON.stringify(session, null, 2);
      fs.writeFileSync(tmpPath, content, "utf-8");

      // Sync to disk
      fd = fs.openSync(tmpPath, "r");
      fs.fsyncSync(fd);
    } finally {
      // Always close file descriptor
      if (fd !== null) {
        fs.closeSync(fd);
      }
    }

    try {
      // Atomic rename
      fs.renameSync(tmpPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
      throw error;
    }
  }
}
