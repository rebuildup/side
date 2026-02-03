"use strict";
/**
 * Session Compactor for Claude Context Manager
 *
 * Compacts session events to reduce storage while preserving important history.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionCompactor = void 0;
/**
 * Session Compactor
 *
 * Compacts session event history by removing less important events.
 */
class SessionCompactor {
    /**
     * Compact a session's events
     */
    compact(session, options) {
        const opts = this.normalizeOptions(options);
        const events = session.events;
        if (events.length <= opts.keepLastN) {
            // No compaction needed
            return this.createResult(events, events, []);
        }
        const eventsToKeep = [];
        const removedEvents = [];
        const processedIndices = new Set();
        // Always preserve snapshot events if enabled
        if (opts.preserveSnapshots) {
            events.forEach((event, idx) => {
                if (event.type === 'snapshot') {
                    eventsToKeep.push(event);
                    processedIndices.add(idx);
                }
            });
        }
        // Always preserve error events if enabled
        if (opts.preserveErrors) {
            events.forEach((event, idx) => {
                if (event.type === 'error' && !processedIndices.has(idx)) {
                    eventsToKeep.push(event);
                    processedIndices.add(idx);
                }
            });
        }
        // Preserve compact events (they track compaction history)
        events.forEach((event, idx) => {
            if (event.type === 'compact' && !processedIndices.has(idx)) {
                eventsToKeep.push(event);
                processedIndices.add(idx);
            }
        });
        // Preserve last N events (most recent context)
        const recentStart = Math.max(0, events.length - opts.keepLastN);
        for (let i = recentStart; i < events.length; i++) {
            if (!processedIndices.has(i)) {
                eventsToKeep.push(events[i]);
                processedIndices.add(i);
            }
        }
        // Collect removed events
        events.forEach((event, idx) => {
            if (!processedIndices.has(idx)) {
                removedEvents.push(event);
            }
        });
        // Sort kept events by timestamp
        eventsToKeep.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return this.createResult(events, eventsToKeep, removedEvents);
    }
    /**
     * Calculate compaction statistics without applying
     */
    analyze(session, options) {
        const opts = this.normalizeOptions(options);
        const events = session.events;
        if (events.length <= opts.keepLastN) {
            return {
                currentEvents: events.length,
                eventsAfterCompaction: events.length,
                eventsToRemove: 0,
                compressionRatio: 1.0,
                recommended: false,
                reason: 'Event count is below threshold',
            };
        }
        const result = this.compact(session, { ...opts, dryRun: true });
        const recommended = result.eventsRemoved > events.length * 0.3; // Recommend if >30% reduction
        return {
            currentEvents: events.length,
            eventsAfterCompaction: result.eventsKept,
            eventsToRemove: result.eventsRemoved,
            compressionRatio: result.compressionRatio,
            recommended,
            reason: recommended
                ? `Compaction would remove ${result.eventsRemoved} events (${Math.round((1 - 1 / result.compressionRatio) * 100)}% reduction)`
                : 'Compaction would provide minimal benefit',
        };
    }
    /**
     * Get event type distribution
     */
    getEventDistribution(session) {
        const byType = {};
        session.events.forEach(event => {
            byType[event.type] = (byType[event.type] || 0) + 1;
        });
        const oldestEvent = session.events[0]?.timestamp;
        const newestEvent = session.events[session.events.length - 1]?.timestamp;
        return {
            total: session.events.length,
            byType,
            oldestEvent,
            newestEvent,
        };
    }
    /**
     * Find old events that could be compacted
     */
    findCompactionCandidates(session, ageHours = 24) {
        const cutoff = new Date(Date.now() - ageHours * 60 * 60 * 1000);
        return session.events.filter(event => {
            const eventTime = new Date(event.timestamp);
            return eventTime < cutoff && event.type !== 'snapshot' && event.type !== 'error';
        });
    }
    /**
     * Normalize compaction options
     */
    normalizeOptions(options) {
        const defaults = {
            keepLastN: 20,
            preserveErrors: true,
            preserveSnapshots: true,
            dryRun: false,
        };
        return { ...defaults, ...options };
    }
    /**
     * Create compaction result
     */
    createResult(originalEvents, keptEvents, removedEvents) {
        const sizeBefore = JSON.stringify(originalEvents).length;
        const sizeAfter = JSON.stringify(keptEvents).length;
        return {
            eventsRemoved: removedEvents.length,
            eventsKept: keptEvents.length,
            sizeBefore,
            sizeAfter,
            compressionRatio: originalEvents.length / keptEvents.length,
        };
    }
}
exports.SessionCompactor = SessionCompactor;
