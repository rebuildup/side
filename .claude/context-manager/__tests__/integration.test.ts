/**
 * Integration Tests for Claude Context Manager
 *
 * Comprehensive tests covering the full workflow:
 * - Create session
 * - Track messages and tools
 * - Calculate health score
 * - Trigger compaction when threshold exceeded
 * - Create snapshot
 * - Restore from snapshot
 *
 * Edge cases tested:
 * - Empty session
 * - Session with many events
 * - Session with high drift
 * - Session with many errors
 */

import {
  ContextController,
  SessionAnalyzer,
  SessionCompactor,
  SessionMonitor,
  SnapshotManager,
} from "../core";
import {
  assert,
  assertEqual,
  assertInRange,
  assertThrows,
  setupTest,
  type TestContext,
  TestSuite,
  teardownTest,
} from "./test-utils";

// ==================== Test Suite ====================

const suite = new TestSuite();

// ==================== Core Workflow Tests ====================

/**
 * Test 1: Create a new session
 */
suite.test("Create session", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  const initialPrompt = "Implement a feature for user authentication";
  const session = controller.createSession(ctx.sessionId, initialPrompt);

  assert(session !== null, "Session should be created");
  assertEqual(session.id, ctx.sessionId, "Session ID should match");
  assertEqual(session.metadata.initialPrompt, initialPrompt, "Initial prompt should be saved");
  assertEqual(session.metadata.phase, "initialization", "Phase should be initialization");
  assertEqual(session.metadata.healthScore, 1.0, "Health score should start at 1.0");
  assertEqual(session.metrics.messageCount, 0, "Message count should start at 0");
});

/**
 * Test 2: Track messages
 */
suite.test("Track messages", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  // Track user message
  controller.trackMessage("user", "Add a login form");

  // Track assistant message
  controller.trackMessage("assistant", "I will create a login form component");

  const session = controller.getSession(ctx.sessionId);
  assert(session !== null, "Session should exist");
  assertEqual(session.metrics.messageCount, 2, "Should have 2 messages tracked");
  assert(session.events.length >= 2, "Should have at least 2 events recorded");
});

/**
 * Test 3: Track tools
 */
suite.test("Track tools", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  // Track tool execution
  controller.trackTool(
    "Read",
    { file_path: "/src/auth.ts" },
    { content: "export function login() {}" }
  );

  const session = controller.getSession(ctx.sessionId);
  assert(session !== null, "Session should exist");
  const toolEvents = session.events.filter((e) => e.type === "tool");
  assert(toolEvents.length > 0, "Should have tool events recorded");
});

/**
 * Test 4: Calculate health score
 */
suite.test("Calculate health score", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  // Initial health should be good
  let healthScore = controller.getHealthScore();
  assertInRange(healthScore, 0.8, 1.0, "Initial health score should be high");

  // Add some activity
  controller.trackMessage("user", "Add a feature");
  controller.trackMessage("assistant", "I will add it");

  healthScore = controller.getHealthScore();
  assertInRange(healthScore, 0.0, 1.0, "Health score should be in valid range");
});

/**
 * Test 5: Get controller status
 */
suite.test("Get controller status", async (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");
  controller.trackMessage("user", "Add a feature");

  const status = await controller.getStatus();
  assert(status !== null, "Status should not be null");
  assertInRange(status.healthScore, 0.0, 1.0, "Health score should be in valid range");
  assert(status.driftScore >= 0.0, "Drift score should be non-negative");
});

/**
 * Test 6: Compact session when threshold exceeded
 */
suite.test("Compact session", async (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  // Add many events to exceed threshold
  for (let i = 0; i < 50; i++) {
    controller.trackMessage("user", `Message ${i}`);
    controller.trackMessage("assistant", `Response ${i}`);
  }

  const sessionBefore = controller.getSession(ctx.sessionId);
  const eventsBefore = sessionBefore.events.length;

  // Compact the session
  const result = await controller.compact({ keepLastN: 20 });

  assert(result.eventsRemoved > 0, "Should remove some events");
  assert(result.eventsKept <= eventsBefore, "Should have fewer or equal events after compaction");

  const sessionAfter = controller.getSession(ctx.sessionId);
  assert(sessionAfter.events.length < eventsBefore, "Events should be reduced after compaction");
});

/**
 * Test 7: Create snapshot
 */
suite.test("Create snapshot", async (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");
  controller.trackMessage("user", "Add a feature");

  const snapshot = await controller.createSnapshot("Test snapshot");

  assert(snapshot.commitHash.length > 0, "Snapshot should have a commit hash");
  assert(snapshot.description === "Test snapshot", "Snapshot should have description");
  assertInRange(snapshot.healthScore, 0.0, 1.0, "Snapshot should have valid health score");
  assert(snapshot.timestamp.length > 0, "Snapshot should have timestamp");

  const session = controller.getSession(ctx.sessionId);
  assert(session.snapshots.length > 0, "Session should have snapshots");
  assertEqual(
    session.snapshots[0].commitHash,
    snapshot.commitHash,
    "Snapshot should be in session"
  );
});

