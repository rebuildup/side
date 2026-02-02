/**
 * Context Controller for Claude Context Manager
 *
 * Orchestrates session management, monitoring, and control actions.
 */

import {
  ClaudeSession,
  ControllerStatus,
  HealthAnalysis,
  CompactResult,
  SnapshotRef,
  CompactOptions,
} from '../types';
import { SessionStore } from '../storage/session-store';
import { SessionMonitor } from './session-monitor';
import { SessionAnalyzer } from './session-analyzer';
import { createHash } from 'crypto';

/**
 * Context Controller
 *
 * Main orchestrator for session lifecycle and control actions.
 */
export class ContextController {
  private store: SessionStore;
  private monitor: SessionMonitor;
  private analyzer: SessionAnalyzer;
  private currentSessionId: string | null = null;

  constructor(
    store: SessionStore,
    monitor: SessionMonitor,
    analyzer: SessionAnalyzer
  ) {
    this.store = store;
    this.monitor = monitor;
    this.analyzer = analyzer;
  }

  /**
   * Create a new session
   */
  createSession(sessionId: string, initialPrompt: string): ClaudeSession {
    const session = this.store.create(sessionId, initialPrompt);
    this.monitor.setSession(session);
    this.currentSessionId = sessionId;
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): ClaudeSession | null {
    return this.store.get(sessionId);
  }

  /**
   * Get current active session
   */
  getCurrentSession(): ClaudeSession | null {
    if (!this.currentSessionId) {
      return null;
    }
    return this.getSession(this.currentSessionId);
  }

  /**
   * End a session
   */
  endSession(sessionId: string): void {
    if (this.currentSessionId === sessionId) {
      this.monitor.clearSession();
      this.currentSessionId = null;
    }

    // Update phase before deletion
    const session = this.store.get(sessionId);
    if (session) {
      this.store.update(sessionId, {
        metadata: {
          ...session.metadata,
          phase: 'ended',
        },
      });
    }

    // Note: We don't delete the session here, just mark as ended
    // This allows for historical analysis
  }

  /**
   * Track a message
   */
  trackMessage(role: 'user' | 'assistant', content: string): void {
    this.monitor.trackMessage(role, content);

    // Persist updated session
    this.persistCurrentSession();
  }

  /**
   * Track a tool execution
   */
  trackTool(name: string, args: unknown, result: unknown): void {
    this.monitor.trackTool(name, args, result);

    // Persist updated session
    this.persistCurrentSession();
  }

  /**
   * Track an error
   */
  trackError(error: Error | string): void {
    this.monitor.trackError(error);

    // Persist updated session
    this.persistCurrentSession();
  }

  /**
   * Get health score for current session
   */
  getHealthScore(): number {
    const session = this.getCurrentSession();
    if (!session) {
      return 1.0;
    }

    return session.metadata.healthScore;
  }

  /**
   * Get comprehensive status for current session
   */
  async getStatus(): Promise<ControllerStatus | null> {
    const session = this.getCurrentSession();
    if (!session) {
      return null;
    }

    return await this.analyzer.getStatus(session);
  }

  /**
   * Compact the current session
   */
  async compact(options?: CompactOptions): Promise<CompactResult> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session to compact');
    }

    const {
      keepLastN = 20,
      preserveErrors = true,
      preserveSnapshots = true,
      dryRun = false,
    } = options || {};

    const eventsBefore = session.events.length;
    const sizeBefore = JSON.stringify(session).length;

    // Filter events to keep
    const eventsToKeep: typeof session.events = [];

    // Always keep snapshot events if preserving
    if (preserveSnapshots) {
      eventsToKeep.push(
        ...session.events.filter(e => e.type === 'snapshot')
      );
    }

    // Always keep error events if preserving
    if (preserveErrors) {
      eventsToKeep.push(
        ...session.events.filter(e => e.type === 'error')
      );
    }

    // Keep last N events
    const recentEvents = session.events.slice(-keepLastN);
    eventsToKeep.push(...recentEvents);

    // Deduplicate by timestamp
    const uniqueEvents = Array.from(
      new Map(eventsToKeep.map(e => [e.timestamp, e])).values()
    );

    // Sort by timestamp
    uniqueEvents.sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    );

    const eventsRemoved = eventsBefore - uniqueEvents.length;

    if (!dryRun) {
      // Prepare compact event
      const compactEvent: typeof session.events[number] = {
        timestamp: new Date().toISOString(),
        type: 'compact',
        data: {
          eventsRemoved,
          eventsKept: uniqueEvents.length,
        },
      };

      // Single update with final state (no race condition)
      this.store.update(session.id, {
        events: [...uniqueEvents, compactEvent],
      });
    }

    const sizeAfter = dryRun
      ? sizeBefore
      : JSON.stringify(this.store.get(session.id)).length;

    return {
      eventsRemoved,
      eventsKept: uniqueEvents.length,
      sizeBefore,
      sizeAfter,
      compressionRatio: eventsBefore / uniqueEvents.length,
    };
  }

  /**
   * Create a snapshot of the current session
   */
  async createSnapshot(description?: string): Promise<SnapshotRef> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session to snapshot');
    }

    const snapshotRef: SnapshotRef = {
      commitHash: this.generateCommitHash(),
      timestamp: new Date().toISOString(),
      healthScore: session.metadata.healthScore,
      description: description || `Snapshot at ${new Date().toISOString()}`,
    };

    // Add snapshot to session
    const snapshots = [...session.snapshots, snapshotRef];
    this.store.update(session.id, { snapshots });

    // Record snapshot event
    const snapshotEvent: typeof session.events[number] = {
      timestamp: snapshotRef.timestamp,
      type: 'snapshot',
      data: {
        commitHash: snapshotRef.commitHash,
        description: snapshotRef.description,
      },
    };

    this.store.update(session.id, {
      events: [...session.events, snapshotEvent],
    });

    return snapshotRef;
  }

  /**
   * Restore a session from a snapshot
   */
  async restoreSnapshot(commitHash: string): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    const snapshot = session.snapshots.find(s => s.commitHash === commitHash);
    if (!snapshot) {
      throw new Error(`Snapshot ${commitHash} not found`);
    }

    // Restore health score from snapshot
    this.store.update(session.id, {
      metadata: {
        ...session.metadata,
        healthScore: snapshot.healthScore,
        phase: 'restored',
      },
    });

    // Record restore event
    const restoreEvent: typeof session.events[number] = {
      timestamp: new Date().toISOString(),
      type: 'snapshot',
      data: {
        action: 'restore',
        commitHash,
        fromHealthScore: session.metadata.healthScore,
        toHealthScore: snapshot.healthScore,
      },
    };

    this.store.update(session.id, {
      events: [...session.events, restoreEvent],
    });
  }

  /**
   * Persist current session to disk
   */
  private persistCurrentSession(): void {
    const session = this.monitor.getSession();
    if (session && this.currentSessionId) {
      this.store.update(this.currentSessionId, session);
    }
  }

  /**
   * Generate a crypto-based commit hash for snapshots
   */
  private generateCommitHash(): string {
    const hash = createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-${process.pid}`)
      .digest('hex');
    return hash.substring(0, 12);
  }

  /**
   * Update drift threshold
   */
  setDriftThreshold(threshold: number): void {
    this.analyzer.setDriftThreshold(threshold);
  }

  /**
   * Get drift threshold
   */
  getDriftThreshold(): number {
    return this.analyzer.getDriftThreshold();
  }
}
