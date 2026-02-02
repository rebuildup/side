/**
 * Session Monitor for Claude Context Manager
 *
 * Tracks session metrics including:
 * - Token consumption (cumulative)
 * - Message count
 * - Error occurrences
 * - Retry attempts
 * - Keyword extraction
 * - File path tracking
 */

import { SessionStore } from '../storage/session-store';
import type { ClaudeSession } from '../types';

/**
 * Tool execution record for retry detection
 */
export interface ToolExecution {
  toolName: string;
  args: string; // Stringified args for comparison
  timestamp: number;
}

/**
 * Metrics snapshot for a session
 */
export interface SessionMetrics {
  totalTokens: number;
  messageCount: number;
  errorCount: number;
  retryCount: number;
  recentKeywords: string[];
  recentFiles: string[];
}

/**
 * Configuration options for SessionMonitor
 */
export interface MonitorOptions {
  /**
   * Time window in milliseconds to detect retries (default: 30s)
   */
  retryWindowMs?: number;

  /**
   * Maximum number of recent keywords to track (default: 50)
   */
  maxKeywords?: number;

  /**
   * Maximum number of recent files to track (default: 20)
   */
  maxFiles?: number;

  /**
   * Token estimation ratio for English (chars per token, default: 4)
   */
  englishCharsPerToken?: number;

  /**
   * Token estimation ratio for Japanese (chars per token, default: 2)
   */
  japaneseCharsPerToken?: number;
}

/**
 * Regex patterns for keyword extraction
 */
const EXTRACTION_PATTERNS = {
  // File paths with common extensions
  filePath: /[\w~/\.]+\.(?:ts|tsx|js|jsx|py|go|rs|java|kt|swift|html|css|scss|sass|less|json|yaml|yml|xml|toml|md|txt)/gi,

  // URLs/URIs
  url: /https?:\/\/[^\s<>"]+/gi,

  // camelCase identifiers (e.g., myVariable, getUserData)
  camelCase: /\b[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*\b/g,

  // PascalCase identifiers (e.g., MyClass, ButtonComponent)
  pascalCase: /\b[A-Z][a-z0-9]*[A-Z][a-z0-9]+\b/g,

  // UPPER_CASE identifiers (e.g., MAX_VALUE, API_KEY)
  upperCase: /\b[A-Z][A-Z0-9_]{2,}\b/g,

  // kebab-case identifiers (e.g., my-component, api-endpoint)
  kebabCase: /\b[a-z][a-z0-9]*(-[a-z0-9]+)+\b/g,

  // snake_case identifiers (e.g., my_variable, api_key)
  snakeCase: /\b[a-z][a-z0-9]*(_[a-z0-9]+)+\b/g,
};

/**
 * Common non-technical words to filter out
 */
const COMMON_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'has', 'have', 'been', 'this', 'that',
  'with', 'they', 'from', 'what', 'which', 'their', 'there', 'would',
  'about', 'could', 'should', 'after', 'before', 'being', 'does', 'did',
  'will', 'shall', 'may', 'might', 'must', 'into', 'through', 'during',
  'these', 'those', 'each', 'every', 'some', 'such', 'your', 'mine', 'were',
  'when', 'where', 'while', 'until', 'since', 'because', 'although', 'though',
  'get', 'set', 'put', 'add', 'use', 'new', 'old', 'own', 'same', 'just',
]);

/**
 * Detect if text contains Japanese characters
 */
function containsJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

/**
 * Estimate token count from text
 * Uses simple heuristic based on character composition
 */
function estimateTokens(text: string, options: MonitorOptions): number {
  const englishRatio = options.englishCharsPerToken ?? 4;
  const japaneseRatio = options.japaneseCharsPerToken ?? 2;

  // Check for Japanese characters
  if (containsJapanese(text)) {
    return Math.ceil(text.length / japaneseRatio);
  }

  // Default to English estimation
  return Math.ceil(text.length / englishRatio);
}

/**
 * Extract file paths from text
 */
function extractFilePaths(text: string): Set<string> {
  const filePaths = new Set<string>();
  const matches = text.match(EXTRACTION_PATTERNS.filePath) || [];

  for (const path of matches) {
    // Normalize path separators
    const normalized = path.replace(/\\/g, '/');
    filePaths.add(normalized);
  }

  return filePaths;
}

/**
 * Extract technical keywords from text
 */
