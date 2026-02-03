/**
 * Session Compactor for Claude Context Manager
 *
 * Compacts session history by summarizing old events while preserving recent context.
 * Uses rule-based summarization now, with LLM-based summarization planned for future.
 */

import { COMPACTION_THRESHOLDS } from "../config";
import { SessionStore } from "../storage/session-store";
import type { CompactOptions, CompactResult, SessionEvent } from "../types";

/**
 * Grouped events for summarization
 */
interface EventGroup {
  type: string;
  events: SessionEvent[];
  startTimestamp: string;
  endTimestamp: string;
}

/**
 * Tool event data structure
 */
interface ToolEventData {
  name?: string;
  [key: string]: unknown;
}

/**
 * Error event data structure
 */
interface ErrorEventData {
  message?: string;
  [key: string]: unknown;
}

/**
 * Snapshot event data structure
 */
interface SnapshotEventData {
  description?: string;
  healthScore?: number;
  [key: string]: unknown;
}

/**
 * Session Compactor
 *
 * Compacts session events by:
 * 1. Keeping recent N events as-is
 * 2. Grouping older events by type
 * 3. Generating summary for each group
 * 4. Replacing with compacted event
 */
export class SessionCompactor {
  private readonly store: SessionStore;
  private readonly defaults: Required<CompactOptions> = {
    keepRecentEvents: COMPACTION_THRESHOLDS.KEEP_RECENT,
    compactThreshold: COMPACTION_THRESHOLDS.THRESHOLD,
    summarizeUsingLLM: false,
  };

  constructor(store?: SessionStore) {
    this.store = store ?? new SessionStore();
  }

  /**
   * Compact a session by summarizing old events
   *
   * @param sessionId - ID of session to compact
   * @param options - Compaction options
   * @returns Compaction result with statistics
   */
  async compact(sessionId: string, options?: CompactOptions): Promise<CompactResult> {
    const opts = { ...this.defaults, ...options };
    const session = this.store.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const originalEvents = session.events.length;

    // Check if compaction is needed
    if (originalEvents < opts.compactThreshold) {
      return {
        originalEvents,
        remainingEvents: originalEvents,
        compactedEvents: 0,
        summary: "No compaction needed - below threshold",
        spaceSaved: 0,
      };
    }

    // Split events into recent (to keep) and old (to compact)
    const eventsToCompact = session.events.slice(0, -opts.keepRecentEvents);
    const eventsToKeep = session.events.slice(-opts.keepRecentEvents);

    // Calculate original size
    const originalSize = JSON.stringify(eventsToCompact).length;

    // Generate summary
    const summary = this.generateSummary(eventsToCompact);

    // Create compacted event
    const compactedEvent: SessionEvent = {
      timestamp: new Date().toISOString(),
      type: "compact",
      data: {
        summary,
        compactedEventCount: eventsToCompact.length,
        timeRange: {
          start: eventsToCompact[0]?.timestamp,
          end: eventsToCompact[eventsToCompact.length - 1]?.timestamp,
        },
      },
    };

    // Rebuild events array with compacted event + recent events
    const newEvents = [compactedEvent, ...eventsToKeep];
    const newSize = JSON.stringify(compactedEvent).length;

    // Update session
    this.store.update(sessionId, {
      events: newEvents,
    });

    return {
      originalEvents,
      remainingEvents: newEvents.length,
      compactedEvents: eventsToCompact.length,
      summary,
      spaceSaved: originalSize - newSize,
    };
  }

  /**
   * Check if session needs compaction
   *
   * @param sessionId - ID of session to check
   * @returns True if session should be compacted
   */
  needsCompaction(sessionId: string): boolean {
    const session = this.store.get(sessionId);

    if (!session) {
      return false;
    }

    return session.events.length >= this.defaults.compactThreshold;
  }

