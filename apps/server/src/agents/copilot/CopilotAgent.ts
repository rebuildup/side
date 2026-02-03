/**
 * GitHub Copilot Agent Adapter
 *
 * GitHub Copilot is primarily a VS Code extension, but it also has CLI capabilities.
 * Config location: ~/.config/github-copilot/
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  AgentConfig,
  AgentInfo,
  ContextInfo,
  MCPInfo,
  SkillInfo,
  TerminalOptions,
  TerminalSession,
} from "../types.js";
import { BaseAgent } from "../base/BaseAgent.js";
import { ConfigReader } from "../config/ConfigReader.js";

const COPILOT_ID = "copilot" as const;
const COPILOT_NAME = "GitHub Copilot";
const COPILOT_ICON = "copilot";
const COPILOT_DESCRIPTION = "GitHub's AI pair programmer";

export class CopilotAgent extends BaseAgent {
  private configPath: string;
  private configReader: ConfigReader;

  constructor() {
    super(COPILOT_ID, COPILOT_NAME, COPILOT_ICON, COPILOT_DESCRIPTION);

    // Copilot config location
    this.configPath = path.join(
      os.homedir(),
      ".config",
      "github-copilot"
    );

    this.configReader = new ConfigReader();
  }

  /**
   * Get agent info
   */
  override async getInfo(): Promise<AgentInfo> {
    const isInstalled = await this.checkIfInstalled();
    const config = await this.getConfig();

    return {
      id: COPILOT_ID,
      name: COPILOT_NAME,
      icon: COPILOT_ICON,
      description: COPILOT_DESCRIPTION,
      enabled: isInstalled,
      installed: isInstalled,
      version: await this.getVersion(),
      configPath: this.configPath,
      configExists: isInstalled,
    };
  }

  /**
   * Get agent configuration
   */
  override async getConfig(): Promise<AgentConfig> {
    try {
      // Copilot stores settings in VS Code storage
      const settingsPath = path.join(this.configPath, "settings.json");

      if (!fs.existsSync(settingsPath)) {
        return this.getDefaultConfig();
      }

      const config = await this.configReader.readJSON(settingsPath);

      return {
        apiKey: config.auth?.token || config.token,
        apiEndpoint: config.endpoint || "https://api.githubcopilot.com",
        model: config.model || "gpt-4",
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        mcpServers: [],
        skills: [],
      };
    } catch (error) {
      console.error("[Copilot] Failed to read config:", error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Update agent configuration
   */
  override async updateConfig(config: Partial<AgentConfig>): Promise<void> {
    try {
      const settingsPath = path.join(this.configPath, "settings.json");

      // Ensure directory exists
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }

      // Read existing config
      let existingConfig: Record<string, unknown> = {};
      if (fs.existsSync(settingsPath)) {
        existingConfig = await this.configReader.readJSON(settingsPath) as Record<string, unknown>;
      }

      // Merge with new config
      const updatedConfig = {
        ...existingConfig,
        ...(config.apiKey && { auth: { token: config.apiKey } }),
        ...(config.apiEndpoint && { endpoint: config.apiEndpoint }),
        ...(config.model && { model: config.model }),
        ...(config.temperature !== undefined && { temperature: config.temperature }),
        ...(config.maxTokens !== undefined && { maxTokens: config.maxTokens }),
      };

      // Write config
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(updatedConfig, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("[Copilot] Failed to update config:", error);
      throw error;
    }
  }

  /**
   * List configured MCPs
   * Note: Copilot doesn't natively support MCPs
   */
  override async listMCPs(): Promise<MCPInfo[]> {
    // Copilot doesn't have native MCP support
    // Return empty array
    return [];
  }

  /**
   * List configured Skills
   * Note: Copilot doesn't natively support Skills
   */
  override async listSkills(): Promise<SkillInfo[]> {
    // Copilot doesn't have native Skills support
    return [];
  }

  /**
   * Start a terminal with Copilot CLI
   */
  override async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Copilot CLI command: gh copilot
    const command = "gh";
    const args = ["copilot", ...this.buildCopilotArgs(options)];

    return {
      id: options.terminalId || `copilot-${Date.now()}`,
      command,
      args,
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
    };
  }

  /**
   * Check if Copilot is installed
   */
  private async checkIfInstalled(): Promise<boolean> {
    try {
      // Check if gh CLI is installed
      const { execSync } = await import("node:child_process");
      execSync("gh --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Copilot version
   */
  private async getVersion(): Promise<string | null> {
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("gh copilot --version 2>&1 || gh --version", {
        encoding: "utf-8",
      });
      const match = output.match(/version (\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Build Copilot CLI arguments
   */
  private buildCopilotArgs(options: Record<string, unknown>): string[] {
    const args: string[] = [];

    if (options.model) {
      args.push("--model", String(options.model));
    }

    if (options.temperature) {
      args.push("--temperature", String(options.temperature));
    }

    if (options.maxTokens) {
      args.push("--max-tokens", String(options.maxTokens));
    }

    // Add prompt or subcommand
    if (options.prompt) {
      args.push("explain", String(options.prompt));
    }

    return args;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AgentConfig {
    return {
      apiEndpoint: "https://api.githubcopilot.com",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 2000,
      mcpServers: [],
      skills: [],
    };
  }

  /**
   * Execute a task
   */
  override async executeTask(task: {
    type: string;
    content: string;
    options?: Record<string, unknown>;
  }): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      const { execSync } = await import("node:child_process");

      const args = ["copilot"];

      switch (task.type) {
        case "explain":
          args.push("explain", task.content);
          break;
        case "fix":
          args.push("fix", task.content);
          break;
        case "test":
          args.push("test", task.content);
          break;
        case "review":
          args.push("review", task.content);
          break;
        default:
          return {
            success: false,
            error: `Unknown task type: ${task.type}`,
          };
      }

      const output = execSync(`gh ${args.join(" ")}`, {
        encoding: "utf-8",
        cwd: task.options?.cwd as string || process.cwd(),
      });

      return {
        success: true,
        result: output,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