function extractKeywords(text: string, existingKeywords: Set<string>): Set<string> {
  const keywords = new Set<string>();

  // Extract all identifier patterns
  for (const pattern of [
    EXTRACTION_PATTERNS.camelCase,
    EXTRACTION_PATTERNS.pascalCase,
    EXTRACTION_PATTERNS.upperCase,
    EXTRACTION_PATTERNS.kebabCase,
    EXTRACTION_PATTERNS.snakeCase,
  ]) {
    const matches = text.match(pattern) || [];
    for (const word of matches) {
      const lower = word.toLowerCase();
      // Filter out common words and very short words
      if (word.length > 2 && !COMMON_WORDS.has(lower)) {
        keywords.add(lower);
      }
    }
  }

  // Extract domains from URLs
  const urls = text.match(EXTRACTION_PATTERNS.url) || [];
  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '');
      keywords.add(domain);
    } catch {
      // Invalid URL, skip
    }
  }

  // Merge with existing keywords
  return new Set([...existingKeywords, ...keywords]);
}

/**
 * Serialize args for comparison (handles circular references)
 */
function serializeArgs(args: unknown): string {
  try {
    return JSON.stringify(args, (_, value) => {
      if (typeof value === 'function') {
        return '[Function]';
      }
      if (value instanceof Error) {
        return { name: value.name, message: value.message };
      }
      return value;
    });
  } catch {
    return String(args);
  }
}

/**
 * Check if two serialized args are similar enough to be a retry
 */
function areSimilarArgs(args1: string, args2: string): boolean {
  // Direct match
  if (args1 === args2) {
    return true;
  }

  // Length similarity check (within 10%)
  const len1 = args1.length;
  const len2 = args2.length;
  const lengthDiff = Math.abs(len1 - len2) / Math.max(len1, len2);
  if (lengthDiff > 0.1) {
    return false;
  }

  // Simple diff: if most characters are the same, consider similar
  let sameCount = 0;
  const minLen = Math.min(len1, len2);
  for (let i = 0; i < minLen; i++) {
    if (args1[i] === args2[i]) {
      sameCount++;
    }
  }

  return sameCount / minLen > 0.9;
}

/**
 * Session Monitor
 *
 * Tracks and aggregates session metrics across message exchanges,
 * tool executions, and errors. Provides real-time insights into
 * session behavior and resource consumption.
 */
export class SessionMonitor {
  private readonly options: Required<MonitorOptions>;
  private readonly toolExecutions: Map<string, ToolExecution[]> = new Map();

  constructor(
    private readonly store: SessionStore,
    options: MonitorOptions = {}
  ) {
    this.options = {
      retryWindowMs: options.retryWindowMs ?? 30000, // 30 seconds
      maxKeywords: options.maxKeywords ?? 50,
      maxFiles: options.maxFiles ?? 20,
      englishCharsPerToken: options.englishCharsPerToken ?? 4,
      japaneseCharsPerToken: options.japaneseCharsPerToken ?? 2,
    };
  }

  /**
   * Track a message exchange (user or assistant)
   *
   * Updates token count, message count, and extracts keywords/file paths.
   *
   * @param sessionId - The session ID
   * @param role - Message role ('user' or 'assistant')
   * @param content - Message content
   */
  trackMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Estimate token count for this message
    const tokens = estimateTokens(content, this.options);

    // Extract keywords and file paths
    const filePaths = extractFilePaths(content);
    const existingKeywords = new Set(session.topicTracking.keywords);
    const keywords = extractKeywords(content, existingKeywords);

