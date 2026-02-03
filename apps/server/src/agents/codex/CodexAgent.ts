/**
 * OpenAI Codex Agent Adapter
 *
 * Adapter for OpenAI Codex CLI agent.
 * Reads config from ~/.codex/config.toml and ~/.codex/auth.json
 */

import path from "node:path";
import type {
  AgentConfig,
  AgentTask,
  Context,
  ContextOptions,
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
 * OpenAI Codex configuration format
 */
interface CodexConfigFile {
  api_key?: string;
  base_url?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  provider?: string;
  [key: string]: unknown;
}

/**
 * OpenAI Codex auth format
 */
interface CodexAuthFile {
  apiKey?: string;
  token?: string;
  provider?: string;
  [key: string]: unknown;
}

/**
 * OpenAI Codex Agent Adapter
 */
export class CodexAgent extends BaseAgent {
  constructor(config?: Partial<BaseAgentConfig>) {
    super({
      id: "codex",
      name: "OpenAI Codex",
      icon: "/icons/agents/codex.svg",
      description: "OpenAI's Codex CLI - AI-powered coding assistant",
      configPath:
        config?.configPath || ConfigReader.getAgentConfigPath("codex"),
    });
  }

  // ==================== Terminal Operations ====================

  async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Create a Codex terminal session
    const terminalId = this.generateId();

    // Default command is 'codex'
    const command = options.command || "codex";

    const session: TerminalSession = {
      id: terminalId,
      pid: 0, // Will be set by terminal router
      title: options.title || `Codex Terminal`,
      createdAt: new Date().toISOString(),
    };

    this.terminals.set(terminalId, session);
    return session;
  }

  // ==================== Context Management ====================

  override async createContext(options: ContextOptions): Promise<Context> {
    await this.ensureInitialized();

    // Codex doesn't have built-in context management like Claude
    // We'll create a basic context structure
    const context: Context = {
      id: this.generateId(),
      agentId: this.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: options.metadata || {},
      messageCount: 0,
    };

    // Store initial prompt in metadata
    if (options.initialPrompt) {
      context.metadata.initialPrompt = options.initialPrompt;
    }

    this.contexts.set(context.id, context);
    return context;
  }

  // ==================== Config Management ====================

  protected override async loadConfig(): Promise<void> {
    // Load config from ~/.codex/config.toml
    const configPath = ConfigReader.getAgentConfigFilePath("codex", "config");
    const authPath = ConfigReader.getAgentConfigFilePath("codex", "auth");

    const codexConfig = (await ConfigReader.readAgentConfig(
      "codex",
      "config"
    )) as CodexConfigFile;

    const codexAuth = (await ConfigReader.readAgentConfig(
      "codex",
      "auth"
    )) as CodexAuthFile;

    // Merge configs, with auth taking precedence for API key
    this.config = {
      ...(codexConfig || {}),
      ...(codexAuth || {}),
    };

    // Map Codex-specific fields to standard format
    if (this.config.api_key && !this.config.apiKey) {
      this.config.apiKey = this.config.api_key as string;
    }
    if (this.config.max_tokens && !this.config.maxTokens) {
      this.config.maxTokens = this.config.max_tokens as number;
    }
  }

  protected override async saveConfig(): Promise<void> {
    // Save config to ~/.codex/config.toml
    const configPath = ConfigReader.getAgentConfigFilePath("codex", "config");

    // Map standard format back to Codex format
    const codexConfig: CodexConfigFile = {};

    if (this.config.apiKey) {
      codexConfig.api_key = this.config.apiKey as string;
    }
    if (this.config.base_url) {
      codexConfig.base_url = this.config.base_url as string;
    }
    if (this.config.model) {
      codexConfig.model = this.config.model as string;
    }
    if (this.config.temperature !== undefined) {
      codexConfig.temperature = this.config.temperature as number;
    }
    if (this.config.maxTokens !== undefined) {
      codexConfig.max_tokens = this.config.maxTokens as number;
    }
    if (this.config.provider) {
      codexConfig.provider = this.config.provider as string;
    }

    // Write as TOML (default for Codex)
    await ConfigReader.writeTOML(configPath, codexConfig);
  }

  // ==================== MCP/Skills Operations ====================

  protected override async loadMCPs(): Promise<void> {
    // Codex may use MCP servers configured in config
    // Check for mcp_servers section in config
    const configPath = ConfigReader.getAgentConfigFilePath("codex", "config");
    const codexConfig = await ConfigReader.readAgentConfig("codex", "config");

    if (codexConfig && codexConfig.mcpServers) {
      const servers = codexConfig.mcpServers as Array<{
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
    // Save MCP servers to ~/.codex/config.toml
    const configPath = ConfigReader.getAgentConfigFilePath("codex", "config");
    const codexConfig = (await ConfigReader.readAgentConfig(
      "codex",
      "config"
    )) as CodexConfigFile;

    const servers = Array.from(this.mcpServers.values()).map((mcp) => ({
      name: mcp.name,
      command: mcp.command,
      args: mcp.args,
      env: mcp.env,
    }));

    codexConfig.mcpServers = servers;
    await ConfigReader.writeTOML(configPath, codexConfig);
  }

  protected override async loadSkills(): Promise<void> {
    // Codex skills are typically stored as individual files
    const skillsDir = path.join(
      ConfigReader.getAgentConfigPath("codex"),
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
            description: `Codex skill: ${skillId}`,
            status: "active",
          };
          this.skills.set(skillId, skillInfo);
        }
      }
    } catch {
      // Skills directory doesn't exist
    }
  }

  protected override async saveSkills(): Promise<void> {
    // Skills are managed as individual files
    // This is a no-op for Codex
  }

  // ==================== Task Execution ====================

  async executeTask(task: AgentTask): Promise<TaskResult> {
    await this.ensureInitialized();

    // For Codex, tasks are executed via the CLI
    // We track the task but actual execution happens in terminal
    const context = Array.from(this.contexts.values())[0];
    if (context) {
      context.messageCount++;
      context.updatedAt = new Date().toISOString();
    }

    return {
      taskId: task.id,
      success: true,
      output: `Task sent to Codex: ${task.content}`,
    };
  }

  // ==================== Codex-Specific Methods ====================

  /**
   * Get the configured API key
   */
  getAPIKey(): string | undefined {
    return this.config.apiKey as string;
  }

  /**
   * Get the configured model
   */
  getModel(): string | undefined {
    return this.config.model as string;
  }

  /**
   * Get the configured base URL
   */
  getBaseURL(): string | undefined {
    return this.config.base_url as string;
  }

  /**
   * Get the configured temperature
   */
  getTemperature(): number {
    return (this.config.temperature as number) || 0.7;
  }

  /**
   * Get the configured max tokens
   */
  getMaxTokens(): number {
    return (this.config.maxTokens as number) || 2048;
  }
}
