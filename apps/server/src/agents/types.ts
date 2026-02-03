/**
 * Agent Type Definitions
 *
 * Shared types for agent system across S-IDE.
 */

/**
 * Supported agent IDs
 */
export type AgentId = "claude" | "codex" | "copilot" | "cursor" | "kimi";

/**
 * Agent metadata
 */
export interface AgentInfo {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
  version?: string;
  enabled: boolean;
}

/**
 * Terminal launch options
 */
export interface TerminalOptions {
  cwd?: string;
  env?: Record<string, string>;
  command?: string;
  title?: string;
  rows?: number;
  cols?: number;
}

/**
 * Terminal session reference
 */
export interface TerminalSession {
  id: string;
  pid: number;
  title: string;
  createdAt: string;
  // Note: Actual terminal process managed by terminal router
}

/**
 * Context management types
 */
export interface ContextOptions {
  initialPrompt?: string;
  metadata?: Record<string, unknown>;
}

export interface Context {
  id: string;
  agentId: AgentId;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  messageCount: number;
}

export type ContextUpdate = Partial<Pick<Context, "metadata" | "updatedAt">>;

/**
 * Agent configuration types
 */
export interface AgentConfig {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  mcpServers?: MCPConfig[];
  skills?: SkillConfig[];
  [key: string]: unknown;
}

/**
 * MCP server configuration
 */
export interface MCPConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Skill configuration
 */
export interface SkillConfig {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Task execution types
 */
export interface AgentTask {
  id: string;
  type: "prompt" | "command" | "code" | "custom";
  content: string;
  options?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent message types for inter-agent communication
 */
export interface AgentMessage {
  id: string;
  from: AgentId;
  to?: AgentId; // undefined for broadcast
  timestamp: string;
  type: "request" | "response" | "notification";
  content: unknown;
}

export interface AgentResponse {
  messageId: string;
  from: AgentId;
  success: boolean;
  content?: unknown;
  error?: string;
}

/**
 * Task handoff between agents
 */
export interface TaskHandoff {
  taskId: string;
  from: AgentId;
  to: AgentId;
  context: Context;
  task: AgentTask;
}

/**
 * Shared resource types
 */
export interface SharedResource {
  id: string;
  type: "mcp" | "skill" | "config";
  name: string;
  config: Record<string, unknown>;
  sharedWith: AgentId[];
  createdAt: string;
  updatedAt: string;
}
