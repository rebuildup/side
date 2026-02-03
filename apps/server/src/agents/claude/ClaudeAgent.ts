/**
 * Claude Code Agent Adapter
 *
 * Adapter for Claude Code CLI agent.
 * Wraps the existing Context Manager functionality.
 */

import path from "node:path";
import { ContextController } from "../../../.claude/context-manager/core/context-controller.js";
import { SessionStore } from "../../../.claude/context-manager/storage/session-store.js";
import { SessionMonitor } from "../../../.claude/context-manager/core/session-monitor.js";
import { SessionAnalyzer } from "../../../.claude/context-manager/core/session-analyzer.js";
import type { SnapshotRef } from "../../../.claude/context-manager/types.js";
import type {
  AgentConfig,
  AgentTask,
  Context,
  ContextOptions,
  ContextUpdate,
  MCPConfig,
  MCPInfo,
  SkillConfig,
  SkillInfo,
  TerminalOptions,
  TerminalSession,
  TaskResult,
} from "../types.js";
import { ConfigReader } from "../config/ConfigReader.js";
import { BaseAgent, type BaseAgentConfig } from "../base/BaseAgent.js";

/**
 * Claude agent configuration
 */
interface ClaudeAgentConfig extends BaseAgentConfig {
  contextManagerPath?: string;
}

/**
 * Claude Code Agent Adapter
 *
 * Implements AgentInterface for Claude Code by wrapping the existing
 * Context Manager and providing terminal launch functionality.
 */
export class ClaudeAgent extends BaseAgent {
  private contextManagerPath: string;
  private contextController: ContextController | null = null;
  private sessionStore: SessionStore | null = null;

  constructor(config: ClaudeAgentConfig) {
    super({
      id: "claude",
      name: "Claude Code",
      icon: "/icons/agents/claude.svg",
      description: "Anthropic's Claude Code CLI - Advanced AI coding assistant",
      configPath: config.configPath || ConfigReader.getAgentConfigPath("claude"),
    });
    this.contextManagerPath =
      config.contextManagerPath ||
      path.join(process.cwd(), ".claude", "context-manager");
  }

  // ==================== Lifecycle ====================

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await super.initialize();

    // Initialize Context Controller
    const { SessionStore: Store, SessionMonitor, SessionAnalyzer } =
      await import("../../.claude/context-manager/index.js");

    this.sessionStore = new Store();
    const monitor = new SessionMonitor();
    const analyzer = new SessionAnalyzer();

