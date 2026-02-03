"use strict";
/**
 * Session Monitor for Claude Context Manager
 *
 * Tracks session events, metrics, and health in real-time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionMonitor = void 0;
/**
 * Session Monitor
 *
 * Real-time monitoring of session events and metrics.
 */
class SessionMonitor {
    currentSession = null;
    messageBuffer = [];
    toolBuffer = [];
    errorBuffer = [];
    lastHealthCheck = new Date();
    constructor() {
        this.resetBuffers();
    }
    /**
     * Set the current session for monitoring
     */
    setSession(session) {
        this.currentSession = session;
        this.resetBuffers();
    }
    /**
     * Clear the current session
     */
    clearSession() {
        this.currentSession = null;
        this.resetBuffers();
    }
    /**
     * Reset tracking buffers
     */
    resetBuffers() {
        this.messageBuffer = [];
        this.toolBuffer = [];
        this.errorBuffer = [];
    }
    /**
     * Track a user or assistant message
     */
    trackMessage(role, content, options = {}) {
        const { updateMetrics = true, analyzeDrift = true, saveImmediately = true, } = options;
        const message = {
            role,
            content,
            timestamp: new Date().toISOString(),
        };
        this.messageBuffer.push(message);
        // Create event record
        const event = {
            timestamp: message.timestamp,
            type: 'message',
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
    trackTool(name, args, result, options = {}) {
        const { recordEvent = true, saveImmediately = true, } = options;
        const startTime = Date.now();
        const toolExec = {
            name,
            args,
            result,
            timestamp: new Date().toISOString(),
        };
        this.toolBuffer.push(toolExec);
        if (recordEvent) {
            const event = {
                timestamp: toolExec.timestamp,
                type: 'tool',
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
    trackError(error, options = {}) {
        const { recoverable = false, context = {}, saveImmediately = true, } = options;
        const errorTracking = {
            error,
            context,
            timestamp: new Date().toISOString(),
            recoverable,
        };
        this.errorBuffer.push(errorTracking);
        const event = {
            timestamp: errorTracking.timestamp,
            type: 'error',
            data: {
                message: typeof error === 'string' ? error : error.message,
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
    getHealthAnalysis() {
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
    calculateHealthFactors() {
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
    calculateErrorFactor() {
        if (!this.currentSession)
            return 0;
        const errorRate = this.currentSession.metrics.messageCount > 0
            ? this.currentSession.metrics.errorCount /
                this.currentSession.metrics.messageCount
            : 0;
        // Cap at 1.0, with sigmoid curve for smoother transitions
        return Math.min(1.0, errorRate * 5);
    }
    /**
     * Calculate length factor (0 = short session, 1 = very long)
     */
    calculateLengthFactor() {
        if (!this.currentSession)
            return 0;
        const messageCount = this.currentSession.metrics.messageCount;
        // Consider 100+ messages as "long"
        return Math.min(1.0, messageCount / 100);
    }
    /**
     * Calculate activity factor (1 = active, 0 = stale)
     */
    calculateActivityFactor() {
        const now = new Date();
        const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();
        const minutesSinceLastCheck = timeSinceLastCheck / (1000 * 60);
        // Decay over time: 1.0 at 0 min, 0.5 at 5 min, 0.0 at 10+ min
        return Math.max(0, 1 - minutesSinceLastCheck / 10);
    }
    /**
     * Calculate overall health score from factors
     */
    calculateOverallScore(factors) {
        // Weight factors: drift is most important, then errors
        const weights = {
            drift: 0.4,
            errors: 0.3,
            length: 0.15,
            activity: 0.15,
        };
        const weightedSum = factors.drift * weights.drift +
            factors.errors * weights.errors +
            factors.length * weights.length +
            (1 - factors.activity) * weights.activity; // Invert activity (higher is better)
        // Invert so higher is better
        return Math.max(0, Math.min(1, 1 - weightedSum));
    }
    /**
     * Generate recommendations based on health factors
     */
    generateRecommendations(factors) {
        const recommendations = [];
        if (factors.drift > 0.5) {
            recommendations.push('High topic drift detected. Consider creating a snapshot and starting a new session.');
        }
        if (factors.errors > 0.5) {
            recommendations.push('High error rate detected. Review recent errors for patterns.');
        }
        if (factors.length > 0.7) {
            recommendations.push('Session is becoming lengthy. Consider compacting or creating a snapshot.');
        }
        if (factors.activity < 0.3) {
            recommendations.push('Session has been inactive. Consider ending or archiving.');
        }
        return recommendations;
    }
    /**
     * Record an event to the session
     */
    recordEvent(event) {
        if (this.currentSession) {
            this.currentSession.events.push(event);
        }
    }
    /**
     * Check if a tool result indicates success
     */
    isSuccessfulResult(result) {
        if (result === null || result === undefined) {
            return false;
        }
        if (typeof result === 'object') {
            // Check for common error indicators
            const obj = result;
            if ('error' in obj || 'Error' in obj || 'errorCode' in obj) {
                return false;
            }
        }
        return true;
    }
    /**
     * Estimate token count from text (rough approximation)
     */
    estimateTokenCount(text) {
        // Rough approximation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
    /**
     * Get buffered messages
     */
    getBufferedMessages() {
        return [...this.messageBuffer];
    }
    /**
     * Get buffered tool executions
     */
    getBufferedTools() {
        return [...this.toolBuffer];
    }
    /**
     * Get buffered errors
     */
    getBufferedErrors() {
        return [...this.errorBuffer];
    }
    /**
     * Clear all buffers
     */
    clearBuffers() {
        this.resetBuffers();
    }
    /**
     * Get current session
     */
    getSession() {
        return this.currentSession;
    }
}
exports.SessionMonitor = SessionMonitor;
