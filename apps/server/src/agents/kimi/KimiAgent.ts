/**
 * Kimi Agent Adapter
 *
 * Kimi is Moonshot AI's code assistant CLI.
 * Config location: ~/.kimi/config.toml
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

const KIMI_ID = "kimi" as const;
const KIMI_NAME = "Kimi";
const KIMI_ICON = "kimi";
const KIMI_DESCRIPTION = "Moonshot AI's code assistant";

export class KimiAgent extends BaseAgent {
  private configPath: string;
  private authPath: string;
  private configReader: ConfigReader;

  constructor() {
    super(KIMI_ID, KIMI_NAME, KIMI_ICON, KIMI_DESCRIPTION);

    // Kimi config locations
    const configDir = path.join(os.homedir(), ".kimi");
    this.configPath = path.join(configDir, "config.toml");
    this.authPath = path.join(configDir, "auth.json");

    this.configReader = new ConfigReader();
  }

  /**
   * Get agent info
   */
  override async getInfo(): Promise<AgentInfo> {
    const isInstalled = await this.checkIfInstalled();
    const config = await this.getConfig();

    return {
      id: KIMI_ID,
      name: KIMI_NAME,
      icon: KIMI_ICON,
      description: KIMI_DESCRIPTION,
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
      if (!fs.existsSync(this.configPath)) {
        return this.getDefaultConfig();
      }

      const config = await this.configReader.readTOML(this.configPath);

      // Also read auth.json for API key
      let apiKey: string | undefined;
      if (fs.existsSync(this.authPath)) {
        const auth = await this.configReader.readJSON(this.authPath);
        apiKey = auth.apiKey || auth.token;
      }

      return {
        apiKey: apiKey || config.apiKey || config.api_key,
        apiEndpoint: config.endpoint || config.api_endpoint || "https://api.moonshot.cn",
        model: config.model || "moonshot-v1-8k",
        temperature: config.temperature,
        maxTokens: config.maxTokens || config.max_tokens,
        mcpServers: [],
        skills: [],
      };
    } catch (error) {
      console.error("[Kimi] Failed to read config:", error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Update agent configuration
   */
  override async updateConfig(config: Partial<AgentConfig>): Promise<void> {
    try {
      const configDir = path.join(os.homedir(), ".kimi");

      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Update TOML config
      if (fs.existsSync(this.configPath)) {
        let existingConfig = await this.configReader.readTOML(this.configPath);

        // Merge with new config
        existingConfig = {
          ...existingConfig,
          ...(config.apiEndpoint && { endpoint: config.apiEndpoint }),
          ...(config.model && { model: config.model }),
          ...(config.temperature !== undefined && { temperature: config.temperature }),
          ...(config.maxTokens !== undefined && { maxTokens: config.maxTokens }),
        };

        // Write TOML (convert to string)
        const toml = this.configToTOMLString(existingConfig);
        fs.writeFileSync(this.configPath, toml, "utf-8");
      }

      // Update auth.json for API key
      if (config.apiKey) {
        let auth: Record<string, unknown> = {};
        if (fs.existsSync(this.authPath)) {
          auth = await this.configReader.readJSON(this.authPath) as Record<string, unknown>;
        }

        auth.apiKey = config.apiKey;
        fs.writeFileSync(
          this.authPath,
          JSON.stringify(auth, null, 2),
          "utf-8"
        );
      }
    } catch (error) {
      console.error("[Kimi] Failed to update config:", error);
      throw error;
    }
  }

  /**
   * List configured MCPs
   * Kimi doesn't natively support MCPs
   */
  override async listMCPs(): Promise<MCPInfo[]> {
    return [];
  }

  /**
   * List configured Skills
   * Kimi doesn't natively support Skills
   */
  override async listSkills(): Promise<SkillInfo[]> {
    return [];
  }

  /**
   * Start a terminal with Kimi CLI
   */
  override async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Kimi CLI command: kimi
    const command = "kimi";
    const args = this.buildKimiArgs(options);

    return {
      id: options.terminalId || `kimi-${Date.now()}`,
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
   * Check if Kimi is installed
   */
  private async checkIfInstalled(): Promise<boolean> {
    try {
      // Check if kimi command is available
      const { execSync } = await import("node:child_process");
      execSync("kimi --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Kimi version
   */
  private async getVersion(): Promise<string | null> {
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("kimi --version", { encoding: "utf-8" });
      const match = output.match(/version (\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Build Kimi CLI arguments
   */
  private buildKimiArgs(options: Record<string, unknown>): string[] {
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

    // Add prompt
    if (options.prompt) {
      args.push(String(options.prompt));
    }

    return args;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AgentConfig {
    return {
      apiEndpoint: "https://api.moonshot.cn",
      model: "moonshot-v1-8k",
      temperature: 0.7,
      maxTokens: 2000,
      mcpServers: [],
      skills: [],
    };
  }

  /**
   * Convert config object to TOML string
   */
  private configToTOMLString(config: Record<string, unknown>): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === "string") {
        lines.push(`${key} = "${value}"`);
      } else if (typeof value === "number") {
        lines.push(`${key} = ${value}`);
      } else if (typeof value === "boolean") {
        lines.push(`${key} = ${value}`);
      } else if (Array.isArray(value)) {
        lines.push(`${key} = [${value.map((v) => `"${v}"`).join(", ")}]`);
      } else if (typeof value === "object") {
        // Nested object - create table
        lines.push(`[${key}]`);
        for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          if (typeof nestedValue === "string") {
            lines.push(`  ${nestedKey} = "${nestedValue}"`);
          } else if (typeof nestedValue === "number") {
            lines.push(`  ${nestedKey} = ${nestedValue}`);
          } else if (typeof nestedValue === "boolean") {
            lines.push(`  ${nestedKey} = ${nestedValue}`);
          }
        }
      }
    }

    return lines.join("\n") + "\n";
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

      const args = ["kimi"];

      switch (task.type) {
        case "ask":
        case "prompt":
          args.push(task.content);
          break;
        case "code":
          args.push("--code", task.content);
          break;
        case "explain":
          args.push("--explain", task.content);
          break;
        default:
          return {
            success: false,
            error: `Unknown task type: ${task.type}`,
          };
      }

      const output = execSync(`kimi ${args.join(" ")}`, {
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
