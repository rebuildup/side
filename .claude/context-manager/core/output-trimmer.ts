/**
 * Output Trimmer for Claude Context Manager
 *
 * Intelligently trims conversation output to maintain context relevance.
 */

import type { ClaudeMessage, ClaudeSession } from "../types";

/**
 * Trimming strategy options
 */
export interface TrimmerOptions {
  maxMessages?: number; // Maximum messages to keep (default: 50)
  preserveSystemMessages?: boolean; // Keep system messages (default: true)
  preserveFirstMessage?: boolean; // Keep initial user message (default: true)
  preserveRecent?: number; // Always keep last N messages (default: 10)
}

/**
 * Trimming result with metadata
 */
export interface TrimmerResult {
  originalCount: number;
  trimmedCount: number;
  removedCount: number;
  trimmedMessages: ClaudeMessage[];
  keptMessages: ClaudeMessage[];
}

/**
 * Output Trimmer
 *
 * Intelligently trims conversation history while preserving important context.
 */
export class OutputTrimmer {
  private readonly defaultOptions: Required<TrimmerOptions> = {
    maxMessages: 50,
    preserveSystemMessages: true,
    preserveFirstMessage: true,
    preserveRecent: 10,
  };

  constructor(private options: TrimmerOptions = {}) {}

  /**
   * Trim messages from a session
   */
  trim(session: ClaudeSession, customOptions?: TrimmerOptions): TrimmerResult {
    const opts = { ...this.defaultOptions, ...this.options, ...customOptions };
    const messages = session.messages || [];

    if (messages.length <= opts.maxMessages) {
      // No trimming needed
      return {
        originalCount: messages.length,
        trimmedCount: messages.length,
        removedCount: 0,
        trimmedMessages: [],
        keptMessages: messages,
      };
    }

    const messagesToKeep: ClaudeMessage[] = [];
    const removedMessages: ClaudeMessage[] = [];
    const processedIndices = new Set<number>();

    // Always preserve system messages
    if (opts.preserveSystemMessages) {
      messages.forEach((msg, idx) => {
        if (msg.role === "system") {
          messagesToKeep.push(msg);
          processedIndices.add(idx);
        }
      });
    }

    // Preserve first message (usually the initial prompt)
    if (opts.preserveFirstMessage && messages.length > 0) {
      if (!processedIndices.has(0)) {
        messagesToKeep.push(messages[0]);
        processedIndices.add(0);
      }
    }

    // Preserve last N messages (most recent context)
    const recentStart = Math.max(0, messages.length - opts.preserveRecent);
    for (let i = recentStart; i < messages.length; i++) {
      if (!processedIndices.has(i)) {
        messagesToKeep.push(messages[i]);
        processedIndices.add(i);
      }
    }

    // If we still have room, add more messages from the middle
    const remainingSlots = opts.maxMessages - messagesToKeep.length;
    if (remainingSlots > 0) {
      // Add messages from the middle, working backwards from recent
      let addedCount = 0;
      for (let i = recentStart - 1; i >= 0 && addedCount < remainingSlots; i--) {
        if (!processedIndices.has(i)) {
          messagesToKeep.unshift(messages[i]);
          processedIndices.add(i);
          addedCount++;
        }
      }
    }

    // Sort messages by timestamp (use 0 for missing/invalid timestamps)
    messagesToKeep.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return aTime - bTime;
    });

    // Collect removed messages
    messages.forEach((msg, idx) => {
      if (!processedIndices.has(idx)) {
        removedMessages.push(msg);
      }
    });

    return {
      originalCount: messages.length,
      trimmedCount: messagesToKeep.length,
      removedCount: removedMessages.length,
      trimmedMessages: removedMessages,
      keptMessages: messagesToKeep,
    };
  }

  /**
   * Trim messages array directly
   */
  trimMessages(messages: ClaudeMessage[], customOptions?: TrimmerOptions): ClaudeMessage[] {
    const result = this.trim(
      {
        id: "temp",
        createdAt: "",
        updatedAt: "",
        metadata: { initialPrompt: "", phase: "", healthScore: 1 },
        metrics: {
          totalTokens: 0,
          messageCount: 0,
          errorCount: 0,
          retryCount: 0,
          driftScore: 0,
        },
        topicTracking: { keywords: [], filePaths: [] },
        events: [],
        snapshots: [],
        messages,
      },
      customOptions
    );

    return result.keptMessages;
  }

  /**
   * Estimate if trimming is needed
   */
  needsTrimming(session: ClaudeSession, customOptions?: TrimmerOptions): boolean {
    const opts = { ...this.defaultOptions, ...this.options, ...customOptions };
    const messages = session.messages || [];
    return messages.length > opts.maxMessages;
  }

  /**
   * Get trimming statistics
   */
  getStats(session: ClaudeSession): {
    totalMessages: number;
    systemMessages: number;
    userMessages: number;
    assistantMessages: number;
    wouldTrim: boolean;
    wouldRemove: number;
  } {
    const messages = session.messages || [];
    const opts = { ...this.defaultOptions, ...this.options };

    const systemMessages = messages.filter((m) => m.role === "system").length;
    const userMessages = messages.filter((m) => m.role === "user").length;
    const assistantMessages = messages.filter((m) => m.role === "assistant").length;

    const needsTrim = this.needsTrimming(session);
    const wouldRemove = needsTrim ? messages.length - opts.maxMessages : 0;

    return {
      totalMessages: messages.length,
      systemMessages,
      userMessages,
      assistantMessages,
      wouldTrim: needsTrim,
      wouldRemove,
    };
  }

  /**
   * Update default options
   */
  setOptions(options: TrimmerOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): TrimmerOptions {
    return { ...this.options };
  }
}