  /**
   * Check if session needs compaction with custom threshold
   *
   * @param sessionId - ID of session to check
   * @param threshold - Custom threshold for compaction
   * @returns True if session should be compacted
   */
  needsCompactionWithThreshold(sessionId: string, threshold: number): boolean {
    const session = this.store.get(sessionId);

    if (!session) {
      return false;
    }

    return session.events.length >= threshold;
  }

  /**
   * Generate summary of events using rule-based approach
   *
   * @param events - Events to summarize
   * @returns Generated summary text
   */
  generateSummary(events: SessionEvent[]): string {
    if (events.length === 0) {
      return "No events to summarize";
    }

    // Group events by type
    const groups = this.groupEventsByType(events);
    const summaryParts: string[] = [];

    // Summarize each group
    for (const [type, group] of Object.entries(groups)) {
      const typeSummary = this.summarizeGroup(type, group);
      if (typeSummary) {
        summaryParts.push(typeSummary);
      }
    }

    // Add time range
    const timeRange = this.formatTimeRange(
      events[0].timestamp,
      events[events.length - 1].timestamp
    );

    return `[Compacted: ${timeRange}]\n${summaryParts.join("\n")}`;
  }

  /**
   * Group events by consecutive type
   */
  private groupEventsByType(events: SessionEvent[]): Record<string, EventGroup> {
    const groups: Record<string, EventGroup> = {};
    let currentType: string | null = null;
    let currentGroup: SessionEvent[] = [];

    for (const event of events) {
      if (event.type === "compact") {
        // Skip existing compacted events
        continue;
      }

      if (currentType !== event.type) {
        // Save previous group
        if (currentType && currentGroup.length > 0) {
          groups[currentType] = {
            type: currentType,
            events: currentGroup,
            startTimestamp: currentGroup[0].timestamp,
            endTimestamp: currentGroup[currentGroup.length - 1].timestamp,
          };
        }

        // Start new group
        currentType = event.type;
        currentGroup = [event];
      } else {
        currentGroup.push(event);
      }
    }

    // Save last group
    if (currentType && currentGroup.length > 0) {
      groups[currentType] = {
        type: currentType,
        events: currentGroup,
        startTimestamp: currentGroup[0].timestamp,
        endTimestamp: currentGroup[currentGroup.length - 1].timestamp,
      };
    }

    return groups;
  }

  /**
   * Summarize a group of events
   */
  private summarizeGroup(type: string, group: EventGroup): string {
    const count = group.events.length;

    switch (type) {
      case "tool":
        return this.summarizeToolEvents(group.events);

      case "message":
        return `Processed ${count} messages`;

      case "error":
        return this.summarizeErrorEvents(group.events);

      case "snapshot":
        return this.summarizeSnapshotEvents(group.events);

      default:
        return `${count} ${type} events`;
    }
  }

  /**
   * Summarize tool events
   */
  private summarizeToolEvents(events: SessionEvent[]): string {
    const toolCounts = new Map<string, number>();
    const fileReads: string[] = [];
    let fileWrites = 0;
    let otherTools = 0;

    for (const event of events) {
      const data = event.data as ToolEventData;
      const toolName = data.name || "unknown";

      toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);

      // Track file operations
      if (toolName === "Read" || toolName === "Grep" || toolName === "Glob") {
        // Extract file paths if available
        if (data.file_path) {
          fileReads.push(data.file_path as string);
        } else if (data.pattern) {
          fileReads.push(`pattern: ${data.pattern}`);
        }
      } else if (toolName === "Write" || toolName === "Edit") {
        fileWrites++;
      } else {
        otherTools++;
      }
    }

    const parts: string[] = [];

    // Summarize by tool type
    if (fileReads.length > 0) {
      const uniqueFiles = new Set(fileReads);
      const fileList = Array.from(uniqueFiles)
        .slice(0, 5)
        .map((f) => {
          // Extract just filename for readability
          const parts = f.split(/[/\\]/);
          return parts[parts.length - 1] || f;
        })
        .join(", ");

      if (uniqueFiles.size > 5) {
        parts.push(`Read ${uniqueFiles.size} files including: ${fileList}...`);
      } else {
        parts.push(`Read files: ${fileList}`);
      }
    }

