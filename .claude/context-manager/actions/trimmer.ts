/**
 * Output Trimmer for Claude Context Manager
 *
 * Reduces large outputs to summaries while preserving critical information.
 * Handles terminal output, file content, lists, and structured data.
 */

interface TrimmedOutput {
  original: string;
  trimmed: string;
  originalSize: number;
  trimmedSize: number;
  wasTrimmed: boolean;
  savedToFile?: string;
}

interface TrimmerConfig {
  threshold: number;
  saveToFileThreshold: number;
  logDir: string;
  terminalHeadLines: number;
  terminalTailLines: number;
}

/**
 * Trims large outputs to manageable summaries.
 *
 * Strategies:
 * - Terminal output: head + tail with omission marker
 * - File content: first/last portions + summary
 * - Lists: count + description
 * - Structured data: keys + sample values
 */
class OutputTrimmer {
  private config: TrimmerConfig;

  constructor(config?: Partial<TrimmerConfig>) {
    this.config = {
      threshold: config?.threshold ?? 10_000,
      saveToFileThreshold: config?.saveToFileThreshold ?? 100_000,
      logDir: config?.logDir ?? ".claude/logs",
      terminalHeadLines: config?.terminalHeadLines ?? 1000,
      terminalTailLines: config?.terminalTailLines ?? 500,
    };
  }

  /**
   * Check if content needs trimming based on threshold.
   */
  needsTrim(content: string, threshold?: number): boolean {
    const limit = threshold ?? this.config.threshold;
    return content.length > limit;
  }

  /**
   * Trim a large output to summary.
   */
  trim(content: string, threshold?: number): TrimmedOutput {
    const limit = threshold ?? this.config.threshold;
    const originalSize = content.length;

    if (!this.needsTrim(content, limit)) {
      return {
        original: content,
        trimmed: content,
        originalSize,
        trimmedSize: originalSize,
        wasTrimmed: false,
      };
    }

    let trimmed = content;
    let savedToFile: string | undefined;

    // Save very large content to file
    if (originalSize > this.config.saveToFileThreshold) {
      savedToFile = this.saveToFile(content);
    }

    // Detect content type and apply appropriate strategy
    if (this.isTerminalOutput(content)) {
      trimmed = this.trimTerminalOutput(content);
    } else if (this.isNpmInstallLog(content)) {
      trimmed = this.trimNpmInstallLog(content);
    } else if (this.isTestResult(content)) {
      trimmed = this.trimTestResult(content);
    } else if (this.isJsonArray(content)) {
      trimmed = this.trimJsonArray(content);
    } else if (this.isJsonObject(content)) {
      trimmed = this.trimJsonObject(content);
    } else if (this.isListLike(content)) {
      trimmed = this.trimListContent(content);
    } else {
      trimmed = this.trimGenericContent(content);
    }

    return {
      original: content,
      trimmed,
      originalSize,
      trimmedSize: trimmed.length,
      wasTrimmed: true,
      savedToFile,
    };
  }

  /**
   * Trim tool result with context-aware handling.
   */
  trimToolResult(toolName: string, _args: unknown, result: unknown): TrimmedOutput {
    const content = this.formatResult(result);
    const originalSize = content.length;

    if (!this.needsTrim(content)) {
      return {
        original: content,
        trimmed: content,
        originalSize,
        trimmedSize: originalSize,
        wasTrimmed: false,
      };
    }

    let trimmed: string;
    let savedToFile: string | undefined;

    // Tool-specific trimming strategies
    switch (toolName) {
      case "bash":
      case "execute_command":
        trimmed = this.trimTerminalOutput(content);
        break;

      case "read_file":
      case "cat":
        trimmed = this.trimFileContent(content);
        break;

      case "npm_install":
      case "yarn_install":
        trimmed = this.trimNpmInstallLog(content);
        break;

      case "list_files":
      case "ls":
      case "find":
        trimmed = this.trimListContent(content);
        break;

      case "grep":
      case "search":
        trimmed = this.trimSearchResults(content);
        break;

      case "database_query":
      case "db_dump":
        trimmed = this.trimDatabaseDump(content);
        break;

      case "test":
      case "pytest":
      case "jest":
        trimmed = this.trimTestResult(content);
        break;

      default:
        trimmed = this.trim(content).trimmed;
    }

    // Save very large results
    if (originalSize > this.config.saveToFileThreshold) {
      savedToFile = this.saveToFile(content, `tool-${toolName}`);
    }

    return {
      original: content,
      trimmed,
      originalSize,
      trimmedSize: trimmed.length,
      wasTrimmed: true,
      savedToFile,
    };
  }

