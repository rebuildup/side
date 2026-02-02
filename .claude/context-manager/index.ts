/**
 * Claude Context Manager
 *
 * Main entry point for session management, monitoring, and control.
 */

import {
  ClaudeSession,
  ContextManagerOptions,
  ControllerStatus,
  CompactResult,
  SnapshotRef,
  CompactOptions,
  SnapshotOptions,
  SessionStats,
} from './types';

// Core components
import { SessionStore } from './storage/session-store';
import { SessionMonitor } from './core/session-monitor';
import { SessionAnalyzer } from './core/session-analyzer';
import { ContextController } from './core/context-controller';
import { SnapshotManager } from './core/snapshot-manager';
import { OutputTrimmer } from './core/output-trimmer';
import { SessionCompactor } from './core/session-compactor';
import { TopicDriftDetector } from './detectors/topic-drift';

/**
 * Default options for ContextManager
 */
const DEFAULT_OPTIONS: Required<ContextManagerOptions> = {
  sessionsDir: '.claude/sessions',
  autoCompactThreshold: 100,
  healthCheckInterval: 60000,
  driftThreshold: 0.7,
};

/**
 * Context Manager
 *
 * Main class for managing Claude sessions with monitoring, analysis, and control.
 * Implements session lifecycle, health tracking, and automatic maintenance.
 */
export class ContextManager {
  private readonly store: SessionStore;
  private readonly monitor: SessionMonitor;
  private readonly analyzer: SessionAnalyzer;
  private readonly controller: ContextController;
  private readonly snapshotManager: SnapshotManager;
  private readonly trimmer: OutputTrimmer;
  private readonly compactor: SessionCompactor;
  private readonly driftDetector: TopicDriftDetector;

  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private currentSessionId: string | null = null;
  private isRunning: boolean = false;

  constructor(options: ContextManagerOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    this.store = new SessionStore(opts.sessionsDir);
    this.monitor = new SessionMonitor();
    this.analyzer = new SessionAnalyzer(opts.driftThreshold);
    this.controller = new ContextController(this.store, this.monitor, this.analyzer);
    this.snapshotManager = new SnapshotManager(this.store);
    this.trimmer = new OutputTrimmer();
    this.compactor = new SessionCompactor();
    this.driftDetector = new TopicDriftDetector();
  }

  // ==================== Session Lifecycle ====================

  /**
   * Create a new session with an initial prompt
   */
  createSession(sessionId: string, initialPrompt: string): void {
    const session = this.controller.createSession(sessionId, initialPrompt);
    this.currentSessionId = sessionId;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): ClaudeSession | null {
    return this.controller.getSession(sessionId);
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): ClaudeSession | null {
    return this.controller.getCurrentSession();
  }

  /**
   * End a session
   */
  endSession(sessionId: string): void {
    this.controller.endSession(sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  /**
   * Delete a session permanently
   */
  deleteSession(sessionId: string): void {
    if (this.currentSessionId === sessionId) {
      this.monitor.clearSession();
      this.currentSessionId = null;
    }
    this.store.delete(sessionId);
  }

  /**
   * List all sessions
   */
  listSessions(): ClaudeSession[] {
    return this.store.list();
  }

  // ==================== Monitoring ====================

  /**
   * Track a user or assistant message
   */
  trackMessage(role: 'user' | 'assistant', content: string): void {
    this.controller.trackMessage(role, content);
  }

  /**
   * Track a tool execution
   */
  trackTool(name: string, args: unknown, result: unknown): void {
    this.controller.trackTool(name, args, result);
  }

  /**
   * Track an error
   */
  trackError(error: Error | string): void {
    this.controller.trackError(error);
  }

  // ==================== Analysis ====================

  /**
   * Get the current health score (0-1, higher is better)
   */
  getHealthScore(): number {
    return this.controller.getHealthScore();
  }

  /**
   * Get comprehensive controller status
   */
  async getStatus(): Promise<ControllerStatus | null> {
    return await this.controller.getStatus();
  }

  /**
   * Analyze topic drift for current session
   */
  async analyzeDrift(): Promise<{ driftScore: number; needsDeepAnalysis: boolean } | null> {
    const session = this.getCurrentSession();
    if (!session) {
      return null;
    }

    const result = await this.driftDetector.detect(session);
    return {
      driftScore: result.driftScore,
      needsDeepAnalysis: result.needsDeepAnalysis,
    };
  }

  // ==================== Actions ====================

  /**
   * Compact the current session to reduce storage
   */
  async compact(options?: CompactOptions): Promise<CompactResult> {
    return await this.controller.compact(options);
  }

  /**
   * Create a snapshot of the current session
   */
  async createSnapshot(description?: string): Promise<SnapshotRef> {
    return await this.controller.createSnapshot(description);
  }

  /**
   * Restore a session from a snapshot
   */
  async restoreSnapshot(commitHash: string): Promise<void> {
    await this.controller.restoreSnapshot(commitHash);
  }

  /**
   * Trim conversation output
   */
  trimOutput(customOptions?: Parameters<OutputTrimmer['trim']>[1]): ReturnType<OutputTrimmer['trim']> | null {
    const session = this.getCurrentSession();
    if (!session) {
      return null;
    }
    return this.trimmer.trim(session, customOptions);
  }

  // ==================== Statistics ====================

  /**
   * Get session statistics
   */
  getStats(): SessionStats {
    const sessions = this.store.list();
    const activeSessions = sessions.filter(s => s.metadata.phase !== 'ended');

    const totalEvents = sessions.reduce((sum, s) => sum + s.events.length, 0);
    const totalSnapshots = sessions.reduce((sum, s) => sum + s.snapshots.length, 0);
    const avgHealthScore =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.metadata.healthScore, 0) / sessions.length
        : 0;

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      totalEvents,
      totalSnapshots,
      avgHealthScore,
    };
  }