    this.contextController = new ContextController(
      this.sessionStore,
      monitor,
      analyzer
    );
  }

  async dispose(): Promise<void> {
    this.contextController = null;
    this.sessionStore = null;
    await super.dispose();
  }

  // ==================== Terminal Operations ====================

  async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Create a Claude Code terminal session
    // The actual terminal is managed by the terminal router
    // Here we just create the reference

    const terminalId = this.generateId();
    const command = options.command || "claude";

    const session: TerminalSession = {
      id: terminalId,
      pid: 0, // Will be set by terminal router
      title: options.title || `Claude Terminal`,
      createdAt: new Date().toISOString(),
    };

    this.terminals.set(terminalId, session);
    return session;
  }

  // ==================== Context Management (using Context Controller) ====================

  override async createContext(options: ContextOptions): Promise<Context> {
    await this.ensureInitialized();

    if (!this.contextController) {
      throw new Error("Context controller not initialized");
    }

    // Use Context Controller to create session
    const sessionId = this.generateId();
    const initialPrompt = options.initialPrompt || "";

    const claudeSession = this.contextController.createSession(
      sessionId,
      initialPrompt
    );

    // Map Claude session to our Context type
    const context: Context = {
      id: claudeSession.id,
      agentId: this.id,
      createdAt: claudeSession.createdAt,
      updatedAt: claudeSession.updatedAt,
      metadata: claudeSession.metadata as Record<string, unknown>,
      messageCount: claudeSession.events.length,
    };

    this.contexts.set(context.id, context);
    return context;
  }

  override async getContext(contextId: string): Promise<Context | null> {
    await this.ensureInitialized();

    if (!this.contextController) {
      throw new Error("Context controller not initialized");
    }

    const claudeSession = this.contextController.getSession(contextId);
    if (!claudeSession) {
      return null;
    }

    // Map Claude session to our Context type
    const context: Context = {
      id: claudeSession.id,
      agentId: this.id,
      createdAt: claudeSession.createdAt,
      updatedAt: claudeSession.updatedAt,
      metadata: claudeSession.metadata as Record<string, unknown>,
      messageCount: claudeSession.events.length,
    };

    return context;
  }

  override async updateContext(
    contextId: string,
    updates: ContextUpdate
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.contextController) {
      throw new Error("Context controller not initialized");
    }

    // Update via Context Controller
    this.contextController.getSession(contextId); // Will throw if not found

    // Update local cache
    const existing = this.contexts.get(contextId);
    if (existing) {
      const updated: Context = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.contexts.set(contextId, updated);
    }
  }

  // ==================== Config Management ====================

  protected override async loadConfig(): Promise<void> {
    // Load Claude settings from ~/.claude/settings.json
    const settingsPath = ConfigReader.getAgentConfigFilePath("claude", "settings");
    const settings = await ConfigReader.readJSON(settingsPath);

    this.config = {
      ...this.config,
      ...settings,
    };
  }

  protected override async saveConfig(): Promise<void> {
    // Save Claude settings to ~/.claude/settings.json
    const settingsPath = ConfigReader.getAgentConfigFilePath("claude", "settings");
    await ConfigReader.writeJSON(settingsPath, this.config);
  }

  // ==================== MCP/Skills Operations ====================

  protected override async loadMCPs(): Promise<void> {
    // Load MCP servers from ~/.claude/mcp_servers.json
    const mcpPath = ConfigReader.getAgentConfigFilePath("claude", "mcp");
    const mcpConfig = await ConfigReader.readJSON(mcpPath);

    if (mcpConfig.mcpServers) {
      const servers = mcpConfig.mcpServers as Array<{
        name: string;
        command: string;
        args?: string[];
        env?: Record<string, string>;
      }>;

      for (const server of servers) {
        const mcpInfo: MCPInfo = {
          id: server.name,
          name: server.name,
          command: server.command,
          args: server.args,
          env: server.env,
          status: "active",
        };
        this.mcpServers.set(server.name, mcpInfo);
      }
    }
  }

  protected override async saveMCPs(): Promise<void> {
    // Save MCP servers to ~/.claude/mcp_servers.json
    const mcpPath = ConfigReader.getAgentConfigFilePath("claude", "mcp");
    const servers = Array.from(this.mcpServers.values()).map((mcp) => ({
      name: mcp.name,
      command: mcp.command,
      args: mcp.args,
      env: mcp.env,
    }));

    await ConfigReader.writeJSON(mcpPath, { mcpServers: servers });
  }

  protected override async loadSkills(): Promise<void> {
    // Load Skills from ~/.claude/skills/ directory
    const skillsDir = path.join(
      ConfigReader.getAgentConfigPath("claude"),
      "skills"
    );

    try {
      const fs = await import("node:fs/promises");
      const files = await fs.readdir(skillsDir);

      for (const file of files) {
        if (file.endsWith(".json") || file.endsWith(".md")) {
          const skillId = file.replace(/\.(json|md)$/, "");
          const skillInfo: SkillInfo = {
            id: skillId,
            name: skillId,
            description: `Claude Code skill: ${skillId}`,
            status: "active",
          };
          this.skills.set(skillId, skillInfo);
        }
      }
    } catch {
      // Skills directory doesn't exist or is not accessible
    }
  }

  protected override async saveSkills(): Promise<void> {
    // Skills are managed as individual files, not as a config
    // This is a no-op for Claude
  }

  // ==================== Task Execution ====================

  async executeTask(task: AgentTask): Promise<TaskResult> {
    await this.ensureInitialized();

    // Track the task in context controller if available
    if (this.contextController) {
      this.contextController.trackMessage("user", task.content);
    }

    // For Claude, tasks are typically executed via the CLI
    // Return success result
    return {
      taskId: task.id,
      success: true,
      output: `Task sent to Claude: ${task.content}`,
    };
  }

  // ==================== Context Manager Specific Methods ====================

  /**
   * Compact the current context using Context Controller
   */
  async compact(options?: {
    keepLastN?: number;
    preserveErrors?: boolean;
    preserveSnapshots?: boolean;
  }): Promise<{
    originalEvents: number;
    remainingEvents: number;
    compactedEvents: number;
    summary: string;
    spaceSaved: number;
  }> {
    await this.ensureInitialized();

    if (!this.contextController) {
      throw new Error("Context controller not initialized");
    }

    return this.contextController.compact(options);
  }

  /**
   * Create a snapshot of the current context
   */
  async createSnapshot(description?: string): Promise<SnapshotRef> {
    await this.ensureInitialized();

    if (!this.contextController) {
      throw new Error("Context controller not initialized");
    }

    return this.contextController.createSnapshot(description);
  }

  /**
   * Restore a context from a snapshot
   */
  async restoreSnapshot(commitHash: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.contextController) {
      throw new Error("Context controller not initialized");
    }

    return this.contextController.restoreSnapshot(commitHash);
  }

  /**
   * Get context status (health score, drift, etc.)
   */
  async getStatus(): Promise<{
    healthScore: number;
    driftScore: number;
    currentPhase: string;
    messageCount: number;
    tokenCount: number;
    recommendations?: string[];
  } | null> {
    await this.ensureInitialized();

    if (!this.contextController) {
      throw new Error("Context controller not initialized");
    }

    return this.contextController.getStatus();
  }

  /**
   * Get health score for current context
   */
  getHealthScore(): number {
    if (!this.contextController) {
      return 100;
    }
    return this.contextController.getHealthScore();
  }

  /**
   * Set drift threshold
   */
  setDriftThreshold(threshold: number): void {
    if (!this.contextController) {
      return;
    }
    this.contextController.setDriftThreshold(threshold);
  }

  /**
   * Get drift threshold
   */
  getDriftThreshold(): number {
    if (!this.contextController) {
      return 0.5;
    }
    return this.contextController.getDriftThreshold();
  }

  /**
   * Track a message in the current context
   */
  trackMessage(role: "user" | "assistant", content: string): void {
    if (!this.contextController) {
      return;
    }
    this.contextController.trackMessage(role, content);
  }

  /**
   * Track a tool execution
   */
  trackTool(name: string, args: unknown, result: unknown): void {
    if (!this.contextController) {
      return;
    }
    this.contextController.trackTool(name, args, result);
  }

  /**
   * Track an error
   */
  trackError(error: Error | string): void {
    if (!this.contextController) {
      return;
    }
    this.contextController.trackError(error);
  }

  /**
   * End the current session
   */
  endSession(sessionId: string): void {
    if (!this.contextController) {
      return;
    }
    this.contextController.endSession(sessionId);
  }

  /**
   * Get the current session
   */
  getCurrentSession():
    | {
        id: string;
        initialPrompt: string;
        createdAt: string;
        updatedAt: string;
        metadata: Record<string, unknown>;
        events: unknown[];
        snapshots: unknown[];
      }
    | null {
    if (!this.contextController) {
      return null;
    }
    return this.contextController.getCurrentSession();
  }
}
