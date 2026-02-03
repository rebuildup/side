"use strict";
/**
 * Claude Context Manager
 *
 * Main entry point for session management, monitoring, and control.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopicDriftDetector = exports.SessionCompactor = exports.OutputTrimmer = exports.SnapshotManager = exports.ContextController = exports.SessionAnalyzer = exports.SessionMonitor = exports.SessionStore = exports.ContextManager = void 0;
exports.createContextManager = createContextManager;
// Core components
const session_store_1 = require("./storage/session-store");
const session_monitor_1 = require("./core/session-monitor");
const session_analyzer_1 = require("./core/session-analyzer");
const context_controller_1 = require("./core/context-controller");
const snapshot_manager_1 = require("./core/snapshot-manager");
const output_trimmer_1 = require("./core/output-trimmer");
const session_compactor_1 = require("./core/session-compactor");
const topic_drift_1 = require("./detectors/topic-drift");
/**
 * Default options for ContextManager
 */
const DEFAULT_OPTIONS = {
    sessionsDir: '.claude/sessions',
    autoCompactThreshold: 100,
    healthCheckInterval: 60000,
    driftThreshold: 0.7,
};
/**
 * Context Manager
 *
 * Main class for managing Claude sessions with monitoring, analysis, and control.
 * Implements session lifecycle, health tracking, and automatic maintenance.
 */
class ContextManager {
    store;
    monitor;
    analyzer;
    controller;
    snapshotManager;
    trimmer;
    compactor;
    driftDetector;
    healthCheckTimer = null;
    currentSessionId = null;
    isRunning = false;
    constructor(options = {}) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        this.store = new session_store_1.SessionStore(opts.sessionsDir);
        this.monitor = new session_monitor_1.SessionMonitor();
        this.analyzer = new session_analyzer_1.SessionAnalyzer(opts.driftThreshold);
        this.controller = new context_controller_1.ContextController(this.store, this.monitor, this.analyzer);
        this.snapshotManager = new snapshot_manager_1.SnapshotManager(this.store);
        this.trimmer = new output_trimmer_1.OutputTrimmer();
        this.compactor = new session_compactor_1.SessionCompactor();
        this.driftDetector = new topic_drift_1.TopicDriftDetector();
    }
    // ==================== Session Lifecycle ====================
    /**
     * Create a new session with an initial prompt
     */
    createSession(sessionId, initialPrompt) {
        const session = this.controller.createSession(sessionId, initialPrompt);
        this.currentSessionId = sessionId;
    }
    /**
     * Get a session by ID
     */
    getSession(sessionId) {
        return this.controller.getSession(sessionId);
    }
    /**
     * Get the current active session
     */
    getCurrentSession() {
        return this.controller.getCurrentSession();
    }
    /**
     * End a session
     */
    endSession(sessionId) {
        this.controller.endSession(sessionId);
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
        }
    }
    /**
     * Delete a session permanently
     */
    deleteSession(sessionId) {
        if (this.currentSessionId === sessionId) {
            this.monitor.clearSession();
            this.currentSessionId = null;
        }
        this.store.delete(sessionId);
    }
    /**
     * List all sessions
     */
    listSessions() {
        return this.store.list();
    }
    // ==================== Monitoring ====================
    /**
     * Track a user or assistant message
     */
    trackMessage(role, content) {
        this.controller.trackMessage(role, content);
    }
    /**
     * Track a tool execution
     */
    trackTool(name, args, result) {
        this.controller.trackTool(name, args, result);
    }
    /**
     * Track an error
     */
    trackError(error) {
        this.controller.trackError(error);
    }
    // ==================== Analysis ====================
    /**
     * Get the current health score (0-1, higher is better)
     */
    getHealthScore() {
        return this.controller.getHealthScore();
    }
    /**
     * Get comprehensive controller status
     */
    async getStatus() {
        return await this.controller.getStatus();
    }
    /**
     * Analyze topic drift for current session
     */
    async analyzeDrift() {
        const session = this.getCurrentSession();
        if (!session) {
            return null;
        }
        const result = await this.driftDetector.detect(session);
        return {
            driftScore: result.driftScore,
            needsDeepAnalysis: result.needsDeepAnalysis,
        };
    }
    // ==================== Actions ====================
    /**
     * Compact the current session to reduce storage
     */
    async compact(options) {
        return await this.controller.compact(options);
    }
    /**
     * Create a snapshot of the current session
     */
    async createSnapshot(description) {
        return await this.controller.createSnapshot(description);
    }
    /**
     * Restore a session from a snapshot
     */
    async restoreSnapshot(commitHash) {
        await this.controller.restoreSnapshot(commitHash);
    }
    /**
     * Trim conversation output
     */
    trimOutput(customOptions) {
        const session = this.getCurrentSession();
        if (!session) {
            return null;
        }
        return this.trimmer.trim(session, customOptions);
    }
    // ==================== Statistics ====================
    /**
     * Get session statistics
     */
    getStats() {
        const sessions = this.store.list();
        const activeSessions = sessions.filter(s => s.metadata.phase !== 'ended');
        const totalEvents = sessions.reduce((sum, s) => sum + s.events.length, 0);
        const totalSnapshots = sessions.reduce((sum, s) => sum + s.snapshots.length, 0);
        const avgHealthScore = sessions.length > 0
            ? sessions.reduce((sum, s) => sum + s.metadata.healthScore, 0) / sessions.length
            : 0;
        return {
            totalSessions: sessions.length,
            activeSessions: activeSessions.length,
            totalEvents,
            totalSnapshots,
            avgHealthScore,
        };
    }
    // ==================== Auto-Monitoring ====================
    /**
     * Start auto-monitoring with periodic health checks
     */
    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        // Set up health check interval
        const options = this.getOptions();
        this.healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck();
        }, options.healthCheckInterval);
    }
    /**
     * Stop auto-monitoring
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }
    /**
     * Check if auto-monitoring is running
     */
    isMonitoring() {
        return this.isRunning;
    }
    /**
     * Perform a health check and take automatic actions
     */
    async performHealthCheck() {
        const session = this.getCurrentSession();
        if (!session) {
            return;
        }
        const status = await this.getStatus();
        if (!status) {
            return;
        }
        // Auto-compact if event count exceeds threshold
        const options = this.getOptions();
        if (session.events.length > options.autoCompactThreshold) {
            await this.compact();
        }
        // Auto-snapshot if health score drops significantly
        if (status.healthScore < 0.5 && session.snapshots.length === 0) {
            await this.createSnapshot('Auto-snapshot: Low health score');
        }
    }
    // ==================== Configuration ====================
    /**
     * Get current options
     */
    getOptions() {
        return {
            sessionsDir: this.store['sessionsDir'] || DEFAULT_OPTIONS.sessionsDir,
            autoCompactThreshold: DEFAULT_OPTIONS.autoCompactThreshold,
            healthCheckInterval: DEFAULT_OPTIONS.healthCheckInterval,
            driftThreshold: this.analyzer.getDriftThreshold(),
        };
    }
    /**
     * Update drift threshold
     */
    setDriftThreshold(threshold) {
        this.controller.setDriftThreshold(threshold);
    }
    /**
     * Get current drift threshold
     */
    getDriftThreshold() {
        return this.controller.getDriftThreshold();
    }
    // ==================== Snapshot Management ====================
    /**
     * Get all snapshots for current session
     */
    getSnapshots() {
        const session = this.getCurrentSession();
        if (!session) {
            return [];
        }
        return this.snapshotManager.getSnapshots(session.id);
    }
    /**
     * Create a snapshot for current session
     */
    async createSessionSnapshot(options) {
        const session = this.getCurrentSession();
        if (!session) {
            throw new Error('No active session');
        }
        return await this.snapshotManager.createSnapshot(session.id, options);
    }
    /**
     * Get latest snapshot
     */
    getLatestSnapshot() {
        const session = this.getCurrentSession();
        if (!session) {
            return null;
        }
        return this.snapshotManager.getLatestSnapshot(session.id);
    }
    /**
     * Get healthiest snapshot
     */
    getHealthiestSnapshot() {
        const session = this.getCurrentSession();
        if (!session) {
            return null;
        }
        return this.snapshotManager.getHealthiestSnapshot(session.id);
    }
}
exports.ContextManager = ContextManager;
/**
 * Factory function to create a ContextManager instance
 */
