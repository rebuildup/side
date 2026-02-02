/**
 * Snapshot Manager for Claude Context Manager
 *
 * Manages session snapshots for state preservation and restoration.
 */

import {
  ClaudeSession,
  SnapshotRef,
  SnapshotOptions,
} from '../types';
import { SessionStore } from '../storage/session-store';
import { createHash } from 'crypto';

/**
 * Snapshot Manager
 *
 * Handles creation, listing, and restoration of session snapshots.
 */
export class SnapshotManager {
  private store: SessionStore;

  constructor(store: SessionStore) {
    this.store = store;
  }

  /**
   * Create a snapshot for a session
   */
  async createSnapshot(
    sessionId: string,
    options: SnapshotOptions = {}
  ): Promise<SnapshotRef> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const {
      description,
      includeMetrics = true,
      includeEvents = true,
    } = options;

    const snapshotRef: SnapshotRef = {
      commitHash: this.generateCommitHash(),
      timestamp: new Date().toISOString(),
      healthScore: session.metadata.healthScore,
      description: description || `Snapshot at ${new Date().toISOString()}`,
    };

    // Add snapshot to session
    const snapshots = [...session.snapshots, snapshotRef];
    this.store.update(sessionId, { snapshots });

    // Record snapshot event
    const snapshotEvent = {
      timestamp: snapshotRef.timestamp,
      type: 'snapshot' as const,
      data: {
        commitHash: snapshotRef.commitHash,
        description: snapshotRef.description,
        includeMetrics,
        includeEvents,
        healthScore: snapshotRef.healthScore,
      },
    };

    this.store.update(sessionId, {
      events: [...session.events, snapshotEvent],
    });

    return snapshotRef;
  }

  /**
   * Get all snapshots for a session
   */
  getSnapshots(sessionId: string): SnapshotRef[] {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return [...session.snapshots];
  }

  /**
   * Get a specific snapshot by commit hash
   */
  getSnapshot(sessionId: string, commitHash: string): SnapshotRef | null {
    const snapshots = this.getSnapshots(sessionId);
    return snapshots.find(s => s.commitHash === commitHash) || null;
  }

  /**
   * Restore a session to a snapshot state
   */
  async restoreSnapshot(
    sessionId: string,
    commitHash: string
  ): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const snapshot = this.getSnapshot(sessionId, commitHash);
    if (!snapshot) {
      throw new Error(`Snapshot ${commitHash} not found for session ${sessionId}`);
    }

    // Restore health score from snapshot
    this.store.update(sessionId, {
      metadata: {
        ...session.metadata,
        healthScore: snapshot.healthScore,
        phase: 'restored',
      },
    });

    // Record restore event
    const restoreEvent = {
      timestamp: new Date().toISOString(),
      type: 'snapshot' as const,
      data: {
        action: 'restore',
        commitHash,
        fromHealthScore: session.metadata.healthScore,
        toHealthScore: snapshot.healthScore,
        snapshotDescription: snapshot.description,
      },
    };

    const updatedSession = this.store.get(sessionId);
    if (updatedSession) {
      this.store.update(sessionId, {
        events: [...updatedSession.events, restoreEvent],
      });
    }
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(sessionId: string, commitHash: string): void {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const snapshots = session.snapshots.filter(s => s.commitHash !== commitHash);
    this.store.update(sessionId, { snapshots });
  }

  /**
   * Find snapshots by health score range
   */
  findSnapshotsByHealth(
    sessionId: string,
    minScore: number,
    maxScore: number
  ): SnapshotRef[] {
    const snapshots = this.getSnapshots(sessionId);
    return snapshots.filter(
      s => s.healthScore >= minScore && s.healthScore <= maxScore
    );
  }

  /**
   * Find snapshots by time range
   */
  findSnapshotsByTime(
    sessionId: string,
    startTime: Date,
    endTime: Date
  ): SnapshotRef[] {
    const snapshots = this.getSnapshots(sessionId);
    const start = startTime.getTime();
    const end = endTime.getTime();

    return snapshots.filter(s => {
      const timestamp = new Date(s.timestamp).getTime();
      return timestamp >= start && timestamp <= end;
    });
  }

  /**
   * Get the latest snapshot for a session
   */
  getLatestSnapshot(sessionId: string): SnapshotRef | null {
    const snapshots = this.getSnapshots(sessionId);
    if (snapshots.length === 0) {
      return null;
    }

    // Return the most recent snapshot (last in array)
    return snapshots[snapshots.length - 1];
  }

  /**
   * Get the healthiest snapshot for a session
   */
  getHealthiestSnapshot(sessionId: string): SnapshotRef | null {
    const snapshots = this.getSnapshots(sessionId);
    if (snapshots.length === 0) {
      return null;
    }

    // Sort by health score descending and return the first
    return [...snapshots].sort((a, b) => b.healthScore - a.healthScore)[0];
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
}