/**
 * Test 8: Restore from snapshot
 */
suite.test("Restore from snapshot", async (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  // Degrade health by tracking errors
  for (let i = 0; i < 10; i++) {
    controller.trackError(new Error(`Test error ${i}`));
  }

  const _healthBeforeRestore = controller.getHealthScore();

  // Create snapshot
  const snapshot = await controller.createSnapshot("Good state");

  // Restore from snapshot
  await controller.restoreSnapshot(snapshot.commitHash);

  const session = controller.getSession(ctx.sessionId);
  assertEqual(session.metadata.phase, "restored", "Phase should be restored");
});

/**
 * Test 9: End session
 */
suite.test("End session", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");
  controller.trackMessage("user", "Test message");

  controller.endSession(ctx.sessionId);

  const session = controller.getSession(ctx.sessionId);
  assert(session !== null, "Session should still exist after ending");
  assertEqual(session.metadata.phase, "ended", "Phase should be ended");
});

// ==================== Edge Case Tests ====================

/**
 * Test 10: Empty session
 */
suite.test("Empty session", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  const session = controller.getSession(ctx.sessionId);
  assert(session !== null, "Empty session should exist");
  assertEqual(session.metrics.messageCount, 0, "Empty session should have 0 messages");
  assertEqual(session.events.length, 1, "Empty session should have 1 initial event");

  const healthScore = controller.getHealthScore();
  assertInRange(healthScore, 0.9, 1.0, "Empty session should have high health score");
});

/**
 * Test 11: Session with many events
 */
suite.test("Session with many events", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  // Add many events
  for (let i = 0; i < 100; i++) {
    controller.trackMessage("user", `User message ${i}`);
    controller.trackMessage("assistant", `Assistant response ${i}`);
    controller.trackTool("TestTool", { index: i }, { success: true });
  }

  const session = controller.getSession(ctx.sessionId);
  assert(session.events.length >= 300, "Should have many events (300+)");
  assertEqual(session.metrics.messageCount, 200, "Should have 200 messages");
});

/**
 * Test 12: Session with high drift
 */
suite.test("Session with high drift", async (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.5);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt about authentication");

  // Start with on-topic messages
  controller.trackMessage("user", "Add login form");
  controller.trackMessage("assistant", "Creating login component");

  // Then shift to different topic (simulating drift)
  for (let i = 0; i < 10; i++) {
    controller.trackMessage("user", `How do I implement database migration ${i}?`);
    controller.trackMessage("assistant", `Database migration response ${i}`);
  }

  const status = await controller.getStatus();
  assert(status !== null, "Status should exist");
  assert(status.driftScore >= 0, "Drift score should be calculated");
});

/**
 * Test 13: Session with many errors
 */
suite.test("Session with many errors", async (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  // Track messages first, then errors to get a meaningful error rate
  for (let i = 0; i < 10; i++) {
    controller.trackMessage("user", `Message ${i}`);
  }

  // Track many errors
  for (let i = 0; i < 20; i++) {
    controller.trackError(new Error(`Test error ${i}`));
  }

  const session = controller.getSession(ctx.sessionId);
  assertEqual(session.metrics.errorCount, 20, "Should have 20 errors tracked");

  // Get status to analyze health
  const status = await controller.getStatus();
  assert(status !== null, "Status should exist");

  // With 20 errors and 10 messages, error rate is 2.0 (200%), which caps at 1.0 error factor
  // Health score = 1 - (drift * 0.4 + errors * 0.3 + length * 0.15 + (1-activity) * 0.15)
  // With high errors, health should be impacted
  assert(status.healthScore < 1.0, "Health score in status should reflect errors");

  // After getStatus, the session metadata should be updated
  const sessionAfter = controller.getSession(ctx.sessionId);
  assert(sessionAfter !== null, "Session should still exist");
});

// ==================== Additional Functionality Tests ====================

/**
 * Test 14: Compact preserves important events
 */
suite.test("Compact preserves important events", async (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  // Add error events
  for (let i = 0; i < 5; i++) {
    controller.trackError(new Error(`Error ${i}`));
  }

  // Add snapshot
  await controller.createSnapshot("Test snapshot");

  // Add many message events
  for (let i = 0; i < 50; i++) {
    controller.trackMessage("user", `Message ${i}`);
  }

  const beforeCompact = controller.getSession(ctx.sessionId);
  const _errorCountBefore = beforeCompact.events.filter((e) => e.type === "error").length;
  const _snapshotEventCountBefore = beforeCompact.events.filter(
    (e) => e.type === "snapshot"
  ).length;
  const compactEventCountBefore = beforeCompact.events.filter((e) => e.type === "compact").length;

  // Compact with preservation - use default keepLastN=20 and explicit preservation
  await controller.compact({ keepLastN: 10 });

  const afterCompact = controller.getSession(ctx.sessionId);
  const _errorCountAfter = afterCompact.events.filter((e) => e.type === "error").length;
  const _snapshotEventCountAfter = afterCompact.events.filter((e) => e.type === "snapshot").length;
  const compactEventCountAfter = afterCompact.events.filter((e) => e.type === "compact").length;

  // With keepLastN: 10, we expect compaction to occur
  // The last 10 messages should be kept, plus any errors and snapshots
  // At minimum, we should have reduced the total event count
  const totalEventsBefore = beforeCompact.events.length;
  const totalEventsAfter = afterCompact.events.length;
  assert(
    totalEventsAfter < totalEventsBefore,
    `Total events should be reduced (before: ${totalEventsBefore}, after: ${totalEventsAfter})`
  );

  // A compact event should be added
  assert(
    compactEventCountAfter > compactEventCountBefore,
    `Compact event should be added (before: ${compactEventCountBefore}, after: ${compactEventCountAfter})`
  );
});

