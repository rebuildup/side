// Shared utility functions (browser-compatible)
/**
 * Get a workspace key for indexing (handles case-insensitivity on Windows)
 * Note: For Node.js environments, use utils-node.ts for proper platform detection.
 * This browser version has limited platform detection capabilities.
 * @param workspacePath - Workspace path
 * @returns Normalized key for indexing
 */
export function getWorkspaceKey(workspacePath) {
    const normalized = workspacePath.replace(/[\\/]+$/, "");
    // In browser, we can't reliably detect platform, so we normalize to lowercase as fallback
    const platform = typeof process !== "undefined" ? process.platform : "unknown";
    return platform === "win32" ? normalized.toLowerCase() : normalized;
}
/**
 * Extract a workspace name from its path
 * @param workspacePath - Workspace path
 * @param fallbackIndex - Index to use for fallback name
 * @returns Workspace name
 */
export function getWorkspaceName(workspacePath, fallbackIndex) {
    const trimmed = workspacePath.replace(/[\\/]+$/, "");
    // Browser-compatible basename
    const parts = trimmed.split(/[\\/]/);
    const base = parts[parts.length - 1] || "";
    return base || `Project ${fallbackIndex}`;
}
/**
 * Normalize a workspace path to an absolute path
 * Note: For Node.js usage, import from utils-node.ts for proper path resolution using Node.js path module.
 * @param inputPath - Input path (can be relative or absolute)
 * @param defaultPath - Default path to use if inputPath is empty
 * @returns Normalized absolute path
 */
export function normalizeWorkspacePath(inputPath, defaultPath) {
    // This is a simplified version for browsers
    // Server code should use the Node.js version from utils-node.ts
    return inputPath || defaultPath;
}
/**
 * Get file extension from a path
 * Handles query strings and URLs correctly
 * @param filePath - File path (may contain query strings or URLs)
 * @returns File extension (without dot) or empty string
 */
export function getFileExtension(filePath) {
    const cleanPath = filePath.split(/[?#]/)[0];
    const lastSlash = cleanPath.lastIndexOf("/");
    const lastDot = cleanPath.lastIndexOf(".");
    if (lastDot === -1 || lastDot <= lastSlash || lastDot === cleanPath.length - 1)
        return "";
    return cleanPath.slice(lastDot + 1).toLowerCase();
}
/**
 * Map file extension to Monaco editor language
 * @param filePath - File path
 * @returns Monaco language identifier
 */
export function getLanguageFromPath(filePath) {
    const ext = getFileExtension(filePath);
    const languageMap = {
        js: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        json: "json",
        html: "html",
        css: "css",
        scss: "scss",
        sass: "sass",
        less: "less",
        md: "markdown",
        py: "python",
        rb: "ruby",
        go: "go",
        rs: "rust",
        java: "java",
        c: "c",
        cpp: "cpp",
        cc: "cpp",
        cxx: "cpp",
        h: "c",
        hpp: "cpp",
        sh: "shell",
        bash: "shell",
        zsh: "shell",
        fish: "shell",
        xml: "xml",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        sql: "sql",
        graphql: "graphql",
        vue: "vue",
        svelte: "svelte",
        php: "php",
        r: "r",
        swift: "swift",
        kt: "kotlin",
        dart: "dart",
        lua: "lua",
        dockerfile: "dockerfile",
        // Additional extensions
        tsv: "plaintext",
        csv: "plaintext",
        ini: "ini",
        cfg: "ini",
        cmake: "cmake",
        nim: "nim",
        ex: "elixir",
        exs: "elixir",
        erl: "erlang",
        hrl: "erlang",
        fs: "fsharp",
        fsi: "fsharp",
        fsx: "fsharp",
        cs: "csharp",
        vb: "vb",
    };
    return languageMap[ext] || "plaintext";
}
/**
 * Normalize path separators to forward slashes
 * @param inputPath - Input path
 * @returns Path with forward slashes
 */
export function normalizePathSeparators(inputPath) {
    return inputPath.replace(/\\/g, "/");
}
/**
 * Check if a file or directory name is hidden (starts with .)
 * Note: This is a simple check for Unix-style hidden files (names starting with dot).
 * On Windows, files marked as hidden via attributes won't be detected by this function.
 * @param name - File or directory name (not full path)
 * @returns True if the name indicates a hidden file/directory
 */
export function isHidden(name) {
    return name.startsWith(".");
}
/**
 * Get error message from unknown error type
 * @param error - Error object
 * @returns Error message string
 */
export function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
/**
 * HTTP Error class with status code
 */
export class HttpError extends Error {
    status;
    /**
     * Create an HTTP error with status code
     * @param message - Error message
     * @param status - HTTP status code
     */
    constructor(message, status) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}
/**
 * Create an HTTP error with status code (legacy function for backwards compatibility)
 * @param message - Error message
 * @param status - HTTP status code
 * @returns HttpError instance
 * @deprecated Use HttpError class directly
 */
export function createHttpError(message, status) {
    return new HttpError(message, status);
}
/**
 * Truncate string to max length with ellipsis
 * @param str - Input string
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncate(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return `${str.slice(0, maxLength - 3)}...`;
}
/**
 * Generate a short ID from a UUID (first 8 characters)
 * @param uuid - Full UUID
 * @returns Short ID
 * @throws Error if uuid is invalid (less than 8 characters)
 */
export function shortId(uuid) {
    if (!uuid || typeof uuid !== "string" || uuid.length < 8) {
        throw new Error("Invalid UUID: must be at least 8 characters");
    }
    return uuid.slice(0, 8);
}
/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return "Invalid size";
    }
    if (bytes === 0)
        return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
/**
 * Sort file system entries (directories first, then alphabetically)
 * @param entries - Array of file system entries
 * @returns Sorted array (new array, input is not mutated)
 */
export function sortFileEntries(entries) {
    return [...entries].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === "dir" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}