  // ==================== Auto-Monitoring ====================

  /**
   * Start auto-monitoring with periodic health checks
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Set up health check interval
    const options = this.getOptions();
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, options.healthCheckInterval);
  }

  /**
   * Stop auto-monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Check if auto-monitoring is running
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }

  /**
   * Perform a health check and take automatic actions
   */
  private async performHealthCheck(): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) {
      return;
    }

    const status = await this.getStatus();
    if (!status) {
      return;
    }

    // Auto-compact if event count exceeds threshold
    const options = this.getOptions();
    if (session.events.length > options.autoCompactThreshold) {
      await this.compact();
    }

    // Auto-snapshot if health score drops significantly
    if (status.healthScore < 0.5 && session.snapshots.length === 0) {
      await this.createSnapshot('Auto-snapshot: Low health score');
    }
  }

  // ==================== Configuration ====================

  /**
   * Get current options
   */
  private getOptions(): Required<ContextManagerOptions> {
    return {
      sessionsDir: this.store['sessionsDir'] || DEFAULT_OPTIONS.sessionsDir,
      autoCompactThreshold: DEFAULT_OPTIONS.autoCompactThreshold,
      healthCheckInterval: DEFAULT_OPTIONS.healthCheckInterval,
      driftThreshold: this.analyzer.getDriftThreshold(),
    };
  }

  /**
   * Update drift threshold
   */
  setDriftThreshold(threshold: number): void {
    this.controller.setDriftThreshold(threshold);
  }

  /**
   * Get current drift threshold
   */
  getDriftThreshold(): number {
    return this.controller.getDriftThreshold();
  }

  // ==================== Snapshot Management ====================

  /**
   * Get all snapshots for current session
   */
  getSnapshots(): SnapshotRef[] {
    const session = this.getCurrentSession();
    if (!session) {
      return [];
    }
    return this.snapshotManager.getSnapshots(session.id);
  }

  /**
   * Create a snapshot for current session
   */
  async createSessionSnapshot(options?: SnapshotOptions): Promise<SnapshotRef> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }
    return await this.snapshotManager.createSnapshot(session.id, options);
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): SnapshotRef | null {
    const session = this.getCurrentSession();
    if (!session) {
      return null;
    }
    return this.snapshotManager.getLatestSnapshot(session.id);
  }

  /**
   * Get healthiest snapshot
   */
  getHealthiestSnapshot(): SnapshotRef | null {
    const session = this.getCurrentSession();
    if (!session) {
      return null;
    }
    return this.snapshotManager.getHealthiestSnapshot(session.id);
  }
}

/**
 * Factory function to create a ContextManager instance
 */
export function createContextManager(options?: ContextManagerOptions): ContextManager {
  return new ContextManager(options);
}

// ==================== Re-exports ====================

// Types
export * from './types';

// Storage
export { SessionStore } from './storage/session-store';

// Core
export { SessionMonitor } from './core/session-monitor';
export { SessionAnalyzer } from './core/session-analyzer';
export { ContextController } from './core/context-controller';
export { SnapshotManager } from './core/snapshot-manager';
export { OutputTrimmer } from './core/output-trimmer';
export { SessionCompactor } from './core/session-compactor';

// Detectors
export { TopicDriftDetector } from './detectors/topic-drift';