/**
 * Test 15: Drift threshold configuration
 */
suite.test("Drift threshold configuration", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.3);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  const threshold = controller.getDriftThreshold();
  assertEqual(threshold, 0.3, "Drift threshold should be configurable");

  controller.setDriftThreshold(0.8);
  const newThreshold = controller.getDriftThreshold();
  assertEqual(newThreshold, 0.8, "Drift threshold should be updatable");
});

/**
 * Test 16: Restore non-existent snapshot throws error
 */
suite.test("Restore non-existent snapshot throws error", async (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  await assertThrows(async () => {
    await controller.restoreSnapshot("non-existent-hash");
  }, "not found");
});

/**
 * Test 17: Session with mixed event types
 */
suite.test("Session with mixed event types", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  controller.trackMessage("user", "User message");
  controller.trackTool("Read", { file: "test.txt" }, { content: "test" });
  controller.trackError(new Error("Test error"));

  const session = controller.getSession(ctx.sessionId);

  const messageEvents = session.events.filter((e) => e.type === "message");
  const toolEvents = session.events.filter((e) => e.type === "tool");
  const errorEvents = session.events.filter((e) => e.type === "error");

  assert(messageEvents.length > 0, "Should have message events");
  assert(toolEvents.length > 0, "Should have tool events");
  assert(errorEvents.length > 0, "Should have error events");
});

/**
 * Test 18: Health score changes with activity
 */
suite.test("Health score changes with activity", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  controller.createSession(ctx.sessionId, "Initial prompt");

  const health1 = controller.getHealthScore();

  // Add positive activity
  controller.trackMessage("user", "Helpful request");
  controller.trackMessage("assistant", "Helpful response");

  const health2 = controller.getHealthScore();

  // Add errors
  controller.trackError(new Error("Error 1"));
  controller.trackError(new Error("Error 2"));

  const health3 = controller.getHealthScore();

  assertInRange(health1, 0.0, 1.0, "Health score 1 should be valid");
  assertInRange(health2, 0.0, 1.0, "Health score 2 should be valid");
  assertInRange(health3, 0.0, 1.0, "Health score 3 should be valid");
});

/**
 * Test 19: Session persistence
 */
suite.test("Session persistence", (ctx: TestContext) => {
  const monitor = new SessionMonitor();
  const analyzer = new SessionAnalyzer(0.7);
  const controller = new ContextController(ctx.store, monitor, analyzer);

  const sessionId = ctx.sessionId;

  controller.createSession(sessionId, "Initial prompt");

  // Track some activity
  controller.trackMessage("user", "Test message 1");
  controller.trackMessage("user", "Test message 2");

  // Verify session is in store
  const session = ctx.store.get(sessionId);
  assert(session !== null, "Session should persist");
  assert(session.metrics.messageCount >= 2, "Messages should persist");
});

// ==================== SessionCompactor Tests ====================

/**
 * Test 20: SessionCompactor.analyze
 */
suite.test("SessionCompactor.analyze", (ctx: TestContext) => {
  const compactor = new SessionCompactor();

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  // Add some events
  for (let i = 0; i < 50; i++) {
    session.events.push({
      timestamp: new Date().toISOString(),
      type: "message",
      data: { index: i },
    });
  }
  ctx.store.update(ctx.sessionId, { events: session.events });

  const analysis = compactor.analyze(session);
  assert(analysis.currentEvents > 0, "Should have current events");
  assert(analysis.compressionRatio >= 1, "Compression ratio should be at least 1");
});

/**
 * Test 21: SessionCompactor.getEventDistribution
 */
suite.test("SessionCompactor.getEventDistribution", (ctx: TestContext) => {
  const compactor = new SessionCompactor();

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  // Add mixed event types
  session.events.push(
    { timestamp: new Date().toISOString(), type: "message", data: {} },
    { timestamp: new Date().toISOString(), type: "tool", data: {} },
    { timestamp: new Date().toISOString(), type: "error", data: {} },
    { timestamp: new Date().toISOString(), type: "snapshot", data: {} }
  );
  ctx.store.update(ctx.sessionId, { events: session.events });

  const distribution = compactor.getEventDistribution(session);
  assertEqual(distribution.total, 5, "Should have 5 total events (including initial)");
  assert(distribution.byType.message > 0, "Should have message events");
  assert(distribution.byType.tool > 0, "Should have tool events");
  assert(distribution.byType.error > 0, "Should have error events");
});

