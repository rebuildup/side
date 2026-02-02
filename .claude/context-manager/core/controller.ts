/**
 * Controller Layer for Claude Context Manager
 *
 * Orchestrates all actions based on session health and drift analysis.
 * Coordinates between SessionStore, SessionMonitor, and SessionAnalyzer.
 */

import {
  ClaudeSession,
  ControllerAction,
  ControllerActionType,
  ControllerStatus,
  SessionEvent,
} from '../types';
import { SessionStore } from '../storage/session-store';
import { SessionMonitor } from './session-monitor';
import { TopicDriftDetector } from '../detectors/topic-drift';
import { createHash } from 'crypto';
import {
  HEALTH_THRESHOLDS,
  DRIFT_THRESHOLD,
  TOKEN_THRESHOLDS,
  COMPACTION_THRESHOLDS,
} from '../config';

/**
 * Configuration thresholds for controller decisions
 * Uses centralized config values as defaults
 */
interface ControllerConfig {
  healthThreshold: {
    critical: number;  // Below this: compact + snapshot
    warning: number;   // Below this: compact only
    good: number;      // Above this: snapshot
  };
  driftThreshold: number;  // Above this: alert for new session
  maxLastActions?: number; // Max size for lastActions cache
}

/**
 * Default configuration (uses centralized config)
 */
const DEFAULT_CONFIG: ControllerConfig = {
  healthThreshold: {
    critical: HEALTH_THRESHOLDS.CRITICAL,
    warning: HEALTH_THRESHOLDS.WARNING,
    good: HEALTH_THRESHOLDS.GOOD,
  },
  driftThreshold: DRIFT_THRESHOLD,
  maxLastActions: 100,
};

/**
 * Context Controller
 *
 * Orchestrates session management actions based on health and drift analysis.
 * Automatically decides when to compact, snapshot, trim, or alert.
 */
export class ContextController {
  private config: ControllerConfig;
  private lastActions: Map<string, ControllerAction> = new Map();
  private lastActionsAccessOrder: string[] = []; // Track access order for LRU eviction
  private driftDetector: TopicDriftDetector;

  // Session adapter for SessionMonitor compatibility
  private currentSession: ClaudeSession | null = null;

  constructor(
    private store: SessionStore,
    private monitor: SessionMonitor,
    config?: Partial<ControllerConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.driftDetector = new TopicDriftDetector();
  }

  /**
   * Main tick method - call this periodically to evaluate and execute actions
   *
   * @param sessionId - The session ID to evaluate
   * @returns Array of actions that were considered and executed
   */
  async tick(sessionId: string): Promise<ControllerAction[]> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update monitor with current session
    this.monitor.setSession(session);
    this.currentSession = session;

    // Get current metrics
    const healthScore = session.metadata.healthScore;
    const driftScore = session.metrics.driftScore;

    // Get health analysis from monitor
    const healthAnalysis = this.monitor.getHealthAnalysis();

    // Determine actions based on thresholds
    const actions: ControllerAction[] = [];

    // Priority 1: Critical health - compact + snapshot
    if (healthScore < this.config.healthThreshold.critical) {
      const compactAction = await this.executeAction(sessionId, 'compact', `Health score ${healthScore.toFixed(0)} is below critical threshold ${this.config.healthThreshold.critical}`);
      actions.push(compactAction);

      const snapshotAction = await this.executeAction(sessionId, 'snapshot', 'Creating snapshot after critical compaction');
      actions.push(snapshotAction);
    }
    // Priority 2: High drift - alert user
    else if (driftScore > this.config.driftThreshold) {
      const alertAction = await this.executeAction(sessionId, 'alert', `Drift score ${driftScore.toFixed(2)} exceeds threshold ${this.config.driftThreshold}. Consider starting a new session.`);
      actions.push(alertAction);
    }
    // Priority 3: Warning health - compact only
    else if (healthScore < this.config.healthThreshold.warning) {
      const compactAction = await this.executeAction(sessionId, 'compact', `Health score ${healthScore.toFixed(0)} is below warning threshold ${this.config.healthThreshold.warning}`);
      actions.push(compactAction);
    }
    // Priority 4: Good health - snapshot for preservation
    else if (healthScore > this.config.healthThreshold.good) {
      // Only snapshot if we haven't recently
      const lastAction = this.lastActions.get(sessionId);
      const shouldSnapshot = !lastAction ||
        lastAction.type !== 'snapshot' ||
        this.isSnapshotStale(lastAction.timestamp);

      if (shouldSnapshot) {
        const snapshotAction = await this.executeAction(sessionId, 'snapshot', `Health score ${healthScore.toFixed(0)} is good. Creating preservation snapshot.`);
        actions.push(snapshotAction);
      }
    }