  /**
   * Detect if content looks like terminal output.
   */
  private isTerminalOutput(content: string): boolean {
    const terminalIndicators = [
      /^[$%>]\s/m, // Shell prompts
      /^\s*\d+:\d+:\d+/m, // Timestamps
      // biome-ignore lint/suspicious/noControlCharactersInRegex - ANSI escape sequence
      /\x1b\[[0-9;]*m/, // ANSI escape codes
      /^Building|Compiling|Installing/m,
      /error|warning|notice/i,
    ];

    return terminalIndicators.some((pattern) => pattern.test(content));
  }

  /**
   * Detect if content is npm install output.
   */
  private isNpmInstallLog(content: string): boolean {
    return (
      /^(npm|yarn|pnpm|bun)(\s+install)?/m.test(content) ||
      /added\s+\d+\s+packages?/i.test(content) ||
      /Packages:\s+\d+/m.test(content)
    );
  }

  /**
   * Detect if content is test results.
   */
  private isTestResult(content: string): boolean {
    return (
      /Tests:\s+\d+|passed|failed|skipped|PASS|FAIL/i.test(content) ||
      /Suite|Test|Spec/i.test(content) ||
      /assert|expect|describe|it\(/.test(content)
    );
  }

  /**
   * Detect if content is a JSON array.
   */
  private isJsonArray(content: string): boolean {
    const trimmed = content.trim();
    if (trimmed.startsWith("[")) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Detect if content is a JSON object.
   */
  private isJsonObject(content: string): boolean {
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Detect if content is list-like (many lines with similar structure).
   */
  private isListLike(content: string): boolean {
    const lines = content.split("\n");
    if (lines.length < 50) return false;

    // Check if many lines follow similar patterns
    const sample = lines.slice(0, 100);
    const patterns = new Set<string>();

    for (const line of sample) {
      const match = line.match(/^\s*[-*•\d+.]?\s*/);
      if (match) {
        patterns.add(match[0]);
      }
    }

    return patterns.size > 0 && patterns.size < 10;
  }

  /**
   * Trim terminal output keeping head and tail.
   */
  private trimTerminalOutput(content: string): string {
    const lines = content.split("\n");
    const totalLines = lines.length;

    if (totalLines <= this.config.terminalHeadLines + this.config.terminalTailLines) {
      return content;
    }

    const head = lines.slice(0, this.config.terminalHeadLines).join("\n");
    const tail = lines.slice(-this.config.terminalTailLines).join("\n");
    const omitted = totalLines - this.config.terminalHeadLines - this.config.terminalTailLines;

    return `${head}\n\n[... ${omitted.toLocaleString()} lines omitted ...]\n\n${tail}`;
  }

  /**
   * Trim npm install logs summarizing packages.
   */
  private trimNpmInstallLog(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];

    // Keep header and footer
    let _headerEnd = 0;
    const _footerStart = lines.length;

    for (let i = 0; i < Math.min(100, lines.length); i++) {
      result.push(lines[i]);
      if (/added|installed|packages/i.test(lines[i])) {
        _headerEnd = i;
        break;
      }
    }

    // Extract package summary
    const packages: string[] = [];
    const packagePattern = /^[\s\-+]*([a-z0-9@/\-_]+)/i;

    for (const line of lines) {
      const match = line.match(packagePattern);
      if (match?.[1] && !match[1].startsWith("npm")) {
        packages.push(match[1]);
      }
    }

    // Summarize packages
    if (packages.length > 0) {
      result.push("\n[Packages Summary]");
      result.push(`Total packages: ${packages.length}`);

      const uniquePackages = [...new Set(packages)];
      if (uniquePackages.length <= 20) {
        result.push(uniquePackages.sort().join(", "));
      } else {
        result.push(`Sample packages: ${uniquePackages.slice(0, 20).sort().join(", ")}`);
        result.push(`... and ${uniquePackages.length - 20} more`);
      }
    }

    // Keep errors if any
    const errors = lines.filter(
      (line) => /error|ERR!|failed|E[A-Z]+/i.test(line) && !/deprecated/i.test(line)
    );
    if (errors.length > 0) {
      result.push("\n[Errors]");
      result.push(...errors.slice(0, 10));
    }

    // Keep final status
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
      result.push(lines[i]);
      if (/done|complete|finished|in\s+\d+[ms]/i.test(lines[i])) {
        break;
      }
    }

    return result.join("\n");
  }

  /**
   * Trim test results showing summary and failures.
   */
  private trimTestResult(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];

    // Extract test summary
    const summaryPattern = /(\d+)\s+(tests?|suites?|specs?)\s+(\d+)\s+(passed|failed|skipped)/i;
    const summaryLines = lines.filter((line) => summaryPattern.test(line));

    if (summaryLines.length > 0) {
      result.push("[Test Summary]");
      result.push(...summaryLines);
    }

    // Extract failures
    const failures: string[] = [];
    let inFailure = false;

    for (const line of lines) {
      if (/fail|error|✗|❌/i.test(line)) {
        inFailure = true;
        failures.push(line);
      } else if (inFailure) {
        if (/^[\s-]{2,}$/.test(line) || line.trim() === "") {
          inFailure = false;
        } else {
          failures.push(line);
        }
      }
    }

    if (failures.length > 0) {
      result.push("\n[Failures]");
      result.push(...failures.slice(0, 50));
      if (failures.length > 50) {
        result.push(`\n... and ${failures.length - 50} more failure lines`);
      }
    }

    // Extract slowest tests if present
    const slowTests = lines.filter((line) => /slow|duration|time/i.test(line));
    if (slowTests.length > 0 && slowTests.length < 20) {
      result.push("\n[Slowest Tests]");
      result.push(...slowTests.slice(0, 10));
    }

    return result.length > 0 ? result.join("\n") : content.slice(0, 5000);
  }

  /**
   * Trim JSON array showing count and sample.
   */
  private trimJsonArray(content: string): string {
    try {
      const data = JSON.parse(content);
      if (!Array.isArray(data)) {
        return this.trimGenericContent(content);
      }

      const count = data.length;
      const sampleSize = Math.min(5, data.length);
      const sample = data.slice(0, sampleSize);

      let result = `[Array with ${count.toLocaleString()} items]\n\n`;
      result += "[Sample items:]\n";
      result += sample
        .map((item, i) => `${i + 1}. ${JSON.stringify(item, null, 2).split("\n").join("\n  ")}`)
        .join("\n\n");

      if (count > sampleSize) {
        result += `\n... and ${count - sampleSize} more items`;
      }

      return result;
    } catch {
      return this.trimGenericContent(content);
    }
  }

  /**
   * Trim JSON object showing keys and structure.
   */
  private trimJsonObject(content: string): string {
    try {
      const data = JSON.parse(content);
      const keys = Object.keys(data);

      let result = `[Object with ${keys.length} keys]\n\n`;
      result += "[Keys:]\n";
      result += keys.join(", ");

      result += "\n\n[Sample values:]\n";
      for (const key of keys.slice(0, 10)) {
        const value = data[key];
        const valueStr =
          typeof value === "object"
            ? JSON.stringify(value).slice(0, 100)
            : String(value).slice(0, 100);
        result += `${key}: ${valueStr}\n`;
      }

      if (keys.length > 10) {
        result += `\n... and ${keys.length - 10} more keys`;
      }

      return result;
    } catch {
      return this.trimGenericContent(content);
    }
  }

  /**
   * Trim list-like content.
   */
  private trimListContent(content: string): string {
    const lines = content.split("\n");
    const totalLines = lines.length;

    if (totalLines <= 100) {
      return content;
    }

    const head = lines.slice(0, 50).join("\n");
    const tail = lines.slice(-20).join("\n");
    const omitted = totalLines - 70;

    return `${head}\n\n[... ${omitted.toLocaleString()} items omitted ...]\n\n${tail}`;
  }

  /**
   * Trim file content keeping structure.
   */
  private trimFileContent(content: string): string {
    const lines = content.split("\n");
    const totalLines = lines.length;
    const headLines = 500;
    const tailLines = 200;

    if (totalLines <= headLines + tailLines) {
      return content;
    }

    const head = lines.slice(0, headLines).join("\n");
    const tail = lines.slice(-tailLines).join("\n");
    const omitted = totalLines - headLines - tailLines;

    // Add line count context
    const summary = `\n// File has ${totalLines.toLocaleString()} total lines\n`;
    const omission =
      `\n${"=".repeat(60)}\n` +
      `// [... ${omitted.toLocaleString()} lines omitted ...]\n` +
      `${"=".repeat(60)}\n`;

    return head + summary + omission + tail;
  }

  /**
   * Trim search results.
   */
  private trimSearchResults(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];

    // Count matches
    const matchCount = lines.filter(
      (line) => line.includes(":") && !line.startsWith("Binary file")
    ).length;

    result.push(`[Found ${matchCount.toLocaleString()} matches]`);

    // Show first 30 matches
    let shownMatches = 0;
    for (const line of lines) {
      if (line.includes(":") && !line.startsWith("Binary file")) {
        result.push(line);
        if (++shownMatches >= 30) break;
      } else if (result.length > 0) {
        result.push(line);
      }
    }

    if (matchCount > shownMatches) {
      result.push(`\n... and ${matchCount - shownMatches} more matches`);
    }

    return result.join("\n");
  }

