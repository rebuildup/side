/**
 * Context Manager API Types
 *
 * Types for the context manager service that handles session management,
 * compaction, and snapshot operations.
 */

export interface ContextManagerStatus {
  sessionId: string;
  healthScore: number;
  driftScore: number;
  phase: string;
  messageCount: number;
  tokenCount: number;
  recommendations: string[];
  needsAttention: boolean;
}

export interface CreateSessionRequest {
  sessionId?: string;
  initialPrompt: string;
}

export interface CompactResponse {
  originalEvents: number;
  remainingEvents: number;
  compactedEvents: number;
  summary: string;
  spaceSaved: number;
}

export interface SnapshotResponse {
  commitHash: string;
  timestamp: string;
  healthScore: number;
  description: string;
}

export interface SnapshotListResponse {
  snapshots: SnapshotResponse[];
}
