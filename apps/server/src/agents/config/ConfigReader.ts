/**
 * Config Reader/Writer
 *
 * Utilities for reading and writing agent configuration files.
 * Supports JSON, TOML, and SQLite (for Cursor) formats.
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Config reader/writer utility class
 */
export class ConfigReader {
  /**
   * Read a JSON config file
   */
  static async readJSON(filePath: string): Promise<Record<string, unknown>> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {}; // File doesn't exist, return empty config
      }
      throw error;
    }
  }

  /**
   * Write a JSON config file
   */
  static async writeJSON(filePath: string, data: Record<string, unknown>): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write with pretty formatting
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Read a TOML config file
   */
  static async readTOML(filePath: string): Promise<Record<string, unknown>> {
    try {
      const content = await fs.readFile(filePath, "utf-8");

      // Dynamic import of toml package
      const toml = await import("toml");
      return toml.parse(content) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {}; // File doesn't exist, return empty config
      }
      throw error;
    }
  }

  /**
   * Write a TOML config file
   */
  static async writeTOML(filePath: string, data: Record<string, unknown>): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Dynamic import of toml package
    // Note: toml package only supports parsing, not writing
    // For now, we'll write as JSON with .toml extension
    // In production, use a proper TOML writer like @iarna/toml
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Read Cursor config from SQLite database
   * Cursor stores settings as JSON blob in SQLite
   */
  static async readSQLite(
    dbPath: string,
    key: string
  ): Promise<Record<string, unknown> | null> {
    try {
      // Dynamic import of better-sqlite3
      const Database = await import("better-sqlite3").then((m) => m.default);
      const db = new Database.Database(dbPath);

      // Query the value from ItemTable
      const row = db
        .prepare("SELECT value FROM ItemTable WHERE key = ?")
        .get(key) as { value: string } | undefined;

      db.close();

      if (!row || !row.value) {
        return null;
      }

      // Parse the JSON blob
      return JSON.parse(row.value) as Record<string, unknown>;
    } catch (error) {
      // If file doesn't exist or error, return null
      return null;
    }
  }

  /**
   * Write Cursor config to SQLite database
   */
  static async writeSQLite(
    dbPath: string,
    key: string,
    value: Record<string, unknown>
  ): Promise<void> {
    try {
      // Dynamic import of better-sqlite3
      const Database = await import("better-sqlite3").then((m) => m.default);
      const db = new Database.Database(dbPath);

      // Insert or update the value in ItemTable
      const jsonString = JSON.stringify(value);
      const now = Date.now();

      const existing = db
        .prepare("SELECT 1 FROM ItemTable WHERE key = ?")
        .get(key);

      if (existing) {
        db.prepare("UPDATE ItemTable SET value = ?, timestamp = ? WHERE key = ?")
          .run(jsonString, now, key);
      } else {
        db.prepare("INSERT INTO ItemTable (key, value, timestamp) VALUES (?, ?, ?)")
          .run(key, jsonString, now);
      }

      db.close();
    } catch (error) {
      throw new Error(`Failed to write SQLite config: ${error}`);
    }
  }

  /**
   * Get home directory path
   */
  static getHomeDir(): string {
    return os.homedir();
  }

  /**
   * Get config path for an agent
   */
  static getAgentConfigPath(agentId: string): string {
    const home = this.getHomeDir();

    switch (agentId) {
      case "claude":
        return path.join(home, ".claude");

      case "codex":
        return path.join(home, ".codex");

      case "copilot":
        return path.join(home, ".config", "github-copilot");

      case "cursor":
        if (process.platform === "darwin") {
          return path.join(
            home,
            "Library",
            "Application Support",
            "Cursor",
            "User",
            "globalStorage"
          );
        } else if (process.platform === "win32") {
          return path.join(
            home,
            "AppData",
            "Roaming",
            "Cursor",
            "User",
            "globalStorage"
          );
        } else {
          return path.join(home, ".config", "Cursor", "User", "globalStorage");
        }

      case "kimi":
        return path.join(home, ".kimi");

      default:
        throw new Error(`Unknown agent ID: ${agentId}`);
    }
  }

  /**
   * Get specific config file path for an agent
   */
  static getAgentConfigFilePath(agentId: string, configType: string): string {
    const basePath = this.getAgentConfigPath(agentId);

    switch (agentId) {
      case "claude":
        switch (configType) {
          case "settings":
            return path.join(basePath, "settings.json");
          case "mcp":
            return path.join(basePath, "mcp_servers.json");
          case "skills":
            return path.join(basePath, "skills.json");
          default:
            return path.join(basePath, `${configType}.json`);
        }

      case "codex":
        switch (configType) {
          case "config":
            return path.join(basePath, "config.toml");
          case "auth":
            return path.join(basePath, "auth.json");
          default:
            return path.join(basePath, `${configType}.json`);
        }

      case "copilot":
        return path.join(basePath, `${configType}.json`);

      case "cursor":
        // Cursor uses SQLite
        return path.join(basePath, "state.vscdb");

      case "kimi":
        switch (configType) {
          case "config":
            return path.join(basePath, "config.toml");
          case "mcp":
            return path.join(basePath, "mcp.json");
          default:
            return path.join(basePath, `${configType}.json`);
        }

      default:
        throw new Error(`Unknown agent ID: ${agentId}`);
    }
  }

  /**
   * Check if a config file exists
   */
  static async configExists(agentId: string, configType: string): Promise<boolean> {
    const filePath = this.getAgentConfigFilePath(agentId, configType);

    if (agentId === "cursor" && configType === "settings") {
      // For Cursor, check if the SQLite DB exists
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read agent config (auto-detect format)
   */
  static async readAgentConfig(
    agentId: string,
    configType: string
  ): Promise<Record<string, unknown> | null> {
    const filePath = this.getAgentConfigFilePath(agentId, configType);

    if (agentId === "cursor" && configType === "settings") {
      // Cursor uses SQLite with specific keys
      const dbPath = filePath;
      // Try common Cursor settings keys
      const keys = ["settings", "configuration", "config"];
      for (const key of keys) {
        const result = await this.readSQLite(dbPath, key);
        if (result) {
          return result;
        }
      }
      return null;
    }

    // Determine file format by extension
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case ".json":
        return await this.readJSON(filePath);

      case ".toml":
        return await this.readTOML(filePath);

      default:
        // Try JSON first, then TOML
        try {
          return await this.readJSON(filePath);
        } catch {
          return await this.readTOML(filePath);
        }
    }
  }

  /**
   * Write agent config (auto-detect format)
   */
  static async writeAgentConfig(
    agentId: string,
    configType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const filePath = this.getAgentConfigFilePath(agentId, configType);

    if (agentId === "cursor" && configType === "settings") {
      // Cursor uses SQLite
      await this.writeSQLite(filePath, "settings", data);
      return;
    }

    // Determine file format by extension
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case ".json":
        await this.writeJSON(filePath, data);
        break;

      case ".toml":
        await this.writeTOML(filePath, data);
        break;

      default:
        // Default to JSON
        await this.writeJSON(filePath, data);
        break;
    }
  }
}
