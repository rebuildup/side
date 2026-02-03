/**
 * Centralized configuration for Claude Context Manager
 *
 * All magic numbers and thresholds are defined here for easy maintenance
 * and consistency across the module.
 */

/**
 * Health score thresholds (0-100 scale)
 * - CRITICAL: Below this, immediate compaction + snapshot needed
 * - WARNING: Below this, compaction recommended
 * - GOOD: Above this, snapshot for preservation
 */
export const HEALTH_THRESHOLDS = {
  CRITICAL: 30, // Critical health threshold
  WARNING: 50, // Warning health threshold
  GOOD: 80, // Good health threshold
} as const;

/**
 * Topic drift threshold (0-1 scale)
 * Above this value, consider starting a new session
 */
export const DRIFT_THRESHOLD = 0.7;

/**
 * Token-related thresholds
 * - TOKEN_PENALTY_DIVISOR: Used for calculating health score penalty
 * - TOKEN_WARNING_THRESHOLD: Triggers trim recommendation
 */
export const TOKEN_THRESHOLDS = {
  PENALTY_DIVISOR: 10000, // Divisor for token penalty calculation
  WARNING_THRESHOLD: 50000, // Token count that triggers trim warning
} as const;

/**
 * Compaction thresholds
 * - COMPACT_THRESHOLD: Minimum events before auto-compaction
 * - COMPACT_KEEP_RECENT: Number of recent events to preserve
 */
export const COMPACTION_THRESHOLDS = {
  THRESHOLD: 100, // Minimum events for compaction
  KEEP_RECENT: 20, // Recent events to keep after compaction
} as const;

/**
 * Trim thresholds (character counts)
 * - TRIM_THRESHOLD: Threshold for trimming individual content
 * - TRIM_FILE_THRESHOLD: Threshold for trimming file-based content (100KB)
 */
export const TRIM_THRESHOLDS = {
  THRESHOLD: 10000, // Characters threshold for trimming
  FILE_THRESHOLD: 100000, // Characters (100KB) for file trimming
} as const;

/**
 * Phase detection configuration
 * - WINDOW_SIZE: Number of recent messages to analyze for phase detection
 */
export const PHASE_DETECTION = {
  WINDOW_SIZE: 5, // Sliding window size for phase detection
} as const;

/**
 * Snapshot thresholds
 * - AUTO_HEALTH_THRESHOLD: Health score above which auto-snapshot is considered
 */
export const SNAPSHOT_THRESHOLDS = {
  AUTO_HEALTH_THRESHOLD: 80, // Health score for auto-snapshot
} as const;

/**
 * Combined configuration object for convenience
 * Exported as CONTEXT_MANAGER_CONFIG as specified in the issue
 */
export const CONTEXT_MANAGER_CONFIG = {
  // Health score thresholds
  HEALTH: {
    CRITICAL: HEALTH_THRESHOLDS.CRITICAL,
    WARNING: HEALTH_THRESHOLDS.WARNING,
    GOOD: HEALTH_THRESHOLDS.GOOD,
  },
  // Drift threshold
  DRIFT_THRESHOLD,
  // Token thresholds
  TOKEN_PENALTY_DIVISOR: TOKEN_THRESHOLDS.PENALTY_DIVISOR,
  TOKEN_WARNING_THRESHOLD: TOKEN_THRESHOLDS.WARNING_THRESHOLD,
  // Compaction
  COMPACT_THRESHOLD: COMPACTION_THRESHOLDS.THRESHOLD,
  COMPACT_KEEP_RECENT: COMPACTION_THRESHOLDS.KEEP_RECENT,
  // Trim
  TRIM_THRESHOLD: TRIM_THRESHOLDS.THRESHOLD,
  TRIM_FILE_THRESHOLD: TRIM_THRESHOLDS.FILE_THRESHOLD,
  // Phase detection
  PHASE_WINDOW_SIZE: PHASE_DETECTION.WINDOW_SIZE,
  // Snapshot
  SNAPSHOT_AUTO_HEALTH_THRESHOLD: SNAPSHOT_THRESHOLDS.AUTO_HEALTH_THRESHOLD,
} as const;