  /**
   * Trim database dump.
   */
  private trimDatabaseDump(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];

    // Count rows
    let rowCount = 0;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.includes("|") && !line.startsWith("|")) {
        rowCount++;
        if (dataLines.length < 10) {
          dataLines.push(line);
        }
      } else {
        result.push(line);
        if (result.length >= 20) break; // Keep header
      }
    }

    result.push(`\n[Total rows: ${rowCount.toLocaleString()}]`);
    result.push("\n[Sample rows:]\n");
    result.push(...dataLines);

    return result.join("\n");
  }

  /**
   * Generic content trimming (head + tail).
   */
  private trimGenericContent(content: string): string {
    const headSize = 5000;
    const tailSize = 2000;

    if (content.length <= headSize + tailSize) {
      return content;
    }

    const head = content.slice(0, headSize);
    const tail = content.slice(-tailSize);
    const omitted = content.length - headSize - tailSize;

    return `${head}\n\n[... ${omitted.toLocaleString()} characters omitted ...]\n\n${tail}`;
  }

  /**
   * Format result to string.
   */
  private formatResult(result: unknown): string {
    if (result === null || result === undefined) {
      return String(result);
    }

    if (typeof result === "string") {
      return result;
    }

    if (typeof result === "object") {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }

    return String(result);
  }

  /**
   * Save content to file with timestamp.
   */
  private saveToFile(content: string, prefix?: string): string {
    const fs = require("node:fs");
    const path = require("node:path");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `${prefix ?? "output"}-${timestamp}.log`;
    const filepath = path.join(this.config.logDir, filename);

    try {
      fs.mkdirSync(this.config.logDir, { recursive: true });
      fs.writeFileSync(filepath, content, "utf-8");
      return filepath;
    } catch (error) {
      console.warn(`Failed to save trimmed output to file: ${error}`);
      return "";
    }
  }
}

// Export types and class
export type { TrimmedOutput, TrimmerConfig };
export { OutputTrimmer };
