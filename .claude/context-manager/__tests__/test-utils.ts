/**
 * Test Utilities for Claude Context Manager
 *
 * Provides mock implementations and utilities for testing.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ClaudeSession } from "../types";

/**
 * Create a temporary directory for test isolation
 */
export function createTempDir(): string {
  const tempPrefix = path.join(os.tmpdir(), "ctx-mgr-test-");
  return fs.mkdtempSync(tempPrefix);
}

/**
 * Clean up temporary directory
 */
export function cleanupTempDir(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * In-memory session store for testing
 * Avoids fsync issues on Windows
 */
export class MemorySessionStore {
  private readonly sessions: Map<string, ClaudeSession> = new Map();

  constructor(readonly _sessionsDir: string) {}

  /**
   * Create a new session with initial prompt
   */
  create(sessionId: string, initialPrompt: string): ClaudeSession {
    const now = new Date().toISOString();
    const session: ClaudeSession = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      metadata: {
        initialPrompt,
        phase: "initialization",
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
          type: "message",
          data: { prompt: initialPrompt },
        },
      ],
      snapshots: [],
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID, returns null if not found
   */
  get(sessionId: string): ClaudeSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Update session with partial data, automatically updates updatedAt
   */
  update(sessionId: string, updates: Partial<ClaudeSession>): void {
    const existing = this.get(sessionId);
    if (!existing) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const merged: ClaudeSession = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, merged);
  }

  /**
   * Delete session by ID
   */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * List all sessions
   */
  list(): ClaudeSession[] {
    const sessions = Array.from(this.sessions.values());
    return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Get all sessions map (for testing)
   */
  getAll(): Map<string, ClaudeSession> {
    return new Map(this.sessions);
  }

  /**
   * Clear all sessions (for testing)
   */
  clear(): void {
    this.sessions.clear();
  }
}

/**
 * Test context holder
 */
export interface TestContext {
  tempDir: string;
  store: MemorySessionStore;
  sessionId: string;
}

/**
 * Set up a test context
 */
export function setupTest(): TestContext {
  const tempDir = createTempDir();
  const store = new MemorySessionStore(path.join(tempDir, "sessions"));
  const sessionId = `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return { tempDir, store, sessionId };
}

/**
 * Tear down a test context
 */
export function teardownTest(ctx: TestContext): void {
  ctx.store.clear();
  cleanupTempDir(ctx.tempDir);
}

/**
 * Assert condition is true, throw if not
 */
export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert actual equals expected
 */
export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`
    );
  }
}

/**
 * Assert actual is in range
 */
export function assertInRange(actual: number, min: number, max: number, message: string): void {
  if (actual < min || actual > max) {
    throw new Error(
      `Assertion failed: ${message}\n  Expected range: [${min}, ${max}]\n  Actual: ${actual}`
    );
  }
}

/**
 * Assert actual deep equals expected
 */
export function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);

  if (actualStr !== expectedStr) {
    throw new Error(
      `Assertion failed: ${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`
    );
  }
}

/**
 * Assert throws an error
 */
export async function assertThrows(
  fn: () => void | Promise<void>,
  expectedMessage?: string
): Promise<void> {
  let threw = false;
  let actualError: Error | null = null;

  try {
    await fn();
  } catch (error) {
    threw = true;
    actualError = error instanceof Error ? error : new Error(String(error));
  }

  if (!threw) {
    throw new Error("Expected function to throw an error, but it did not");
  }

  if (expectedMessage && actualError) {
    if (!actualError.message.includes(expectedMessage)) {
      throw new Error(
        `Expected error message to include "${expectedMessage}", but got "${actualError.message}"`
      );
    }
  }
}

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test result container
 */
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

/**
 * Test suite class
 */
export class TestSuite {
  private results: TestResult[] = [];
  private beforeEachFns: Array<(ctx: TestContext) => void> = [];
  private afterEachFns: Array<(ctx: TestContext) => void> = [];

  /**
   * Register a before each hook
   */
  beforeEach(fn: (ctx: TestContext) => void): void {
    this.beforeEachFns.push(fn);
  }

  /**
   * Register an after each hook
   */
  afterEach(fn: (ctx: TestContext) => void): void {
    this.afterEachFns.push(fn);
  }

  /**
   * Run a test function and record results
   */
  async test(name: string, fn: (ctx: TestContext) => Promise<void> | void): Promise<void> {
    const ctx = setupTest();
    const startTime = Date.now();

    try {
      // Run before each hooks
      for (const hook of this.beforeEachFns) {
        hook(ctx);
      }

      // Run the test
      await fn(ctx);

      // Run after each hooks
      for (const hook of this.afterEachFns) {
        hook(ctx);
      }

      this.results.push({
        name,
        passed: true,
        duration: Date.now() - startTime,
      });
      console.log(`  ✓ ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({
        name,
        passed: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      });
      console.error(`  ✗ ${name}`);
      console.error(`    ${errorMessage}`);
    } finally {
      teardownTest(ctx);
    }
  }

  /**
   * Print test results summary
   */
  printSummary(): void {
    console.log(`\n${"=".repeat(60)}`);
    console.log("Test Results Summary");
    console.log("=".repeat(60));

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${totalDuration}ms`);
    console.log(`Success rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log("\nFailed tests:");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.name}`);
          console.log(`    ${r.error}`);
        });
    }

    console.log("=".repeat(60));
  }

  /**
   * Get exit code based on results
   */
  getExitCode(): number {
    return this.results.some((r) => !r.passed) ? 1 : 0;
  }

  /**
   * Get all results
   */
  getResults(): TestResult[] {
    return [...this.results];
  }
}
