/**
 * Cursor Agent Adapter
 *
 * Cursor is a code editor with built-in AI.
 * Config location: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb (SQLite with JSON blob)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
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

const CURSOR_ID = "cursor" as const;
const CURSOR_NAME = "Cursor";
const CURSOR_ICON = "cursor";
const CURSOR_DESCRIPTION = "AI-powered code editor";

// Platform-specific cursor config paths
function getCursorConfigPath(): string {
  const platform = os.platform();
  switch (platform) {
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb"
      );
    case "win32":
      return path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb"
      );
    case "linux":
      return path.join(
        os.homedir(),
        ".config",
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb"
      );
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export class CursorAgent extends BaseAgent {
  private dbPath: string;

  constructor() {
    super(CURSOR_ID, CURSOR_NAME, CURSOR_ICON, CURSOR_DESCRIPTION);
    this.dbPath = getCursorConfigPath();
  }

  /**
   * Get agent info
   */
  override async getInfo(): Promise<AgentInfo> {
    const isInstalled = await this.checkIfInstalled();
    const config = await this.getConfig();

    return {
      id: CURSOR_ID,
      name: CURSOR_NAME,
      icon: CURSOR_ICON,
      description: CURSOR_DESCRIPTION,
      enabled: isInstalled,
      installed: isInstalled,
      version: await this.getVersion(),
      configPath: this.dbPath,
      configExists: isInstalled,
    };
  }

  /**
   * Get agent configuration from SQLite database
   */
  override async getConfig(): Promise<AgentConfig> {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return this.getDefaultConfig();
      }

      const db = new Database(this.dbPath, { readonly: true });

      // Cursor stores various settings as JSON in the ItemTable
      const getConfigValue = (key: string): unknown => {
        const stmt = db.prepare(
          "SELECT value FROM ItemTable WHERE key = ?"
        );
        const row = stmt.get(key) as { value: string } | undefined;
        if (row?.value) {
          try {
            return JSON.parse(row.value);
          } catch {
            return row.value;
          }
        }
        return undefined;
      };

      // Get API key from various possible locations
      const apiKey = getConfigValue("cursor.auth.apiKey") as string | undefined ||
                     getConfigValue("github.copilot.apiKey") as string | undefined ||
                     getConfigValue("cursor.apiKey") as string | undefined;

      // Get model settings
      const model = getConfigValue("cursor.model") as string | undefined || "cursor-small";
      const temperature = getConfigValue("cursor.temperature") as number | undefined;
      const maxTokens = getConfigValue("cursor.maxTokens") as number | undefined;

      db.close();

      return {
        apiKey,
        apiEndpoint: "https://api.cursor.sh",
        model,
        temperature,
        maxTokens,
        mcpServers: [],
        skills: [],
      };
    } catch (error) {
      console.error("[Cursor] Failed to read config:", error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Update agent configuration in SQLite database
   */
  override async updateConfig(config: Partial<AgentConfig>): Promise<void> {
    try {
      if (!fs.existsSync(this.dbPath)) {
        throw new Error("Cursor config database not found");
      }

      const db = new Database(this.dbPath);

      const setConfigValue = (key: string, value: unknown): void => {
        const stmt = db.prepare(
          "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)"
        );
        stmt.run(key, JSON.stringify(value));
      };

      // Update API key
      if (config.apiKey) {
        setConfigValue("cursor.apiKey", config.apiKey);
      }

      // Update model settings
      if (config.model) {
        setConfigValue("cursor.model", config.model);
      }

      if (config.temperature !== undefined) {
        setConfigValue("cursor.temperature", config.temperature);
      }

      if (config.maxTokens !== undefined) {
        setConfigValue("cursor.maxTokens", config.maxTokens);
      }

      db.close();
    } catch (error) {
      console.error("[Cursor] Failed to update config:", error);
      throw error;
    }
  }

  /**
   * List configured MCPs
   * Cursor has some MCP support in newer versions
   */
  override async listMCPs(): Promise<MCPInfo[]> {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return [];
      }

      const db = new Database(this.dbPath, { readonly: true });

      const stmt = db.prepare(
        "SELECT value FROM ItemTable WHERE key LIKE '%mcp%'"
      );
      const rows = stmt.all() as { value: string }[];

      db.close();

      const mcps: MCPInfo[] = [];
      for (const row of rows) {
        try {
          const mcp = JSON.parse(row.value);
          if (mcp && mcp.enabled) {
            mcps.push({
              id: mcp.id || mcp.name,
              name: mcp.name,
              enabled: mcp.enabled !== false,
              config: mcp,
            });
          }
        } catch {
          // Skip invalid entries
        }
      }

      return mcps;
    } catch (error) {
      console.error("[Cursor] Failed to list MCPs:", error);
      return [];
    }
  }

  /**
   * List configured Skills
   */
  override async listSkills(): Promise<SkillInfo[]> {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return [];
      }

      const db = new Database(this.dbPath, { readonly: true });

      const stmt = db.prepare(
        "SELECT value FROM ItemTable WHERE key LIKE '%skill%'"
      );
      const rows = stmt.all() as { value: string }[];

      db.close();

      const skills: SkillInfo[] = [];
      for (const row of rows) {
        try {
          const skill = JSON.parse(row.value);
          if (skill && skill.enabled) {
            skills.push({
              id: skill.id || skill.name,
              name: skill.name,
              description: skill.description,
              enabled: skill.enabled !== false,
              config: skill,
            });
          }
        } catch {
          // Skip invalid entries
        }
      }

      return skills;
    } catch (error) {
      console.error("[Cursor] Failed to list Skills:", error);
      return [];
    }
  }

  /**
   * Start a terminal with Cursor CLI
   */
  override async startTerminal(options: TerminalOptions): Promise<TerminalSession> {
    // Cursor CLI command: cursor
    const command = "cursor";
    const args = this.buildCursorArgs(options);

    return {
      id: options.terminalId || `cursor-${Date.now()}`,
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
   * Check if Cursor is installed
   */
  private async checkIfInstalled(): Promise<boolean> {
    try {
      // Check if cursor command is available
      const { execSync } = await import("node:child_process");
      execSync("cursor --version", { stdio: "ignore" });
      return true;
    } catch {
      // Fallback: check if config database exists
      return fs.existsSync(this.dbPath);
    }
  }

  /**
   * Get Cursor version
   */
  private async getVersion(): Promise<string | null> {
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("cursor --version", { encoding: "utf-8" });
      const match = output.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Build Cursor CLI arguments
   */
  private buildCursorArgs(options: Record<string, unknown>): string[] {
    const args: string[] = [];

    if (options.model) {
      args.push("--model", String(options.model));
    }

    // Add prompt or subcommand
    if (options.prompt) {
      args.push("ask", String(options.prompt));
    }

    return args;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AgentConfig {
    return {
      apiEndpoint: "https://api.cursor.sh",
      model: "cursor-small",
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

      const args = ["cursor"];

      switch (task.type) {
        case "ask":
        case "prompt":
          args.push("ask", task.content);
          break;
        case "edit":
          args.push("edit", task.content);
          break;
        case "explain":
          args.push("explain", task.content);
          break;
        default:
          return {
            success: false,
            error: `Unknown task type: ${task.type}`,
          };
      }

      const output = execSync(`cursor ${args.join(" ")}`, {
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