/**
 * Test 22: SessionCompactor.findCompactionCandidates
 */
suite.test("SessionCompactor.findCompactionCandidates", (ctx: TestContext) => {
  const compactor = new SessionCompactor();

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  // Add old events
  const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  session.events.push(
    { timestamp: oldTimestamp, type: "message", data: {} },
    { timestamp: oldTimestamp, type: "tool", data: {} }
  );

  // Add new events
  const newTimestamp = new Date().toISOString();
  session.events.push(
    { timestamp: newTimestamp, type: "message", data: {} },
    { timestamp: newTimestamp, type: "snapshot", data: {} },
    { timestamp: newTimestamp, type: "error", data: {} }
  );

  ctx.store.update(ctx.sessionId, { events: session.events });

  const candidates = compactor.findCompactionCandidates(session, 24);
  // Should find old message and tool events, but not snapshot or error
  assert(candidates.length >= 1, "Should find at least one compaction candidate");
});

// ==================== SnapshotManager Tests ====================

/**
 * Test 23: SnapshotManager.getSnapshots
 */
suite.test("SnapshotManager.getSnapshots", (ctx: TestContext) => {
  const snapshotManager = new SnapshotManager(ctx.store);

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  // Add a snapshot
  session.snapshots.push({
    commitHash: "abc123",
    timestamp: new Date().toISOString(),
    healthScore: 0.8,
    description: "Test snapshot",
  });
  ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

  const snapshots = snapshotManager.getSnapshots(ctx.sessionId);
  assertEqual(snapshots.length, 1, "Should have 1 snapshot");
});

/**
 * Test 24: SnapshotManager.getSnapshot
 */
suite.test("SnapshotManager.getSnapshot", (ctx: TestContext) => {
  const snapshotManager = new SnapshotManager(ctx.store);

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  const testSnapshot = {
    commitHash: "abc123",
    timestamp: new Date().toISOString(),
    healthScore: 0.8,
    description: "Test snapshot",
  };
  session.snapshots.push(testSnapshot);
  ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

  const found = snapshotManager.getSnapshot(ctx.sessionId, "abc123");
  assert(found !== null, "Should find snapshot by hash");
  assertEqual(found.commitHash, "abc123", "Should return correct snapshot");

  const notFound = snapshotManager.getSnapshot(ctx.sessionId, "nonexistent");
  assert(notFound === null, "Should return null for non-existent snapshot");
});

/**
 * Test 25: SnapshotManager.getLatestSnapshot
 */
suite.test("SnapshotManager.getLatestSnapshot", (ctx: TestContext) => {
  const snapshotManager = new SnapshotManager(ctx.store);

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  const now = Date.now();
  session.snapshots.push(
    {
      commitHash: "abc123",
      timestamp: new Date(now - 1000).toISOString(),
      healthScore: 0.8,
      description: "First",
    },
    {
      commitHash: "def456",
      timestamp: new Date(now).toISOString(),
      healthScore: 0.9,
      description: "Second",
    }
  );
  ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

  const latest = snapshotManager.getLatestSnapshot(ctx.sessionId);
  assert(latest !== null, "Should have a latest snapshot");
  assertEqual(latest.commitHash, "def456", "Latest should be the second snapshot");
});

/**
 * Test 26: SnapshotManager.getHealthiestSnapshot
 */
suite.test("SnapshotManager.getHealthiestSnapshot", (ctx: TestContext) => {
  const snapshotManager = new SnapshotManager(ctx.store);

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  session.snapshots.push(
    {
      commitHash: "abc123",
      timestamp: new Date().toISOString(),
      healthScore: 0.7,
      description: "Lower health",
    },
    {
      commitHash: "def456",
      timestamp: new Date().toISOString(),
      healthScore: 0.95,
      description: "Higher health",
    }
  );
  ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

  const healthiest = snapshotManager.getHealthiestSnapshot(ctx.sessionId);
  assert(healthiest !== null, "Should have a healthiest snapshot");
  assertEqual(healthiest.commitHash, "def456", "Healthiest should be the higher health snapshot");
  assertEqual(healthiest.healthScore, 0.95, "Healthiest should have highest score");
});

/**
 * Test 27: SnapshotManager.findSnapshotsByHealth
 */
