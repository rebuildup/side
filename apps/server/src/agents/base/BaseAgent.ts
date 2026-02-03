/**
 * Base Agent
 *
 * Abstract base class for agent adapters.
 * Provides common functionality that all agent adapters can use.
 */

import type {
  AgentId,
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
import type { AgentInterface } from "./AgentInterface.js";

/**
 * Base agent configuration
 */
export interface BaseAgentConfig {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
  configPath: string;
}

/**
 * Abstract base class for agent adapters
 *
 * Implements common functionality and defines abstract methods
 * that specific agent adapters must implement.
 */
export abstract class BaseAgent implements AgentInterface {
  readonly id: AgentId;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  protected configPath: string;
  protected config: AgentConfig = {};
  protected initialized: boolean = false;
  protected terminals: Map<string, TerminalSession> = new Map();
  protected contexts: Map<string, Context> = new Map();
  protected mcpServers: Map<string, MCPInfo> = new Map();
  protected skills: Map<string, SkillInfo> = new Map();

  constructor(config: BaseAgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.icon = config.icon;
    this.description = config.description;
    this.configPath = config.configPath;
  }

  // ==================== Lifecycle ====================

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadConfig();
    await this.loadMCPs();
    await this.loadSkills();
    this.initialized = true;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if agent's config directory exists
      const fs = await import("node:fs/promises");
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.terminals.clear();
    this.contexts.clear();
    this.mcpServers.clear();
    this.skills.clear();
    this.initialized = false;
  }

  // ==================== Terminal Operations ====================

  abstract startTerminal(options: TerminalOptions): Promise<TerminalSession>;

  async listTerminals(): Promise<TerminalSession[]> {
    return Array.from(this.terminals.values());
  }

  async getTerminal(terminalId: string): Promise<TerminalSession | null> {
    return this.terminals.get(terminalId) || null;
  }

  // ==================== Context Management ====================

  async createContext(options: ContextOptions): Promise<Context> {
    const context: Context = {
      id: this.generateId(),
      agentId: this.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: options.metadata || {},
      messageCount: 0,
    };

    this.contexts.set(context.id, context);
    return context;
  }

  async getContext(contextId: string): Promise<Context | null> {
    return this.contexts.get(contextId) || null;
  }

  async updateContext(contextId: string, updates: ContextUpdate): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const updated: Context = {
      ...context,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.contexts.set(contextId, updated);
  }

  async deleteContext(contextId: string): Promise<void> {
    this.contexts.delete(contextId);
  }

  async listContexts(): Promise<Context[]> {
    return Array.from(this.contexts.values());
  }

  // ==================== Config Management ====================

  /**
   * Load agent configuration from file
   * Must be implemented by specific agent adapters
   */
  protected abstract loadConfig(): Promise<void>;

  /**
   * Save agent configuration to file
   * Must be implemented by specific agent adapters
   */
  protected abstract saveConfig(): Promise<void>;

  async getConfig(): Promise<AgentConfig> {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<AgentConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...updates,
    };
    await this.saveConfig();
  }

  async resetConfig(): Promise<void> {
    this.config = {};
    await this.saveConfig();
  }

  // ==================== MCP/Skills Operations ====================

  /**
   * Load MCP servers from agent config
   * Must be implemented by specific agent adapters
   */
  protected abstract loadMCPs(): Promise<void>;

  /**
   * Save MCP servers to agent config
   * Must be implemented by specific agent adapters
   */
  protected abstract saveMCPs(): Promise<void>;

  /**
   * Load Skills from agent config
   * Must be implemented by specific agent adapters
   */
  protected abstract loadSkills(): Promise<void>;

  /**
   * Save Skills to agent config
   * Must be implemented by specific agent adapters
   */
  protected abstract saveSkills(): Promise<void>;

  async listMCPs(): Promise<MCPInfo[]> {
    return Array.from(this.mcpServers.values());
  }

  async getMCP(mcpId: string): Promise<MCPInfo | null> {
    return this.mcpServers.get(mcpId) || null;
  }

  async addMCP(mcp: MCPConfig): Promise<void> {
    const mcpInfo: MCPInfo = {
      ...mcp,
      status: "active",
    };
    this.mcpServers.set(mcp.id, mcpInfo);
    await this.saveMCPs();
  }

  async removeMCP(mcpId: string): Promise<void> {
    this.mcpServers.delete(mcpId);
    await this.saveMCPs();
  }

  async updateMCP(mcpId: string, updates: Partial<MCPConfig>): Promise<void> {
    const existing = this.mcpServers.get(mcpId);
    if (!existing) {
      throw new Error(`MCP not found: ${mcpId}`);
    }

    const updated: MCPInfo = {
      ...existing,
      ...updates,
    };
    this.mcpServers.set(mcpId, updated);
    await this.saveMCPs();
  }

  async listSkills(): Promise<SkillInfo[]> {
    return Array.from(this.skills.values());
  }

  async getSkill(skillId: string): Promise<SkillInfo | null> {
    return this.skills.get(skillId) || null;
  }

  async addSkill(skill: SkillConfig): Promise<void> {
    const skillInfo: SkillInfo = {
      ...skill,
      status: "active",
    };
    this.skills.set(skill.id, skillInfo);
    await this.saveSkills();
  }

  async removeSkill(skillId: string): Promise<void> {
    this.skills.delete(skillId);
    await this.saveSkills();
  }

  async updateSkill(skillId: string, updates: Partial<SkillConfig>): Promise<void> {
    const existing = this.skills.get(skillId);
    if (!existing) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const updated: SkillInfo = {
      ...existing,
      ...updates,
    };
    this.skills.set(skillId, updated);
    await this.saveSkills();
  }

  // ==================== Task Execution ====================

  abstract executeTask(task: AgentTask): Promise<TaskResult>;

  async sendMessage(content: string): Promise<TaskResult> {
    const task: AgentTask = {
      id: this.generateId(),
      type: "prompt",
      content,
    };
    return this.executeTask(task);
  }

  // ==================== Utilities ====================

  protected generateId(): string {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
