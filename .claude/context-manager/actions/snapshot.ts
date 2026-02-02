/**
 * Snapshot Manager with Git Integration
 *
 * Provides Git-based snapshot functionality for Claude sessions:
 * - Create snapshots as Git commits
 * - List snapshots for a session
 * - Restore to a specific snapshot
 * - Get diff between snapshots
 * - Auto-snapshot on high health scores
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import type { SnapshotRef } from '../types';

const execAsync = promisify(exec);

/**
 * Validate session ID to prevent command injection
 */
function validateSessionId(sessionId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error(`Invalid sessionId: ${sessionId}`);
  }
}

/**
 * Result of a snapshot creation operation
 */
export interface SnapshotResult {
  success: boolean;
  commitHash?: string;
  error?: string;
}

/**
 * Result of a restore operation
 */
export interface RestoreResult {
  success: boolean;
  commitHash?: string;
  error?: string;
}

/**
 * Git command execution result
 */
interface GitResult {
  stdout: string;
  stderr: string;
}

/**
 * Snapshot Manager
 *
 * Manages Git-based snapshots for Claude sessions with automatic
 * snapshot creation based on health scores and manual triggers.
 */
export class SnapshotManager {
  private readonly baseDir: string;
  private readonly sessionsDir: string;
  private readonly commitPrefix = '[ctxmgr]';
  private readonly autoSnapshotThreshold = 80;

  constructor(baseDir: string = '.claude') {
    this.baseDir = path.resolve(baseDir);
    this.sessionsDir = path.join(this.baseDir, 'sessions');
  }