    if (fileWrites > 0) {
      parts.push(`Modified ${fileWrites} file${fileWrites > 1 ? "s" : ""}`);
    }

    if (otherTools > 0) {
      const topTools = Array.from(toolCounts.entries())
        .filter(
          ([name]) =>
            name !== "Read" &&
            name !== "Write" &&
            name !== "Edit" &&
            name !== "Grep" &&
            name !== "Glob"
        )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => `${name} (${count})`);

      if (topTools.length > 0) {
        parts.push(`Executed tools: ${topTools.join(", ")}`);
      } else {
        parts.push(`Executed ${otherTools} tool${otherTools > 1 ? "s" : ""}`);
      }
    }

    return parts.length > 0 ? `Tool operations: ${parts.join("; ")}` : "Executed tools";
  }

  /**
   * Summarize error events
   */
  private summarizeErrorEvents(events: SessionEvent[]): string {
    const errorTypes = new Map<string, number>();

    for (const event of events) {
      const data = event.data as ErrorEventData;
      const message = data.message || "Unknown error";

      // Group by error type
      let errorType = "unknown";
      if (message.includes("not found")) {
        errorType = "not_found";
      } else if (message.includes("permission") || message.includes("denied")) {
        errorType = "permission";
      } else if (message.includes("timeout")) {
        errorType = "timeout";
      } else if (message.includes("syntax") || message.includes("parse")) {
        errorType = "syntax";
      }

      errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
    }

    const totalErrors = events.length;
    const uniqueTypes = errorTypes.size;

    if (uniqueTypes === 1) {
      const type = Array.from(errorTypes.keys())[0];
      return `Encountered ${totalErrors} ${type} error${totalErrors > 1 ? "s" : ""}`;
    }

    return `Encountered ${totalErrors} errors across ${uniqueTypes} categories`;
  }

  /**
   * Summarize snapshot events
   */
  private summarizeSnapshotEvents(events: SessionEvent[]): string {
    const snapshots = events.map((e) => e.data as SnapshotEventData);
    const avgHealth =
      snapshots.reduce((sum, s) => sum + (s.healthScore || 0), 0) / snapshots.length;

    return `Created ${events.length} snapshot${events.length > 1 ? "s" : ""} (avg health: ${avgHealth.toFixed(2)})`;
  }

  /**
   * Format time range for summary
   */
  private formatTimeRange(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
    }
  }

  /**
   * Generate LLM-based summary (future implementation)
   *
   * This method will use the Claude API to generate more intelligent summaries.
   * Currently returns the rule-based summary.
   */
  async generateLLMSummary(events: SessionEvent[]): Promise<string> {
    // TODO: Implement LLM-based summarization using Claude API
    // This would:
    // 1. Extract relevant context from events
    // 2. Call Claude API with a summarization prompt
    // 3. Return the generated summary

    return this.generateSummary(events);
  }

  /**
   * Get compaction statistics for a session
   *
   * @param sessionId - ID of session to analyze
   * @returns Statistics about potential compaction
   */
  getCompactionStats(sessionId: string): {
    eventCount: number;
    wouldCompact: boolean;
    estimatedSpaceSaved: number;
  } {
    const session = this.store.get(sessionId);

    if (!session) {
      return {
        eventCount: 0,
        wouldCompact: false,
        estimatedSpaceSaved: 0,
      };
    }

    const eventCount = session.events.length;
    const wouldCompact = eventCount >= this.defaults.compactThreshold;

    // Estimate space saved by comparing full size vs compacted
    const eventsToCompact = wouldCompact
      ? session.events.slice(0, -this.defaults.keepRecentEvents)
      : [];
    const estimatedSpaceSaved = wouldCompact
      ? JSON.stringify(eventsToCompact).length * 0.9 // Rough 90% reduction estimate
      : 0;

    return {
      eventCount,
      wouldCompact,
      estimatedSpaceSaved: Math.floor(estimatedSpaceSaved),
    };
  }
}
