/**
 * Shared types for Claude Context Manager
 *
 * This file exports all shared types used across the module.
 */

/**
 * Complete session data structure
 */
export interface ClaudeSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    initialPrompt: string;
    phase: string;
    healthScore: number;
  };
  metrics: {
    totalTokens: number;
    messageCount: number;
    errorCount: number;
    retryCount: number;
    driftScore: number;
  };
  topicTracking: {
    keywords: string[];
    filePaths: string[];
    initialEmbedding?: number[];
  };
  events: SessionEvent[];
  snapshots: SnapshotRef[];
  messages?: ClaudeMessage[];
}

/**
 * Message structure for conversation tracking
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

/**
 * Message type alias for compatibility
 * Some code references use 'Message' instead of 'ClaudeMessage'
 */
export type Message = ClaudeMessage;

/**
 * Event recorded during session lifecycle
 */
export interface SessionEvent {
  timestamp: string;
  type: 'message' | 'tool' | 'error' | 'snapshot' | 'compact';
  data: unknown;
}

/**
 * Reference to a git snapshot for this session
 */
export interface SnapshotRef {
  commitHash: string;
  timestamp: string;
  healthScore: number;
  description: string;
}

/**
 * Result of session compaction operation
 */
export interface CompactResult {
  /** Original number of events before compaction */
  originalEvents: number;
  /** Remaining events after compaction */
  remainingEvents: number;
  /** Number of events that were compacted */
  compactedEvents: number;
  /** Generated summary text */
  summary: string;
  /** Space saved in characters */
  spaceSaved: number;
}

/**
 * Controller action types
 */
export type ControllerActionType = 'compact' | 'snapshot' | 'trim' | 'alert';

/**
 * Controller action result
 */
export interface ControllerAction {
  type: ControllerActionType;
  reason: string;
  executed: boolean;
  result?: unknown;
  timestamp: string;
}

/**
 * Controller status for health monitoring
 */
export interface ControllerStatus {
  healthScore: number;
  phase: string;
  driftScore: number;
  lastAction: ControllerAction | null;
  recommendations: string[];
}

/**
 * Configuration options for ContextManager
 */
export interface ContextManagerOptions {
  sessionsDir?: string;           // Default: .claude/sessions
  autoCompactThreshold?: number;  // Default: 100 events
  healthCheckInterval?: number;   // Default: 60000ms (1 min)
  driftThreshold?: number;        // Default: 0.7
}

/**
 * Options for snapshot creation
 */
export interface SnapshotOptions {
  description?: string;
  includeMetrics?: boolean;
  includeEvents?: boolean;
}

/**
 * Session compaction options
 */
export interface CompactOptions {
  /** Number of recent events to keep as-is (default: 50) */
  keepRecentEvents?: number;
  /** Minimum events before compaction triggers (default: 100) */
  compactThreshold?: number;
  /** Use Claude API for summarization (default: false, not implemented yet) */
  summarizeUsingLLM?: boolean;
}

/**
 * Tool execution tracking data
 */
export interface ToolExecution {
  name: string;
  args: unknown;
  result: unknown;
  duration?: number;
  timestamp: string;
}

/**
 * Error tracking data
 */
export interface ErrorTracking {
  error: Error | string;
  context?: Record<string, unknown>;
  timestamp: string;
  recoverable: boolean;
}

/**
 * Health analysis result
 */
export interface HealthAnalysis {
  score: number;
  factors: {
    drift: number;
    errors: number;
    length: number;
    activity: number;
  };
  recommendations: string[];
}

/**
 * Session statistics
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalEvents: number;
  totalSnapshots: number;
  avgHealthScore: number;
}

/**
 * Detection result from topic drift analysis
 */
export interface DriftDetectionResult {
  driftScore: number;
  method: 'keyword' | 'llm';
  needsDeepAnalysis: boolean;
}

/**
 * Message tracking options
 */
export interface TrackMessageOptions {
  updateMetrics?: boolean;         // Update message count (default: true)
  analyzeDrift?: boolean;          // Run drift analysis (default: true)
  saveImmediately?: boolean;       // Save to disk immediately (default: true)
}

/**
 * Tool tracking options
 */
export interface TrackToolOptions {
  recordEvent?: boolean;           // Record as session event (default: true)
  saveImmediately?: boolean;       // Save to disk immediately (default: true)
}

/**
 * Error tracking options
 */
export interface TrackErrorOptions {
  recoverable?: boolean;           // Whether error is recoverable (default: false)
  context?: Record<string, unknown>; // Additional context
  saveImmediately?: boolean;       // Save to disk immediately (default: true)
}
