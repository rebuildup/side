/**
 * Session Monitor for Claude Context Manager
 *
 * Tracks session events, metrics, and health in real-time.
 */

import type {
  ClaudeMessage,
  ClaudeSession,
  ErrorTracking,
  HealthAnalysis,
  SessionEvent,
  ToolExecution,
  TrackErrorOptions,
  TrackMessageOptions,
  TrackToolOptions,
} from "../types";

/**
 * Session Monitor
 *
 * Real-time monitoring of session events and metrics.
 */
export class SessionMonitor {
  private currentSession: ClaudeSession | null = null;
  private messageBuffer: ClaudeMessage[] = [];
  private toolBuffer: ToolExecution[] = [];
  private errorBuffer: ErrorTracking[] = [];
  private lastHealthCheck: Date = new Date();

  constructor() {
    this.resetBuffers();
  }

  /**
   * Set the current session for monitoring
   */
  setSession(session: ClaudeSession): void {
    this.currentSession = session;
    this.resetBuffers();
  }

  /**
   * Clear the current session
   */
  clearSession(): void {
    this.currentSession = null;
    this.resetBuffers();
  }

  /**
   * Reset tracking buffers
   */
  private resetBuffers(): void {
    this.messageBuffer = [];
    this.toolBuffer = [];
    this.errorBuffer = [];
  }

  /**
   * Track a user or assistant message
   */
  trackMessage(
    role: "user" | "assistant",
    content: string,
    options: TrackMessageOptions = {}
  ): void {
    const { updateMetrics = true, analyzeDrift = true, saveImmediately = true } = options;

    const message: ClaudeMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    this.messageBuffer.push(message);

    // Create event record
    const event: SessionEvent = {
      timestamp: message.timestamp,
      type: "message",
      data: { role, content, length: content.length },
    };

    this.recordEvent(event);

    // Update metrics if session is active
    if (this.currentSession && updateMetrics) {
      this.currentSession.metrics.messageCount++;
      this.currentSession.metrics.totalTokens += this.estimateTokenCount(content);

      // Update messages array if it exists
      if (this.currentSession.messages) {
        this.currentSession.messages.push(message);
      }
    }
  }

  /**
   * Track a tool execution
   */
  trackTool(name: string, args: unknown, result: unknown, options: TrackToolOptions = {}): void {
    const { recordEvent = true, saveImmediately = true } = options;

    const _startTime = Date.now();

    const toolExec: ToolExecution = {
      name,
      args,
      result,
      timestamp: new Date().toISOString(),
    };

    this.toolBuffer.push(toolExec);

    if (recordEvent) {
      const event: SessionEvent = {
        timestamp: toolExec.timestamp,
        type: "tool",
        data: {
          name,
          success: this.isSuccessfulResult(result),
        },
      };

      this.recordEvent(event);
    }
  }

  /**
   * Track an error
   */
  trackError(error: Error | string, options: TrackErrorOptions = {}): void {
    const { recoverable = false, context = {}, saveImmediately = true } = options;

    const errorTracking: ErrorTracking = {
      error,
      context,
      timestamp: new Date().toISOString(),
      recoverable,
    };

    this.errorBuffer.push(errorTracking);

    const event: SessionEvent = {
      timestamp: errorTracking.timestamp,
      type: "error",
      data: {
        message: typeof error === "string" ? error : error.message,
        recoverable,
        context,
      },
    };

    this.recordEvent(event);

    // Update metrics if session is active
    if (this.currentSession) {
      this.currentSession.metrics.errorCount++;
    }
  }

  /**
   * Get current health analysis
   */
  getHealthAnalysis(): HealthAnalysis {
    if (!this.currentSession) {
      return {
        score: 1.0,
        factors: {
          drift: 0,
          errors: 0,
          length: 0,
          activity: 0,
        },
        recommendations: [],
      };
    }

    const factors = this.calculateHealthFactors();
    const score = this.calculateOverallScore(factors);
    const recommendations = this.generateRecommendations(factors);

    return {
      score,
      factors,
      recommendations,
    };
  }

