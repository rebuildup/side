"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mkdirp_1 = require("mkdirp");
/**
 * Session storage layer with fsync for data safety
 */
class SessionStore {
    sessionsDir;
    constructor(baseDir = '.claude') {
        this.sessionsDir = path.join(baseDir, 'sessions');
        this.ensureDirectory();
    }
    ensureDirectory() {
        if (!fs.existsSync(this.sessionsDir)) {
            (0, mkdirp_1.sync)(this.sessionsDir);
        }
    }
    getPath(sessionId) {
        return path.join(this.sessionsDir, `${sessionId}.json`);
    }
    /**
     * Create a new session with initial prompt
     */
    create(sessionId, initialPrompt) {
        const now = new Date().toISOString();
        const session = {
            id: sessionId,
            createdAt: now,
            updatedAt: now,
            metadata: {
                initialPrompt,
                phase: 'initialization',
                healthScore: 1.0,
            },
            metrics: {
                totalTokens: 0,
                messageCount: 0,
                errorCount: 0,
                retryCount: 0,
                driftScore: 0.0,
            },
            topicTracking: {
                keywords: [],
                filePaths: [],
            },
            events: [
                {
                    timestamp: now,
                    type: 'message',
                    data: { prompt: initialPrompt },
                },
            ],
            snapshots: [],
        };
        this.write(sessionId, session);
        return session;
    }
    /**
     * Get session by ID, returns null if not found
     */
    get(sessionId) {
        const filePath = this.getPath(sessionId);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Invalid session JSON for ${sessionId}: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Update session with partial data, automatically updates updatedAt
     */
    update(sessionId, updates) {
        const existing = this.get(sessionId);
        if (!existing) {
            throw new Error(`Session ${sessionId} not found`);
        }
        const merged = {
            ...existing,
            ...updates,
            id: existing.id, // Preserve ID
            createdAt: existing.createdAt, // Preserve creation time
            updatedAt: new Date().toISOString(), // Update timestamp
        };
        this.write(sessionId, merged);
    }
    /**
     * Delete session by ID
     */
    delete(sessionId) {
        const filePath = this.getPath(sessionId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    /**
     * List all sessions
     */
    list() {
        const sessions = [];
        if (!fs.existsSync(this.sessionsDir)) {
            return sessions;
        }
        const files = fs.readdirSync(this.sessionsDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const sessionId = file.slice(0, -5);
                const session = this.get(sessionId);
                if (session) {
                    sessions.push(session);
                }
            }
        }
        // Sort by createdAt descending (newest first)
        return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    /**
     * Get file path for a session (public accessor)
     */
    getPublicPath(sessionId) {
        return path.join(this.sessionsDir, `${sessionId}.json`);
    }
    /**
     * Write session data with fsync for durability
     */
    write(sessionId, session) {
        const filePath = this.getPath(sessionId);
        const tmpPath = `${filePath}.tmp`;
        let fd = null;
        try {
            // Write to temp file first
            const content = JSON.stringify(session, null, 2);
            fs.writeFileSync(tmpPath, content, 'utf-8');
            // Sync to disk
            fd = fs.openSync(tmpPath, 'r');
            fs.fsyncSync(fd);
        }
        finally {
            // Always close file descriptor
            if (fd !== null) {
                fs.closeSync(fd);
            }
        }
        try {
            // Atomic rename
            fs.renameSync(tmpPath, filePath);
        }
        catch (error) {
            // Clean up temp file on error
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
            throw error;
        }
    }
}
exports.SessionStore = SessionStore;
