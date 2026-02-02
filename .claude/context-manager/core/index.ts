/**
 * Core module exports
 */

export { SessionMonitor } from './session-monitor';
export { SessionAnalyzer } from './session-analyzer';
export { ContextController } from './context-controller';

// Also export SessionCompactor and SnapshotManager
export { SessionCompactor } from './session-compactor';
export { SnapshotManager } from './snapshot-manager';
export { OutputTrimmer } from './output-trimmer';

// Re-export types from session-analyzer
export type {
  AnalysisResult,
  HealthScoreBreakdown,
} from './session-analyzer';

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