  /**
   * Calculate individual health factors
   */
  private calculateHealthFactors(): HealthAnalysis["factors"] {
    if (!this.currentSession) {
      return {
        drift: 0,
        errors: 0,
        length: 0,
        activity: 0,
      };
    }

    return {
      drift: this.currentSession.metrics.driftScore,
      errors: this.calculateErrorFactor(),
      length: this.calculateLengthFactor(),
      activity: this.calculateActivityFactor(),
    };
  }

  /**
   * Calculate error factor (0 = no errors, 1 = many errors)
   */
  private calculateErrorFactor(): number {
    if (!this.currentSession) return 0;

    const errorRate =
      this.currentSession.metrics.messageCount > 0
        ? this.currentSession.metrics.errorCount / this.currentSession.metrics.messageCount
        : 0;

    // Cap at 1.0, with sigmoid curve for smoother transitions
    return Math.min(1.0, errorRate * 5);
  }

  /**
   * Calculate length factor (0 = short session, 1 = very long)
   */
  private calculateLengthFactor(): number {
    if (!this.currentSession) return 0;

    const messageCount = this.currentSession.metrics.messageCount;
    // Consider 100+ messages as "long"
    return Math.min(1.0, messageCount / 100);
  }

  /**
   * Calculate activity factor (1 = active, 0 = stale)
   */
  private calculateActivityFactor(): number {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();
    const minutesSinceLastCheck = timeSinceLastCheck / (1000 * 60);

    // Decay over time: 1.0 at 0 min, 0.5 at 5 min, 0.0 at 10+ min
    return Math.max(0, 1 - minutesSinceLastCheck / 10);
  }

  /**
   * Calculate overall health score from factors
   */
  private calculateOverallScore(factors: HealthAnalysis["factors"]): number {
    // Weight factors: drift is most important, then errors
    const weights = {
      drift: 0.4,
      errors: 0.3,
      length: 0.15,
      activity: 0.15,
    };

    const weightedSum =
      factors.drift * weights.drift +
      factors.errors * weights.errors +
      factors.length * weights.length +
      (1 - factors.activity) * weights.activity; // Invert activity (higher is better)

    // Invert so higher is better
    return Math.max(0, Math.min(1, 1 - weightedSum));
  }

  /**
   * Generate recommendations based on health factors
   */
  private generateRecommendations(factors: HealthAnalysis["factors"]): string[] {
    const recommendations: string[] = [];

    if (factors.drift > 0.5) {
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

    return recommendations;
  }

  /**
   * Record an event to the session
   */
  private recordEvent(event: SessionEvent): void {
    if (this.currentSession) {
      this.currentSession.events.push(event);
    }
  }

  /**
   * Check if a tool result indicates success
   */
  private isSuccessfulResult(result: unknown): boolean {
    if (result === null || result === undefined) {
      return false;
    }

    if (typeof result === "object") {
      // Check for common error indicators
      const obj = result as Record<string, unknown>;
      if ("error" in obj || "Error" in obj || "errorCode" in obj) {
        return false;
      }
    }

    return true;
  }

  /**
   * Estimate token count from text (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get buffered messages
   */
  getBufferedMessages(): ClaudeMessage[] {
    return [...this.messageBuffer];
  }

  /**
   * Get buffered tool executions
   */
  getBufferedTools(): ToolExecution[] {
    return [...this.toolBuffer];
  }

  /**
   * Get buffered errors
   */
  getBufferedErrors(): ErrorTracking[] {
    return [...this.errorBuffer];
  }

  /**
   * Clear all buffers
   */
  clearBuffers(): void {
    this.resetBuffers();
  }

  /**
   * Get current session
   */
  getSession(): ClaudeSession | null {
    return this.currentSession;
  }
}
