/**
 * Agent Interface
 *
 * Base interface that all agent adapters must implement.
 * Defines the contract for interacting with different AI CLI agents.
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

/**
 * Information about an MCP server
 */
export interface MCPInfo extends MCPConfig {
  status?: "active" | "inactive" | "error";
}

/**
 * Information about a Skill
 */
export interface SkillInfo extends SkillConfig {
  status?: "active" | "inactive" | "error";
}

/**
 * Base Agent Interface
 *
 * All agent adapters (Claude, Codex, Copilot, Cursor, Kimi) must implement this interface.
 */
export interface AgentInterface {
  /**
   * Get agent ID
   */
  readonly id: AgentId;

  /**
   * Get agent display name
   */
  readonly name: string;

  /**
   * Get agent icon path
   */
  readonly icon: string;

  /**
   * Get agent description
   */
  readonly description: string;

  /**
   * Initialize the agent
   * Called when the agent is first loaded
   */
  initialize(): Promise<void>;

  /**
   * Check if the agent is available/enabled
   */
  isAvailable(): Promise<boolean>;

  // ==================== Terminal Operations ====================

  /**
   * Start a terminal session for this agent
   */
  startTerminal(options: TerminalOptions): Promise<TerminalSession>;

  /**
   * List active terminal sessions for this agent
   */
  listTerminals(): Promise<TerminalSession[]>;

  /**
   * Get a specific terminal session
   */
  getTerminal(terminalId: string): Promise<TerminalSession | null>;

  // ==================== Context Management ====================

  /**
   * Create a new context for this agent
   */
  createContext(options: ContextOptions): Promise<Context>;

  /**
   * Get a context by ID
   */
  getContext(contextId: string): Promise<Context | null>;

  /**
   * Update a context
   */
  updateContext(contextId: string, updates: ContextUpdate): Promise<void>;

  /**
   * Delete a context
   */
  deleteContext(contextId: string): Promise<void>;

  /**
   * List all contexts for this agent
   */
  listContexts(): Promise<Context[]>;

  // ==================== Config Management ====================

  /**
   * Get the agent's current configuration
   */
  getConfig(): Promise<AgentConfig>;

  /**
   * Update the agent's configuration
   */
  updateConfig(config: Partial<AgentConfig>): Promise<void>;

  /**
   * Reset the agent's configuration to defaults
   */
  resetConfig(): Promise<void>;

  // ==================== MCP/Skills Operations ====================

  /**
   * List all configured MCP servers for this agent
   */
  listMCPs(): Promise<MCPInfo[]>;

  /**
   * Get a specific MCP server configuration
   */
  getMCP(mcpId: string): Promise<MCPInfo | null>;

  /**
   * Add an MCP server to this agent
   */
  addMCP(mcp: MCPConfig): Promise<void>;

  /**
   * Remove an MCP server from this agent
   */
  removeMCP(mcpId: string): Promise<void>;

  /**
   * Update an MCP server configuration
   */
  updateMCP(mcpId: string, updates: Partial<MCPConfig>): Promise<void>;

  /**
   * List all configured Skills for this agent
   */
  listSkills(): Promise<SkillInfo[]>;

  /**
   * Get a specific Skill configuration
   */
  getSkill(skillId: string): Promise<SkillInfo | null>;

  /**
   * Add a Skill to this agent
   */
  addSkill(skill: SkillConfig): Promise<void>;

  /**
   * Remove a Skill from this agent
   */
  removeSkill(skillId: string): Promise<void>;

  /**
   * Update a Skill configuration
   */
  updateSkill(skillId: string, updates: Partial<SkillConfig>): Promise<void>;

  // ==================== Task Execution ====================

  /**
   * Execute a task using this agent
   */
  executeTask(task: AgentTask): Promise<TaskResult>;

  /**
   * Send a message to this agent
   */
  sendMessage(content: string): Promise<TaskResult>;

  // ==================== Lifecycle ====================

  /**
   * Cleanup resources when the agent is unloaded
   */
  dispose(): Promise<void>;
}