    // Update session metrics
    this.store.update(sessionId, {
      metrics: {
        ...session.metrics,
        totalTokens: session.metrics.totalTokens + tokens,
        messageCount: session.metrics.messageCount + 1,
      },
      topicTracking: {
        ...session.topicTracking,
        // Limit keywords to max size
        keywords: Array.from(keywords).slice(0, this.options.maxKeywords),
        // Merge and limit file paths
        filePaths: Array.from(
          new Set([...session.topicTracking.filePaths, ...filePaths])
        ).slice(0, this.options.maxFiles),
      },
      events: [
        ...session.events,
        {
          timestamp: new Date().toISOString(),
          type: 'message',
          data: { role, tokens, keywordCount: keywords.size },
        },
      ],
    });
  }

  /**
   * Track a tool execution
   *
   * Detects retries by comparing with recent executions of the same tool.
   *
   * @param sessionId - The session ID
   * @param toolName - Name of the tool being executed
   * @param args - Tool arguments
   * @param result - Tool execution result
   */
  trackTool(sessionId: string, toolName: string, args: unknown, result: unknown): void {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const now = Date.now();
    const serializedArgs = serializeArgs(args);

    // Check for retry (same tool + similar args within time window)
    const recentExecutions = this.toolExecutions.get(toolName) || [];
    const isRetry = recentExecutions.some(
      (exec) =>
        now - exec.timestamp < this.options.retryWindowMs &&
        areSimilarArgs(exec.args, serializedArgs)
    );

    // Update retry count if detected
    const retryCount = isRetry ? session.metrics.retryCount + 1 : session.metrics.retryCount;

    // Record this execution
    recentExecutions.push({
      toolName,
      args: serializedArgs,
      timestamp: now,
    });

    // Clean up old executions outside the window
    this.toolExecutions.set(
      toolName,
      recentExecutions.filter((exec) => now - exec.timestamp < this.options.retryWindowMs)
    );

    // Estimate tokens from args and result
    const argsTokens = estimateTokens(serializedArgs, this.options);
    const resultTokens = estimateTokens(serializeArgs(result) || '', this.options);

    // Extract keywords from tool name and args
    const toolText = `${toolName} ${serializedArgs}`;
    const existingKeywords = new Set(session.topicTracking.keywords);
    const keywords = extractKeywords(toolText, existingKeywords);

    // Update session metrics
    this.store.update(sessionId, {
      metrics: {
        ...session.metrics,
        totalTokens: session.metrics.totalTokens + argsTokens + resultTokens,
        retryCount,
      },
      topicTracking: {
        ...session.topicTracking,
        keywords: Array.from(keywords).slice(0, this.options.maxKeywords),
      },
      events: [
        ...session.events,
        {
          timestamp: new Date().toISOString(),
          type: 'tool',
          data: {
            toolName,
            isRetry,
            tokens: argsTokens + resultTokens,
          },
        },
      ],
    });
  }

  /**
   * Track an error occurrence
   *
   * @param sessionId - The session ID
   * @param error - Error object or error message string
   */
  trackError(sessionId: string, error: Error | string): void {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Extract keywords from error message (often contains technical terms)
    const existingKeywords = new Set(session.topicTracking.keywords);
    const keywords = extractKeywords(errorMessage, existingKeywords);

    this.store.update(sessionId, {
      metrics: {
        ...session.metrics,
        errorCount: session.metrics.errorCount + 1,
      },
      topicTracking: {
        ...session.topicTracking,
        keywords: Array.from(keywords).slice(0, this.options.maxKeywords),
      },
      events: [
        ...session.events,
        {
          timestamp: new Date().toISOString(),
          type: 'error',
          data: {
            error: errorMessage,
            errorType: error instanceof Error ? error.constructor.name : 'string',
          },
        },
      ],
    });
  }

  /**
   * Get current metrics for a session
   *
   * Returns null if session doesn't exist.
   *
   * @param sessionId - The session ID
   * @returns Current metrics or null
   */
  getMetrics(sessionId: string): SessionMetrics | null {
    const session = this.store.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      totalTokens: session.metrics.totalTokens,
      messageCount: session.metrics.messageCount,
      errorCount: session.metrics.errorCount,
      retryCount: session.metrics.retryCount,
      recentKeywords: session.topicTracking.keywords,
      recentFiles: session.topicTracking.filePaths,
    };
  }

  /**
   * Get detailed health information for a session
   *
   * Includes metrics plus calculated health indicators.
   *
   * @param sessionId - The session ID
   * @returns Extended health info or null
   */
  getHealthInfo(sessionId: string): {
    metrics: SessionMetrics;
    healthScore: number;
    driftScore: number;
    avgTokensPerMessage: number;
    errorRate: number;
    retryRate: number;
  } | null {
    const session = this.store.get(sessionId);
    if (!session) {
      return null;
    }

    const metrics = this.getMetrics(sessionId)!;
    const avgTokensPerMessage =
      metrics.messageCount > 0 ? metrics.totalTokens / metrics.messageCount : 0;
    const errorRate =
      metrics.messageCount > 0 ? metrics.errorCount / metrics.messageCount : 0;
    const retryRate =
      metrics.messageCount > 0 ? metrics.retryCount / metrics.messageCount : 0;

    return {
      metrics,
      healthScore: session.metadata.healthScore,
      driftScore: session.metrics.driftScore,
      avgTokensPerMessage,
      errorRate,
      retryRate,
    };
  }

  /**
   * Reset tracking data for a session
   *
   * Clears metrics but preserves session metadata.
   *
   * @param sessionId - The session ID
   */
  reset(sessionId: string): void {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.store.update(sessionId, {
      metrics: {
        totalTokens: 0,
        messageCount: 0,
        errorCount: 0,
        retryCount: 0,
        driftScore: 0,
      },
      topicTracking: {
        keywords: [],
        filePaths: [],
      },
    });

    // Clear tool execution cache for this session's context
    // (In a multi-session setup, you'd scope executions by session)
    this.toolExecutions.clear();
  }
}
