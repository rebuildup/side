/**
 * Session Analyzer for Claude Context Manager
 *
 * Analyzes session health, drift, and provides recommendations.
 */

import { TopicDriftDetector } from "../detectors/topic-drift";
import type {
  ClaudeSession,
  ControllerStatus,
  DriftDetectionResult,
  HealthAnalysis,
} from "../types";

/**
 * Session Analyzer
 *
 * Analyzes session health and provides actionable recommendations.
 */
export class SessionAnalyzer {
  private driftDetector: TopicDriftDetector;
  private driftThreshold: number;

  constructor(driftThreshold: number = 0.7) {
    this.driftDetector = new TopicDriftDetector();
    this.driftThreshold = driftThreshold;
  }

  /**
   * Get comprehensive health analysis
   */
  async analyzeHealth(session: ClaudeSession): Promise<HealthAnalysis> {
    const factors = {
      drift: await this.analyzeDrift(session),
      errors: this.analyzeErrors(session),
      length: this.analyzeLength(session),
      activity: this.analyzeActivity(session),
    };

    const score = this.calculateOverallScore(factors);
    const recommendations = this.generateRecommendations(session, factors);

    return {
      score,
      factors: {
        drift: factors.drift.driftScore,
        errors: factors.errors,
        length: factors.length,
        activity: factors.activity,
      },
      recommendations,
    };
  }

  /**
   * Analyze topic drift
   */
  async analyzeDrift(session: ClaudeSession): Promise<DriftDetectionResult> {
    const result = await this.driftDetector.detect(session, this.driftThreshold);
    return result;
  }

  /**
   * Analyze error rate
   */
  private analyzeErrors(session: ClaudeSession): number {
    const { errorCount, messageCount } = session.metrics;

    if (messageCount === 0) return 0;

    const errorRate = errorCount / messageCount;

    // Use sigmoid curve for smoother transitions
    // 0% errors -> 0, 10% errors -> 0.5, 20%+ errors -> 1.0
    return Math.min(1.0, errorRate * 5);
  }

  /**
   * Analyze session length
   */
  private analyzeLength(session: ClaudeSession): number {
    const { messageCount } = session.metrics;
    const eventCount = session.events.length;

    // Factor in both message count and event count
    const lengthScore = Math.max(messageCount, eventCount);

    // Consider 100+ as "long"
    return Math.min(1.0, lengthScore / 100);
  }

  /**
   * Analyze recent activity
   */
  private analyzeActivity(session: ClaudeSession): number {
    const now = new Date();
    const lastUpdate = new Date(session.updatedAt);
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    // Decay over time: 1.0 at 0h, 0.5 at 2h, 0.0 at 4+ hours
    return Math.max(0, 1 - hoursSinceUpdate / 4);
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallScore(factors: {
    drift: DriftDetectionResult;
    errors: number;
    length: number;
    activity: number;
  }): number {
    const weights = {
      drift: 0.4,
      errors: 0.3,
      length: 0.15,
      activity: 0.15,
    };

    const weightedSum =
      factors.drift.driftScore * weights.drift +
      factors.errors * weights.errors +
      factors.length * weights.length +
      (1 - factors.activity) * weights.activity; // Invert activity

    return Math.max(0, Math.min(1, 1 - weightedSum));
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    session: ClaudeSession,
    factors: {
      drift: DriftDetectionResult;
      errors: number;
      length: number;
      activity: number;
    }
  ): string[] {
    const recommendations: string[] = [];

    if (factors.drift.driftScore > this.driftThreshold) {
      recommendations.push(
        "High topic drift detected. Consider creating a snapshot and starting a new session."
      );
    }

    if (factors.errors > 0.5) {
      recommendations.push("High error rate detected. Review recent errors for patterns.");
    }

    if (factors.length > 0.7) {
      recommendations.push(
        "Session is becoming lengthy. Consider compacting or creating a snapshot."
      );
    }

    if (factors.activity < 0.3) {
      recommendations.push("Session has been inactive. Consider ending or archiving.");
    }

    if (session.metrics.retryCount > 5) {
      recommendations.push("High retry count detected. This may indicate persistent issues.");
    }

    return recommendations;
  }

  /**
   * Get controller status for a session
   */
  async getStatus(session: ClaudeSession): Promise<ControllerStatus> {
    const health = await this.analyzeHealth(session);
    const driftResult = await this.analyzeDrift(session);

    // Determine state based on health score
    let state: ControllerStatus["state"];
    if (health.score >= 0.7) {
      state = "healthy";
    } else if (health.score >= 0.4) {
      state = "warning";
    } else {
      state = "critical";
    }

    return {
      healthScore: health.score,
      state,
      driftScore: driftResult.driftScore,
      lastCompactAt: this.getLastCompactTime(session),
      lastSnapshotAt: this.getLastSnapshotTime(session),
      recommendations: health.recommendations,
    };
  }

  /**
   * Get timestamp of last compaction
   */
  private getLastCompactTime(session: ClaudeSession): string | undefined {
    const compactEvent = session.events.filter((e) => e.type === "compact").pop();

    return compactEvent?.timestamp;
  }

  /**
   * Get timestamp of last snapshot
   */
  private getLastSnapshotTime(session: ClaudeSession): string | undefined {
    if (session.snapshots.length > 0) {
      return session.snapshots[session.snapshots.length - 1].timestamp;
    }

    const snapshotEvent = session.events.filter((e) => e.type === "snapshot").pop();

    return snapshotEvent?.timestamp;
  }

  /**
   * Update drift threshold
   */
  setDriftThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error("Drift threshold must be between 0 and 1");
    }
    this.driftThreshold = threshold;
  }

  /**
   * Get current drift threshold
   */
  getDriftThreshold(): number {
    return this.driftThreshold;
  }
}