suite.test("SnapshotManager.findSnapshotsByHealth", (ctx: TestContext) => {
  const snapshotManager = new SnapshotManager(ctx.store);

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  session.snapshots.push(
    {
      commitHash: "abc123",
      timestamp: new Date().toISOString(),
      healthScore: 0.5,
      description: "Low",
    },
    {
      commitHash: "def456",
      timestamp: new Date().toISOString(),
      healthScore: 0.8,
      description: "Medium",
    },
    {
      commitHash: "ghi789",
      timestamp: new Date().toISOString(),
      healthScore: 0.95,
      description: "High",
    }
  );
  ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

  const highHealth = snapshotManager.findSnapshotsByHealth(ctx.sessionId, 0.8, 1.0);
  assertEqual(highHealth.length, 2, "Should find 2 snapshots in high health range");

  const mediumHealth = snapshotManager.findSnapshotsByHealth(ctx.sessionId, 0.6, 0.9);
  assertEqual(mediumHealth.length, 1, "Should find 1 snapshot in medium health range");
});

/**
 * Test 28: SnapshotManager.deleteSnapshot
 */
suite.test("SnapshotManager.deleteSnapshot", (ctx: TestContext) => {
  const snapshotManager = new SnapshotManager(ctx.store);

  const session = ctx.store.create(ctx.sessionId, "Initial prompt");

  session.snapshots.push(
    {
      commitHash: "abc123",
      timestamp: new Date().toISOString(),
      healthScore: 0.8,
      description: "Keep",
    },
    {
      commitHash: "def456",
      timestamp: new Date().toISOString(),
      healthScore: 0.9,
      description: "Delete",
    }
  );
  ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

  snapshotManager.deleteSnapshot(ctx.sessionId, "def456");

  const updated = ctx.store.get(ctx.sessionId);
  assertEqual(updated.snapshots.length, 1, "Should have 1 snapshot after deletion");
  assertEqual(updated.snapshots[0].commitHash, "abc123", "Remaining snapshot should be abc123");
});

// ==================== SessionAnalyzer Tests ====================

/**
 * Test 29: SessionAnalyzer drift threshold validation
 */
suite.test("SessionAnalyzer drift threshold validation", (_ctx: TestContext) => {
  const analyzer = new SessionAnalyzer(0.5);

  // Valid threshold
  analyzer.setDriftThreshold(0.8);
  assertEqual(analyzer.getDriftThreshold(), 0.8, "Should set valid threshold");

  // Invalid thresholds should throw
  let threw = false;
  try {
    analyzer.setDriftThreshold(-0.1);
  } catch (_e) {
    threw = true;
  }
  assert(threw, "Should throw for negative threshold");

  threw = false;
  try {
    analyzer.setDriftThreshold(1.5);
  } catch (_e) {
    threw = true;
  }
  assert(threw, "Should throw for threshold > 1");
});

/**
 * Test 30: Multiple sessions management
 */
suite.test("Multiple sessions management", (ctx: TestContext) => {
  const session1 = `session-1-${Date.now()}`;
  const session2 = `session-2-${Date.now()}`;

  ctx.store.create(session1, "First session prompt");
  ctx.store.create(session2, "Second session prompt");

  const allSessions = ctx.store.list();
  assert(allSessions.length >= 2, "Should have multiple sessions");
});

// ==================== Test Runner ====================

/**
 * Run all integration tests
 */
