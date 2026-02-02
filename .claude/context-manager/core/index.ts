/**
 * Core module exports
 */

export { SessionMonitor } from './session-monitor';
export { SessionAnalyzer } from './analyzer';
export { ContextController } from './controller';

// Re-export types from analyzer
export type {
  AnalysisResult,
  HealthScoreBreakdown,
  Message,
  Session,
  SessionStore as AnalyzerSessionStore,
} from './analyzer';

// Re-export types from types module
export type {
  ClaudeSession,
  ClaudeMessage,
  SessionEvent,
  SnapshotRef,
  CompactResult,
  ControllerStatus,
  ContextManagerOptions,
  SnapshotOptions,
  CompactOptions,
  ToolExecution,
  ErrorTracking,
  HealthAnalysis,
  SessionStats,
  TrackMessageOptions,
  TrackToolOptions,
  TrackErrorOptions,
} from '../types';

// Re-export SessionStore class from storage
export { SessionStore } from '../storage/session-store';
