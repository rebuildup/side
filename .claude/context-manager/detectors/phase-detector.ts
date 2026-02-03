/**
 * Phase Detector for Claude Context Manager
 *
 * Dynamically detects the current phase of a development session
 * by analyzing message patterns using a sliding window approach.
 */

import { PHASE_DETECTION } from "../config";
import type { ClaudeSession, SessionEvent } from "../types";

/**
 * Phase transition event in the session
 */
export interface PhaseTransition {
  from: string | null;
  to: string;
  at: string; // timestamp
  eventIndex: number;
}

/**
 * All recognized phases in the development lifecycle
 */
export type DevelopmentPhase =
  | "initialization"
  | "research"
  | "planning"
  | "implementation"
  | "testing"
  | "debugging"
  | "review"
  | "documentation";

/**
 * Pattern definitions for each phase
 */
const PHASE_PATTERNS: Record<DevelopmentPhase, RegExp[]> = {
  initialization: [/\b(start|begin|new|session|init|initialize)\b/i, /\b(let's|lets|starting)\b/i],
  research: [
    /\b(what|how|why|explain|understand|describe|overview|context)\b/i,
    /\b(research|investigate|explore|find out|learn about)\b/i,
    /\b(can you tell|tell me about|show me|help me understand)\b/i,
  ],
  planning: [
    /\b(plan|design|architecture|approach|strategy|structure)\b/i,
    /\b(how should|what's the best|how to organize|break down)\b/i,
    /\b(before we|first we|step by step|outline)\b/i,
  ],
  implementation: [
    /\b(implement|create|write|add|build|make|code|develop)\b/i,
    /\b(function|class|component|module|file)\b/i,
    /\b(generate|produce|construct)\b/i,
  ],
  testing: [
    /\b(test|verify|check|validate|confirm|ensure)\b/i,
    /\b(spec|coverage|assert|expect|mock|stub)\b/i,
    /\b(run tests|test suite|unit test|integration test)\b/i,
  ],
  debugging: [
    /\b(fix|bug|error|issue|problem|broken|doesn't work|fail)\b/i,
    /\b(debug|troubleshoot|resolve|correct|repair)\b/i,
    /\b(not working|failing|throwing|exception|error message)\b/i,
  ],
  review: [
    /\b(review|refactor|improve|optimize|clean up|better)\b/i,
    /\b(code review|improve performance|simplify|reorganize)\b/i,
    /\b(quality|best practice|maintainability)\b/i,
  ],
  documentation: [
    /\b(document|comment|readme|docs|documentation)\b/i,
    /\b(explain this|add comments|write docs)\b/i,
  ],
};

/**
 * Minimum confidence threshold for phase detection
 */
const MIN_CONFIDENCE = 0.1;

/**
 * Smoothing factor for confidence calculations (0-1)
 * Higher values = more weight to recent messages
 */
const SMOOTHING_FACTOR = 0.7;

/**
 * Extract text content from a session event
 */
function extractEventText(event: SessionEvent): string {
  if (event.type === "message") {
    const data = event.data as { prompt?: string; response?: string };
    return data.prompt || data.response || "";
  }
  if (event.type === "error") {
    const data = event.data as { message?: string; error?: string };
    return data.message || data.error || "";
  }
  return "";
}

/**
 * Calculate pattern matches for a given text against phase patterns
 */
function countPatternMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Apply exponential smoothing to confidence scores
 */
function smoothConfidence(
  oldConfidence: number,
  newConfidence: number,
  factor: number = SMOOTHING_FACTOR
): number {
  return oldConfidence * factor + newConfidence * (1 - factor);
}

/**
 * Phase Detector
 *
 * Analyzes session messages to dynamically determine the current development phase
 * using pattern matching with sliding window analysis and confidence smoothing.
 */
export class PhaseDetector {
  private readonly windowSize: number;
  private readonly smoothingFactor: number;

  /**
   * Create a new PhaseDetector
   *
   * @param windowSize - Number of recent messages to analyze (default: from config)
   * @param smoothingFactor - Confidence smoothing factor 0-1 (default: 0.7)
   */
  constructor(
    windowSize: number = PHASE_DETECTION.WINDOW_SIZE,
    smoothingFactor: number = SMOOTHING_FACTOR
  ) {
    this.windowSize = Math.max(1, windowSize);
    this.smoothingFactor = Math.max(0, Math.min(1, smoothingFactor));
  }

  /**
   * Detect the current phase of a session
   *
   * Analyzes the last N messages using pattern matching and returns
   * the phase with the highest confidence score.
   *
   * @param session - The Claude session to analyze
   * @returns The detected phase name
   */
  detectPhase(session: ClaudeSession): string {
    if (session.events.length === 0) {
      return "initialization";
    }

    // Get recent events within the sliding window
    const recentEvents = this.getRecentEvents(session);

    // Calculate confidence scores for each phase
    const phaseScores = this.calculatePhaseScores(recentEvents);

    // Find the phase with the highest score
    let bestPhase = "initialization";
    let bestScore = MIN_CONFIDENCE;

    for (const [phase, score] of Object.entries(phaseScores)) {
      if (score > bestScore) {
        bestPhase = phase;
        bestScore = score;
      }
    }

    return bestPhase;
  }

  /**
   * Get confidence score for a specific phase
   *
   * Returns a value between 0 and 1 indicating how strongly the session
   * matches the given phase patterns.
   *
   * @param session - The Claude session to analyze
   * @param phase - The phase to check confidence for
   * @returns Confidence score (0-1)
   */
  getPhaseConfidence(session: ClaudeSession, phase: string): number {
    if (session.events.length === 0) {
      return phase === "initialization" ? 1.0 : 0.0;
    }

    const recentEvents = this.getRecentEvents(session);
    const phaseScores = this.calculatePhaseScores(recentEvents);

    return phaseScores[phase as DevelopmentPhase] || 0.0;
  }

  /**
   * Get all detected phase transitions in the session
   *
   * Analyzes the entire session history to identify when phases changed.
   * Returns a chronological list of transitions.
   *
   * @param session - The Claude session to analyze
   * @returns Array of phase transitions in chronological order
   */
  getPhaseHistory(session: ClaudeSession): PhaseTransition[] {
    const transitions: PhaseTransition[] = [];
    const events = session.events;

    if (events.length === 0) {
      return transitions;
    }

    // Track phase history through the session
    const _phaseHistory: string[] = [];
    let currentPhase = "initialization";

    // Analyze events in chunks to detect phase changes
    for (let i = 0; i < events.length; i++) {
      const windowEnd = i + 1;
      const windowStart = Math.max(0, windowEnd - this.windowSize);
      const windowEvents = events.slice(windowStart, windowEnd);

      const detectedPhase = this.detectPhaseFromEvents(windowEvents);

      if (detectedPhase !== currentPhase) {
        transitions.push({
          from: currentPhase,
          to: detectedPhase,
          at: events[i].timestamp,
          eventIndex: i,
        });
        currentPhase = detectedPhase;
      }
    }

    return transitions;
  }

  /**
   * Get all available phases
   *
   * @returns Array of all recognized phase names
   */
  getAllPhases(): DevelopmentPhase[] {
    return Object.keys(PHASE_PATTERNS) as DevelopmentPhase[];
  }

  /**
   * Get recent events within the sliding window
   */
  private getRecentEvents(session: ClaudeSession): SessionEvent[] {
    return session.events.slice(-this.windowSize);
  }

  /**
   * Calculate confidence scores for all phases
   *
   * Uses pattern matching with confidence smoothing to reduce jitter.
   */
  private calculatePhaseScores(events: SessionEvent[]): Record<string, number> {
    const scores: Record<string, number> = {};

    // Initialize all phases with minimum confidence
    for (const phase of this.getAllPhases()) {
      scores[phase] = MIN_CONFIDENCE;
    }

    // Extract text from all events in the window
    const combinedText = events.map(extractEventText).filter(Boolean).join(" ");

    if (!combinedText) {
      return scores;
    }

    // Count total matches across all phases for normalization
    let totalMatches = 0;
    const rawMatches: Record<string, number> = {};

    for (const [phase, patterns] of Object.entries(PHASE_PATTERNS)) {
      const count = countPatternMatches(combinedText, patterns);
      rawMatches[phase] = count;
      totalMatches += count;
    }

    // Normalize scores to 0-1 range with smoothing
    const maxMatches = Math.max(1, totalMatches);

    for (const phase of this.getAllPhases()) {
      const rawScore = rawMatches[phase] / maxMatches;
      scores[phase] = smoothConfidence(MIN_CONFIDENCE, rawScore, this.smoothingFactor);
    }

    return scores;
  }

  /**
   * Detect phase from a set of events (for internal use)
   */
  private detectPhaseFromEvents(events: SessionEvent[]): string {
    if (events.length === 0) {
      return "initialization";
    }

    const combinedText = events.map(extractEventText).filter(Boolean).join(" ");

    if (!combinedText) {
      return "initialization";
    }

    let bestPhase = "initialization";
    let bestScore = 0;

    for (const [phase, patterns] of Object.entries(PHASE_PATTERNS)) {
      const score = countPatternMatches(combinedText, patterns);
      if (score > bestScore) {
        bestPhase = phase;
        bestScore = score;
      }
    }

    return bestPhase;
  }
}