function createContextManager(options) {
    return new ContextManager(options);
}
// ==================== Re-exports ====================
// Types
__exportStar(require("./types"), exports);
// Storage
var session_store_2 = require("./storage/session-store");
Object.defineProperty(exports, "SessionStore", { enumerable: true, get: function () { return session_store_2.SessionStore; } });
// Core
var session_monitor_2 = require("./core/session-monitor");
Object.defineProperty(exports, "SessionMonitor", { enumerable: true, get: function () { return session_monitor_2.SessionMonitor; } });
var session_analyzer_2 = require("./core/session-analyzer");
Object.defineProperty(exports, "SessionAnalyzer", { enumerable: true, get: function () { return session_analyzer_2.SessionAnalyzer; } });
var context_controller_2 = require("./core/context-controller");
Object.defineProperty(exports, "ContextController", { enumerable: true, get: function () { return context_controller_2.ContextController; } });
var snapshot_manager_2 = require("./core/snapshot-manager");
Object.defineProperty(exports, "SnapshotManager", { enumerable: true, get: function () { return snapshot_manager_2.SnapshotManager; } });
var output_trimmer_2 = require("./core/output-trimmer");
Object.defineProperty(exports, "OutputTrimmer", { enumerable: true, get: function () { return output_trimmer_2.OutputTrimmer; } });
var session_compactor_2 = require("./core/session-compactor");
Object.defineProperty(exports, "SessionCompactor", { enumerable: true, get: function () { return session_compactor_2.SessionCompactor; } });
// Detectors
var topic_drift_2 = require("./detectors/topic-drift");
Object.defineProperty(exports, "TopicDriftDetector", { enumerable: true, get: function () { return topic_drift_2.TopicDriftDetector; } });