  /**
   * Check if Git is available and the directory is a Git repository
   */
  private async checkGitAvailable(): Promise<boolean> {
    try {
      await execAsync('git --version', { cwd: this.baseDir });
      await execAsync('git rev-parse --git-dir', { cwd: this.baseDir });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a Git command in the base directory
   */
  private async gitCommand(args: string[]): Promise<GitResult> {
    const command = `git ${args.join(' ')}`;
    return execAsync(command, { cwd: this.baseDir });
  }

  /**
   * Get the short commit hash (7 characters)
   */
  private getShortHash(fullHash: string): string {
    return fullHash.trim().substring(0, 7);
  }

  /**
   * Format commit message for a snapshot
   */
  private formatCommitMessage(sessionId: string, description: string): string {
    const desc = description || 'Session snapshot';
    return `${this.commitPrefix} ${sessionId} - ${desc}`;
  }

  /**
   * Get session file path for a session ID
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Read session data from file
   */
  private readSession(sessionId: string): Record<string, unknown> | null {
    const sessionPath = this.getSessionPath(sessionId);
    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(sessionPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Write session data with snapshot reference
   */
  private writeSession(sessionId: string, sessionData: Record<string, unknown>): void {
    const sessionPath = this.getSessionPath(sessionId);
    const tmpPath = `${sessionPath}.tmp`;

    try {
      // Ensure directory exists
      const sessionsDir = path.dirname(sessionPath);
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }

      // Write to temp file first
      const content = JSON.stringify(sessionData, null, 2);
      fs.writeFileSync(tmpPath, content, 'utf-8');

      // Atomic rename
      fs.renameSync(tmpPath, sessionPath);
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
      throw error;
    }
  }

  /**
   * Get current health score from session data
   */
  private getHealthScore(sessionData: Record<string, unknown>): number {
    return (sessionData.metadata as { healthScore?: number })?.healthScore ?? 0;
  }

  /**
   * Get snapshots array from session data
   */
  private getSnapshots(sessionData: Record<string, unknown>): SnapshotRef[] {
    return (sessionData.snapshots as SnapshotRef[]) ?? [];
  }

  /**
   * Create a snapshot (Git commit) for a session
   *
   * @param sessionId - The session ID to snapshot
   * @param description - Optional description for the snapshot
   * @returns Promise resolving to SnapshotRef or throwing error
   */
  async createSnapshot(sessionId: string, description?: string): Promise<SnapshotRef> {
    // Validate session ID to prevent command injection
    validateSessionId(sessionId);

    // Check if Git is available
    const gitAvailable = await this.checkGitAvailable();
    if (!gitAvailable) {
      throw new Error('Git is not available or not a Git repository');
    }

    // Read current session data
    const sessionData = this.readSession(sessionId);
    if (!sessionData) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const healthScore = this.getHealthScore(sessionData);
    const now = new Date().toISOString();

    try {
      // Stage the session file
      const sessionPath = this.getSessionPath(sessionId);
      await this.gitCommand(['add', '--force', sessionPath]);

      // Create commit
      const commitMessage = this.formatCommitMessage(sessionId, description ?? 'Auto snapshot');
      await this.gitCommand(['commit', '-m', commitMessage]);

      // Get the commit hash
      const logResult = await this.gitCommand(['log', '-1', '--format=%H']);
      const commitHash = this.getShortHash(logResult.stdout);

      // Create snapshot reference
      const snapshot: SnapshotRef = {
        commitHash,
        timestamp: now,
        healthScore,
        description: description ?? 'Auto snapshot',
      };

      // Add snapshot to session data
      const snapshots = this.getSnapshots(sessionData);
      snapshots.push(snapshot);
      sessionData.snapshots = snapshots;

      // Write updated session data
      this.writeSession(sessionId, sessionData);

      // Stage and commit the updated session data
      await this.gitCommand(['add', '--force', sessionPath]);
      await this.gitCommand(['commit', '-m', `${this.commitPrefix} ${sessionId} - Add snapshot reference`]);

      return snapshot;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create snapshot: ${errorMessage}`);
    }
  }

  /**
   * List all snapshots for a session
   *
   * @param sessionId - The session ID to list snapshots for
   * @returns Array of SnapshotRef objects
   */
  listSnapshots(sessionId: string): SnapshotRef[] {
    validateSessionId(sessionId);

    const sessionData = this.readSession(sessionId);
    if (!sessionData) {
      return [];
    }

    return this.getSnapshots(sessionData);
  }

  /**
   * Restore to a specific snapshot
   *
   * @param sessionId - The session ID to restore
   * @param commitHash - The commit hash to restore to
   * @returns Promise that resolves when restore is complete
   */
  async restoreSnapshot(sessionId: string, commitHash: string): Promise<void> {
    validateSessionId(sessionId);

    // Check if Git is available
    const gitAvailable = await this.checkGitAvailable();
    if (!gitAvailable) {
      throw new Error('Git is not available or not a Git repository');
    }

    try {
      // Checkout the session file at the specified commit
      const sessionPath = this.getSessionPath(sessionId);

      // First, check if the commit exists
      try {
        await this.gitCommand(['cat-file', '-t', commitHash]);
      } catch {
        throw new Error(`Commit ${commitHash} not found`);
      }

      // Checkout the specific file at the commit
      await this.gitCommand(['checkout', commitHash, '--', sessionPath]);

      // Record the restore event
      const sessionData = this.readSession(sessionId);
      if (sessionData) {
        const events = (sessionData.events as { timestamp: string; type: string; data: unknown }[]) ?? [];
        events.push({
          timestamp: new Date().toISOString(),
          type: 'snapshot',
          data: { action: 'restore', commitHash },
        });
        sessionData.events = events;
        this.writeSession(sessionId, sessionData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to restore snapshot: ${errorMessage}`);
    }
  }

  /**
   * Get diff between two snapshots
   *
   * @param sessionId - The session ID to diff
   * @param from - The starting commit hash
   * @param to - The ending commit hash (defaults to HEAD)
   * @returns Promise resolving to diff string
   */
  async diff(sessionId: string, from: string, to?: string): Promise<string> {
    validateSessionId(sessionId);

    // Check if Git is available
    const gitAvailable = await this.checkGitAvailable();
    if (!gitAvailable) {
      throw new Error('Git is not available or not a Git repository');
    }

    try {
      const sessionPath = this.getSessionPath(sessionId);
      const toCommit = to ?? 'HEAD';

      // Get diff between commits for the session file
      const diffResult = await this.gitCommand(['diff', `${from}..${toCommit}`, '--', sessionPath]);

      return diffResult.stdout || 'No differences found';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get diff: ${errorMessage}`);
    }
  }

  /**
   * Check if auto-snapshot should be triggered
   *
   * @param sessionId - The session ID to check
   * @returns Promise resolving to snapshot creation result
   */
  async shouldAutoSnapshot(sessionId: string): Promise<boolean> {
    validateSessionId(sessionId);

    const sessionData = this.readSession(sessionId);
    if (!sessionData) {
      return false;
    }

    const healthScore = this.getHealthScore(sessionData);
    return healthScore >= this.autoSnapshotThreshold;
  }

  /**
   * Create auto-snapshot if conditions are met
   *
   * @param sessionId - The session ID to snapshot
   * @returns Promise resolving to SnapshotResult
   */
  async createAutoSnapshot(sessionId: string): Promise<SnapshotResult> {
    validateSessionId(sessionId);

    try {
      const shouldSnapshot = await this.shouldAutoSnapshot(sessionId);
      if (!shouldSnapshot) {
        return {
          success: false,
          error: `Health score below threshold (${this.autoSnapshotThreshold})`,
        };
      }

      const snapshot = await this.createSnapshot(sessionId, `Auto snapshot (health score: ${this.getHealthScore(this.readSession(sessionId)!)})`);

      return {
        success: true,
        commitHash: snapshot.commitHash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create a pre-compaction snapshot
   *
   * Called before major compaction operations to preserve state
   *
   * @param sessionId - The session ID to snapshot
   * @returns Promise resolving to SnapshotResult
   */
  async createPreCompactionSnapshot(sessionId: string): Promise<SnapshotResult> {
    validateSessionId(sessionId);

    try {
      const snapshot = await this.createSnapshot(sessionId, 'Pre-compaction snapshot');

      return {
        success: true,
        commitHash: snapshot.commitHash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get all snapshot commits for a session from Git log
   *
   * @param sessionId - The session ID to query
   * @returns Promise resolving to array of commit info objects
   */
  async getSnapshotCommits(sessionId: string): Promise<
    Array<{
      hash: string;
      message: string;
      timestamp: string;
    }>
  > {
    validateSessionId(sessionId);

    // Check if Git is available
    const gitAvailable = await this.checkGitAvailable();
    if (!gitAvailable) {
      return [];
    }

    try {
      const pattern = `${this.commitPrefix} ${sessionId}`;
      const logResult = await this.gitCommand([
        'log',
        '--all',
        '--grep',
        `^${pattern}`,
        '--format=%H|%s|%ai',
      ]);

      if (!logResult.stdout.trim()) {
        return [];
      }

      const commits = logResult.stdout
        .trim()
        .split('\n')
        .filter(line => line.includes(pattern))
        .map(line => {
          const [hash, message, timestamp] = line.split('|');
          return {
            hash: this.getShortHash(hash),
            message: message.replace(`${this.commitPrefix} ${sessionId} - `, ''),
            timestamp,
          };
        });

      return commits;
    } catch {
      return [];
    }
  }

  /**
   * Delete a snapshot reference from session data
   *
   * Note: This does not delete the Git commit (Git history is immutable),
   * only removes the reference from the session's snapshots array.
   *
   * @param sessionId - The session ID
   * @param commitHash - The commit hash to remove reference for
   * @returns true if removed, false if not found
   */
  deleteSnapshotReference(sessionId: string, commitHash: string): boolean {
    validateSessionId(sessionId);

    const sessionData = this.readSession(sessionId);
    if (!sessionData) {
      return false;
    }

    const snapshots = this.getSnapshots(sessionData);
    const initialLength = snapshots.length;

    // Filter out the snapshot with matching commit hash
    sessionData.snapshots = snapshots.filter(s => s.commitHash !== commitHash);

    if (sessionData.snapshots.length < initialLength) {
      this.writeSession(sessionId, sessionData);
      return true;
    }

    return false;
  }
}

/**
 * Default snapshot manager instance
 */
export const defaultSnapshotManager = new SnapshotManager();