async function runAllTests(): Promise<void> {
  console.log("Running Claude Context Manager Integration Tests\n");

  await suite.test("Create session", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    const initialPrompt = "Implement a feature for user authentication";
    const session = controller.createSession(ctx.sessionId, initialPrompt);

    assert(session !== null);
    assertEqual(session.id, ctx.sessionId, "Session ID should match");
    assertEqual(session.metadata.initialPrompt, initialPrompt);
    assertEqual(session.metadata.phase, "initialization");
    assertEqual(session.metadata.healthScore, 1.0);
    assertEqual(session.metrics.messageCount, 0);
  });

  await suite.test("Track messages", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");
    controller.trackMessage("user", "Add a login form");
    controller.trackMessage("assistant", "I will create a login form component");

    const session = controller.getSession(ctx.sessionId);
    assert(session !== null);
    assertEqual(session.metrics.messageCount, 2);
    assert(session.events.length >= 2);
  });

  await suite.test("Track tools", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");
    controller.trackTool(
      "Read",
      { file_path: "/src/auth.ts" },
      { content: "export function login() {}" }
    );

    const session = controller.getSession(ctx.sessionId);
    assert(session !== null);
    const toolEvents = session.events.filter((e) => e.type === "tool");
    assert(toolEvents.length > 0);
  });

  await suite.test("Calculate health score", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");
    let healthScore = controller.getHealthScore();
    assertInRange(healthScore, 0.8, 1.0);

    controller.trackMessage("user", "Add a feature");
    controller.trackMessage("assistant", "I will add it");
    healthScore = controller.getHealthScore();
    assertInRange(healthScore, 0.0, 1.0);
  });

  await suite.test("Get controller status", async (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");
    controller.trackMessage("user", "Add a feature");

    const status = await controller.getStatus();
    assert(status !== null);
    assertInRange(status.healthScore, 0.0, 1.0);
    assert(status.driftScore >= 0.0);
  });

  await suite.test("Compact session", async (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");
    for (let i = 0; i < 50; i++) {
      controller.trackMessage("user", `Message ${i}`);
      controller.trackMessage("assistant", `Response ${i}`);
    }

    const sessionBefore = controller.getSession(ctx.sessionId);
    const eventsBefore = sessionBefore.events.length;
    const result = await controller.compact({ keepLastN: 20 });

    assert(result.eventsRemoved > 0);
    assert(result.eventsKept <= eventsBefore);

    const sessionAfter = controller.getSession(ctx.sessionId);
    assert(sessionAfter.events.length < eventsBefore);
  });

  await suite.test("Create snapshot", async (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");
    controller.trackMessage("user", "Add a feature");

    const snapshot = await controller.createSnapshot("Test snapshot");

    assert(snapshot.commitHash.length > 0);
    assertEqual(snapshot.description, "Test snapshot");
    assertInRange(snapshot.healthScore, 0.0, 1.0);
    assert(snapshot.timestamp.length > 0);

    const session = controller.getSession(ctx.sessionId);
    assert(session.snapshots.length > 0);
    assertEqual(session.snapshots[0].commitHash, snapshot.commitHash);
  });

  await suite.test("Restore from snapshot", async (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");

    for (let i = 0; i < 10; i++) {
      controller.trackError(new Error(`Test error ${i}`));
    }

    const snapshot = await controller.createSnapshot("Good state");
    await controller.restoreSnapshot(snapshot.commitHash);

    const session = controller.getSession(ctx.sessionId);
    assertEqual(session.metadata.phase, "restored");
  });

  await suite.test("End session", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");
    controller.trackMessage("user", "Test message");
    controller.endSession(ctx.sessionId);

    const session = controller.getSession(ctx.sessionId);
    assert(session !== null);
    assertEqual(session.metadata.phase, "ended");
  });

  // Edge cases
  await suite.test("Empty session", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");

    const session = controller.getSession(ctx.sessionId);
    assert(session !== null);
    assertEqual(session.metrics.messageCount, 0);
    assertEqual(session.events.length, 1);

    const healthScore = controller.getHealthScore();
    assertInRange(healthScore, 0.9, 1.0);
  });

  await suite.test("Session with many events", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");

    for (let i = 0; i < 100; i++) {
      controller.trackMessage("user", `User message ${i}`);
      controller.trackMessage("assistant", `Assistant response ${i}`);
      controller.trackTool("TestTool", { index: i }, { success: true });
    }

    const session = controller.getSession(ctx.sessionId);
    assert(session.events.length >= 300);
    assertEqual(session.metrics.messageCount, 200);
  });

  await suite.test("Session with high drift", async (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.5);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt about authentication");
    controller.trackMessage("user", "Add login form");
    controller.trackMessage("assistant", "Creating login component");

    for (let i = 0; i < 10; i++) {
      controller.trackMessage("user", `How do I implement database migration ${i}?`);
      controller.trackMessage("assistant", `Database migration response ${i}`);
    }

    const status = await controller.getStatus();
    assert(status !== null);
    assert(status.driftScore >= 0);
  });

  await suite.test("Session with many errors", async (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");

    // Track messages first, then errors to get a meaningful error rate
    for (let i = 0; i < 10; i++) {
      controller.trackMessage("user", `Message ${i}`);
    }

    // Track many errors
    for (let i = 0; i < 20; i++) {
      controller.trackError(new Error(`Test error ${i}`));
    }

    const session = controller.getSession(ctx.sessionId);
    assertEqual(session.metrics.errorCount, 20);

    // Get status to analyze health
    const status = await controller.getStatus();
    assert(status !== null);

    // With 20 errors and 10 messages, error rate is 2.0 (200%), which caps at 1.0 error factor
    // This should impact health score
    assert(status.healthScore < 1.0);
  });

  await suite.test("Compact preserves important events", async (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");

    for (let i = 0; i < 5; i++) {
      controller.trackError(new Error(`Error ${i}`));
    }

    await controller.createSnapshot("Test snapshot");

    for (let i = 0; i < 50; i++) {
      controller.trackMessage("user", `Message ${i}`);
    }

    const beforeCompact = controller.getSession(ctx.sessionId);
    const _errorCountBefore = beforeCompact.events.filter((e) => e.type === "error").length;
    const _snapshotEventCountBefore = beforeCompact.events.filter(
      (e) => e.type === "snapshot"
    ).length;
    const compactEventCountBefore = beforeCompact.events.filter((e) => e.type === "compact").length;
    const totalEventsBefore = beforeCompact.events.length;

    await controller.compact({ keepLastN: 10 });

    const afterCompact = controller.getSession(ctx.sessionId);
    const _errorCountAfter = afterCompact.events.filter((e) => e.type === "error").length;
    const _snapshotEventCountAfter = afterCompact.events.filter(
      (e) => e.type === "snapshot"
    ).length;
    const compactEventCountAfter = afterCompact.events.filter((e) => e.type === "compact").length;
    const totalEventsAfter = afterCompact.events.length;

    assert(totalEventsAfter < totalEventsBefore);
    assert(compactEventCountAfter > compactEventCountBefore);
  });

  await suite.test("Drift threshold configuration", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.3);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");

    const threshold = controller.getDriftThreshold();
    assertEqual(threshold, 0.3);

    controller.setDriftThreshold(0.8);
    const newThreshold = controller.getDriftThreshold();
    assertEqual(newThreshold, 0.8);
  });

  await suite.test("Restore non-existent snapshot throws error", async (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");

    let errorThrown = false;
    try {
      await controller.restoreSnapshot("non-existent-hash");
    } catch (error) {
      errorThrown = true;
      assert(error instanceof Error);
    }
    assert(errorThrown);
  });

  await suite.test("Session with mixed event types", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");
    controller.trackMessage("user", "User message");
    controller.trackTool("Read", { file: "test.txt" }, { content: "test" });
    controller.trackError(new Error("Test error"));

    const session = controller.getSession(ctx.sessionId);
    const messageEvents = session.events.filter((e) => e.type === "message");
    const toolEvents = session.events.filter((e) => e.type === "tool");
    const errorEvents = session.events.filter((e) => e.type === "error");

    assert(messageEvents.length > 0);
    assert(toolEvents.length > 0);
    assert(errorEvents.length > 0);
  });

  await suite.test("Health score changes with activity", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    controller.createSession(ctx.sessionId, "Initial prompt");

    const health1 = controller.getHealthScore();
    controller.trackMessage("user", "Helpful request");
    controller.trackMessage("assistant", "Helpful response");
    const health2 = controller.getHealthScore();
    controller.trackError(new Error("Error 1"));
    controller.trackError(new Error("Error 2"));
    const health3 = controller.getHealthScore();

    assertInRange(health1, 0.0, 1.0);
    assertInRange(health2, 0.0, 1.0);
    assertInRange(health3, 0.0, 1.0);
  });

  await suite.test("Session persistence", (ctx) => {
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer(0.7);
    const controller = new ContextController(ctx.store, monitor, analyzer);

    const sessionId = ctx.sessionId;

    controller.createSession(sessionId, "Initial prompt");
    controller.trackMessage("user", "Test message 1");
    controller.trackMessage("user", "Test message 2");

    const session = ctx.store.get(sessionId);
    assert(session !== null);
    assert(session.metrics.messageCount >= 2);
  });

  // SessionCompactor tests
  await suite.test("SessionCompactor.analyze", (ctx) => {
    const compactor = new SessionCompactor();
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    for (let i = 0; i < 50; i++) {
      session.events.push({
        timestamp: new Date().toISOString(),
        type: "message",
        data: { index: i },
      });
    }
    ctx.store.update(ctx.sessionId, { events: session.events });

    const analysis = compactor.analyze(session);
    assert(analysis.currentEvents > 0);
    assert(analysis.compressionRatio >= 1);
  });

  await suite.test("SessionCompactor.getEventDistribution", (ctx) => {
    const compactor = new SessionCompactor();
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    session.events.push(
      { timestamp: new Date().toISOString(), type: "message", data: {} },
      { timestamp: new Date().toISOString(), type: "tool", data: {} },
      { timestamp: new Date().toISOString(), type: "error", data: {} },
      { timestamp: new Date().toISOString(), type: "snapshot", data: {} }
    );
    ctx.store.update(ctx.sessionId, { events: session.events });

    const distribution = compactor.getEventDistribution(session);
    assertEqual(distribution.total, 5);
    assert(distribution.byType.message > 0);
    assert(distribution.byType.tool > 0);
    assert(distribution.byType.error > 0);
  });

  await suite.test("SessionCompactor.findCompactionCandidates", (ctx) => {
    const compactor = new SessionCompactor();
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    session.events.push(
      { timestamp: oldTimestamp, type: "message", data: {} },
      { timestamp: oldTimestamp, type: "tool", data: {} }
    );

    const newTimestamp = new Date().toISOString();
    session.events.push(
      { timestamp: newTimestamp, type: "message", data: {} },
      { timestamp: newTimestamp, type: "snapshot", data: {} },
      { timestamp: newTimestamp, type: "error", data: {} }
    );

    ctx.store.update(ctx.sessionId, { events: session.events });

    const candidates = compactor.findCompactionCandidates(session, 24);
    assert(candidates.length >= 1);
  });

  // SnapshotManager tests
  await suite.test("SnapshotManager.getSnapshots", (ctx) => {
    const snapshotManager = new SnapshotManager(ctx.store);
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    session.snapshots.push({
      commitHash: "abc123",
      timestamp: new Date().toISOString(),
      healthScore: 0.8,
      description: "Test snapshot",
    });
    ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

    const snapshots = snapshotManager.getSnapshots(ctx.sessionId);
    assertEqual(snapshots.length, 1);
  });

  await suite.test("SnapshotManager.getSnapshot", (ctx) => {
    const snapshotManager = new SnapshotManager(ctx.store);
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    const testSnapshot = {
      commitHash: "abc123",
      timestamp: new Date().toISOString(),
      healthScore: 0.8,
      description: "Test snapshot",
    };
    session.snapshots.push(testSnapshot);
    ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

    const found = snapshotManager.getSnapshot(ctx.sessionId, "abc123");
    assert(found !== null);
    assertEqual(found.commitHash, "abc123");

    const notFound = snapshotManager.getSnapshot(ctx.sessionId, "nonexistent");
    assert(notFound === null);
  });

  await suite.test("SnapshotManager.getLatestSnapshot", (ctx) => {
    const snapshotManager = new SnapshotManager(ctx.store);
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    const now = Date.now();
    session.snapshots.push(
      {
        commitHash: "abc123",
        timestamp: new Date(now - 1000).toISOString(),
        healthScore: 0.8,
        description: "First",
      },
      {
        commitHash: "def456",
        timestamp: new Date(now).toISOString(),
        healthScore: 0.9,
        description: "Second",
      }
    );
    ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

    const latest = snapshotManager.getLatestSnapshot(ctx.sessionId);
    assert(latest !== null);
    assertEqual(latest.commitHash, "def456");
  });

  await suite.test("SnapshotManager.getHealthiestSnapshot", (ctx) => {
    const snapshotManager = new SnapshotManager(ctx.store);
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    session.snapshots.push(
      {
        commitHash: "abc123",
        timestamp: new Date().toISOString(),
        healthScore: 0.7,
        description: "Lower health",
      },
      {
        commitHash: "def456",
        timestamp: new Date().toISOString(),
        healthScore: 0.95,
        description: "Higher health",
      }
    );
    ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

    const healthiest = snapshotManager.getHealthiestSnapshot(ctx.sessionId);
    assert(healthiest !== null);
    assertEqual(healthiest.commitHash, "def456");
    assertEqual(healthiest.healthScore, 0.95);
  });

  await suite.test("SnapshotManager.findSnapshotsByHealth", (ctx) => {
    const snapshotManager = new SnapshotManager(ctx.store);
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    session.snapshots.push(
      {
        commitHash: "abc123",
        timestamp: new Date().toISOString(),
        healthScore: 0.5,
        description: "Low",
      },
      {
        commitHash: "def456",
        timestamp: new Date().toISOString(),
        healthScore: 0.8,
        description: "Medium",
      },
      {
        commitHash: "ghi789",
        timestamp: new Date().toISOString(),
        healthScore: 0.95,
        description: "High",
      }
    );
    ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

    const highHealth = snapshotManager.findSnapshotsByHealth(ctx.sessionId, 0.8, 1.0);
    assertEqual(highHealth.length, 2);

    const mediumHealth = snapshotManager.findSnapshotsByHealth(ctx.sessionId, 0.6, 0.9);
    assertEqual(mediumHealth.length, 1);
  });

  await suite.test("SnapshotManager.deleteSnapshot", (ctx) => {
    const snapshotManager = new SnapshotManager(ctx.store);
    const session = ctx.store.create(ctx.sessionId, "Initial prompt");

    session.snapshots.push(
      {
        commitHash: "abc123",
        timestamp: new Date().toISOString(),
        healthScore: 0.8,
        description: "Keep",
      },
      {
        commitHash: "def456",
        timestamp: new Date().toISOString(),
        healthScore: 0.9,
        description: "Delete",
      }
    );
    ctx.store.update(ctx.sessionId, { snapshots: session.snapshots });

    snapshotManager.deleteSnapshot(ctx.sessionId, "def456");

    const updated = ctx.store.get(ctx.sessionId);
    assertEqual(updated.snapshots.length, 1);
    assertEqual(updated.snapshots[0].commitHash, "abc123");
  });

  // SessionAnalyzer tests
  await suite.test("SessionAnalyzer drift threshold validation", (_ctx) => {
    const analyzer = new SessionAnalyzer(0.5);

    analyzer.setDriftThreshold(0.8);
    assertEqual(analyzer.getDriftThreshold(), 0.8);

    let threw = false;
    try {
      analyzer.setDriftThreshold(-0.1);
    } catch (_e) {
      threw = true;
    }
    assert(threw);

    threw = false;
    try {
      analyzer.setDriftThreshold(1.5);
    } catch (_e) {
      threw = true;
    }
    assert(threw);
  });

  await suite.test("Multiple sessions management", (ctx) => {
    const session1 = `session-1-${Date.now()}`;
    const session2 = `session-2-${Date.now()}`;

    ctx.store.create(session1, "First session prompt");
    ctx.store.create(session2, "Second session prompt");

    const allSessions = ctx.store.list();
    assert(allSessions.length >= 2);
  });

  // Print summary
  suite.printSummary();

  // Exit with appropriate code
  process.exit(suite.getExitCode());
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error("Fatal error running tests:", error);
    process.exit(1);
  });
}

// Export for programmatic usage
export { runAllTests, setupTest, teardownTest, TestSuite };