    // Check for large outputs that need trimming
    const needsTrim = this.sessionNeedsTrimming(session);
    if (needsTrim) {
      const trimAction = await this.executeAction(sessionId, 'trim', 'Session contains large outputs that should be trimmed');
      actions.push(trimAction);
    }

    // Update session with latest drift score
    await this.updateDriftScore(sessionId);

    return actions;
  }

  /**
   * Manual trigger for a specific action
   *
   * @param sessionId - The session ID to act on
   * @param action - The type of action to trigger
   */
  async trigger(sessionId: string, action: ControllerActionType): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const reason = `Manual trigger of ${action} action`;
    await this.executeAction(sessionId, action, reason);
  }

  /**
   * Get current status of a session
   *
   * @param sessionId - The session ID to get status for
   * @returns Current controller status
   */
  getStatus(sessionId: string): ControllerStatus {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const healthScore = session.metadata.healthScore;
    const driftScore = session.metrics.driftScore;
    const lastAction = this.lastActions.get(sessionId) || null;

    // Generate recommendations
    const recommendations: string[] = [];

    if (healthScore < this.config.healthThreshold.critical) {
      recommendations.push('Critical: Session health is very low. Immediate compaction and snapshot recommended.');
    } else if (healthScore < this.config.healthThreshold.warning) {
      recommendations.push('Warning: Session health is declining. Consider compaction.');
    } else if (healthScore > this.config.healthThreshold.good) {
      recommendations.push('Good: Session is healthy. Consider creating a preservation snapshot.');
    }

    if (driftScore > this.config.driftThreshold) {
      recommendations.push(`Alert: Topic drift is ${(driftScore * 100).toFixed(0)}%. Strongly recommend starting a new session.`);
    } else if (driftScore > this.config.driftThreshold * 0.7) {
      recommendations.push(`Notice: Moderate topic drift at ${(driftScore * 100).toFixed(0)}%. Verify alignment with original goals.`);
    }

    if (this.sessionNeedsTrimming(sessionId)) {
      recommendations.push('Session contains large outputs. Consider trimming to reduce token usage.');
    }

    return {
      healthScore,
      driftScore,
      phase: session.metadata.phase,
      lastAction,
      recommendations,
    };
  }

  /**
   * Execute a specific action and record the result
   */
  private async executeAction(
    sessionId: string,
    actionType: ControllerActionType,
    reason: string
  ): Promise<ControllerAction> {
    const action: ControllerAction = {
      type: actionType,
      reason,
      executed: false,
      timestamp: new Date().toISOString(),
    };

    try {
      let result: unknown;

      switch (actionType) {
        case 'compact':
          result = await this.performCompact(sessionId);
          break;
        case 'snapshot':
          result = await this.performSnapshot(sessionId);
          break;
        case 'trim':
          result = await this.performTrim(sessionId);
          break;
        case 'alert':
          result = this.performAlert(sessionId, reason);
          break;
        default:
          result = { message: `Unknown action type: ${actionType}` };
      }

      action.executed = true;
      action.result = result;
    } catch (error) {
      action.result = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Record the action with LRU eviction
    this.recordLastAction(sessionId, action);
    this.recordActionEvent(sessionId, action);

    return action;
  }

  /**
   * Perform session compaction
   * Reduces event history while preserving critical information
   */
  private async performCompact(sessionId: string): Promise<unknown> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const eventsBefore = session.events.length;
    const messagesBefore = session.messages?.length || 0;

    // Keep recent events and all snapshot/error events
    const recentEvents = session.events.slice(-COMPACTION_THRESHOLDS.KEEP_RECENT);
    const importantEvents = session.events.filter(
      e => e.type === 'snapshot' || e.type === 'error'
    );

    // Combine and deduplicate
    const allEvents = [...importantEvents, ...recentEvents];
    const uniqueEvents = this.deduplicateEvents(allEvents);

    // Trim messages if present
    let trimmedMessages: typeof session.messages = undefined;
    if (session.messages && session.messages.length > 50) {
      // Keep first 10 and last 40 messages
      const firstMessages = session.messages.slice(0, 10);
      const lastMessages = session.messages.slice(-40);
      trimmedMessages = [...firstMessages, ...lastMessages];
    }

    // Update session
    this.store.update(sessionId, {
      events: uniqueEvents,
      ...(trimmedMessages && { messages: trimmedMessages }),
    });

    const eventsRemoved = eventsBefore - uniqueEvents.length;
    const messagesRemoved = messagesBefore - (trimmedMessages?.length || messagesBefore);

    return {
      message: 'Session compacted successfully',
      eventsRemoved,
      eventsKept: uniqueEvents.length,
      messagesRemoved,
      messagesKept: trimmedMessages?.length || messagesBefore,
      compactedAt: new Date().toISOString(),
    };
  }

  /**
   * Perform snapshot creation
   * Records current state as a snapshot reference
   */
  private async performSnapshot(sessionId: string): Promise<unknown> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const snapshotRef = {
      commitHash: this.generateSnapshotHash(),
      timestamp: new Date().toISOString(),
      healthScore: session.metadata.healthScore,
      description: this.generateSnapshotDescription(session),
    };

    // Add snapshot to session
    const snapshots = [...session.snapshots, snapshotRef];
    this.store.update(sessionId, { snapshots });

    // Record snapshot event
    const snapshotEvent: SessionEvent = {
      timestamp: snapshotRef.timestamp,
      type: 'snapshot',
      data: {
        healthScore: snapshotRef.healthScore,
        description: snapshotRef.description,
      },
    };

    this.store.update(sessionId, {
      events: [...session.events, snapshotEvent],
    });

    return {
      message: 'Snapshot created successfully',
      snapshotRef,
      totalSnapshots: snapshots.length,
    };
  }

  /**
   * Perform trim action
   * Logs recommendation for trimming (actual trim implementation in next steps)
   */
  private async performTrim(sessionId: string): Promise<unknown> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // For now, log the recommendation
    // Full implementation will integrate with OutputTrimmer
    return {
      message: 'Trim recommendation logged',
      recommendation: 'Session contains large outputs. Use OutputTrimmer to reduce token usage.',
      sessionId,
      currentHealth: session.metadata.healthScore,
      currentDrift: session.metrics.driftScore,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Perform alert action
   * Returns alert information for user display
   */
  private performAlert(sessionId: string, reason: string): unknown {
    return {
      message: 'Alert triggered',
      alert: {
        level: 'warning',
        sessionId,
        reason,
        recommendation: 'Consider creating a snapshot and starting a new session.',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Check if session needs trimming based on content size
   */
  private sessionNeedsTrimming(sessionId: string): boolean {
    const session = this.store.get(sessionId);
    if (!session) {
      return false;
    }

    // Check if total tokens exceed threshold
    if (session.metrics.totalTokens > TOKEN_THRESHOLDS.WARNING_THRESHOLD) {
      return true;
    }

    // Check if message count is high
    const messageThreshold = 100;
    const messageCount = session.messages?.length || session.metrics.messageCount;
    if (messageCount > messageThreshold) {
      return true;
    }

    // Check if event count is high
    const eventThreshold = 200;
    if (session.events.length > eventThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Update drift score for a session
   */
  private async updateDriftScore(sessionId: string): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      return;
    }

    // Prepare session format for TopicDriftDetector
    // The detector expects session.messages and uses session.metadata.initialPrompt
    const sessionForDetector: ClaudeSession = {
      ...session,
      messages: session.messages || [],
    };

    // Use TopicDriftDetector to calculate drift
    const driftResult = await this.driftDetector.detect(sessionForDetector, 0.5);

    // Update session with new drift score
    this.store.update(sessionId, {
      metrics: {
        ...session.metrics,
        driftScore: driftResult.driftScore,
      },
    });
  }

  /**
   * Check if a snapshot is stale (older than 1 hour)
   */
  private isSnapshotStale(timestamp: string | undefined): boolean {
    if (!timestamp) {
      return true;
    }

    const snapshotTime = new Date(timestamp).getTime();
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    return (now - snapshotTime) > oneHour;
  }

  /**
   * Generate a crypto-based snapshot hash
   */
  private generateSnapshotHash(): string {
    const hash = createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-${process.pid}`)
      .digest('hex');
    return hash.substring(0, 12);
  }

  /**
   * Generate a snapshot description
   */
  private generateSnapshotDescription(session: ClaudeSession): string {
    const phase = session.metadata.phase;
    const health = session.metadata.healthScore.toFixed(0);
    const drift = session.metrics.driftScore.toFixed(2);
    return `Snapshot during ${phase} phase (health: ${health}, drift: ${drift})`;
  }

  /**
   * Deduplicate events by timestamp and type
   */
  private deduplicateEvents(events: SessionEvent[]): SessionEvent[] {
    const seen = new Set<string>();
    const unique: SessionEvent[] = [];

    for (const event of events) {
      const key = `${event.timestamp}-${event.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(event);
      }
    }

    return unique;
  }

  /**
   * Record an action event to the session
   */
  private recordActionEvent(sessionId: string, action: ControllerAction): void {
    const session = this.store.get(sessionId);
    if (!session) {
      return;
    }

    const event: SessionEvent = {
      timestamp: action.timestamp || new Date().toISOString(),
      type: 'compact',
      data: {
        actionType: action.type,
        reason: action.reason,
        executed: action.executed,
      },
    };

    this.store.update(sessionId, {
      events: [...session.events, event],
    });
  }

  /**
   * Set current session for monitoring
   */
  setSession(session: ClaudeSession): void {
    this.currentSession = session;
    this.monitor.setSession(session);
  }

  /**
   * Clear current session
   */
  clearSession(): void {
    this.currentSession = null;
    this.monitor.clearSession();
  }

  /**
   * Record last action with LRU eviction to prevent memory leak
   */
  private recordLastAction(sessionId: string, action: ControllerAction): void {
    const maxSize = this.config.maxLastActions || 100;

    // Update existing entry or add new one
    if (this.lastActions.has(sessionId)) {
      // Remove from access order to re-add at end
      const index = this.lastActionsAccessOrder.indexOf(sessionId);
      if (index !== -1) {
        this.lastActionsAccessOrder.splice(index, 1);
      }
    }

    // Add to map and end of access order
    this.lastActions.set(sessionId, action);
    this.lastActionsAccessOrder.push(sessionId);

    // Evict oldest entry if over limit
    if (this.lastActionsAccessOrder.length > maxSize) {
      const oldestSessionId = this.lastActionsAccessOrder.shift();
      if (oldestSessionId) {
        this.lastActions.delete(oldestSessionId);
      }
    }
  }

  /**
   * Cleanup last action entry for a specific session
   * Call this when a session is deleted to free memory
   */
  cleanupLastAction(sessionId: string): void {
    this.lastActions.delete(sessionId);
    const index = this.lastActionsAccessOrder.indexOf(sessionId);
    if (index !== -1) {
      this.lastActionsAccessOrder.splice(index, 1);
    }
  }

  /**
   * Update controller configuration
   */
  updateConfig(config: Partial<ControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ControllerConfig {
    return { ...this.config };
  }
}

/**
 * Re-export types for convenience
 */
export type { ControllerAction, ControllerActionType, ControllerStatus };
