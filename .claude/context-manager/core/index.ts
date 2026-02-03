/**
 * Core module exports
 */

// Re-export SessionStore class from storage
export { SessionStore } from "../storage/session-store";
// Re-export types from types module
export type {
  ClaudeMessage,
  ClaudeSession,
  CompactOptions,
  CompactResult,
  ContextManagerOptions,
  ControllerStatus,
  ErrorTracking,
  HealthAnalysis,
  SessionEvent,
  SessionStats,
  SnapshotOptions,
  SnapshotRef,
  ToolExecution,
  TrackErrorOptions,
  TrackMessageOptions,
  TrackToolOptions,
} from "../types";
export { ContextController } from "./context-controller";
export { OutputTrimmer } from "./output-trimmer";
// Re-export types from session-analyzer
export type {
  AnalysisResult,
  HealthScoreBreakdown,
} from "./session-analyzer";
export { SessionAnalyzer } from "./session-analyzer";
// Also export SessionCompactor and SnapshotManager
export { SessionCompactor } from "./session-compactor";
export { SessionMonitor } from "./session-monitor";
export { SnapshotManager } from "./snapshot-manager";
