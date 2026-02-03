// Node.js-specific utility functions
// This file should only be imported in Node.js environments (server)
import path from "node:path";
// Re-export all browser-compatible utilities
export * from "./utils.js";
/**
 * Normalize a workspace path to an absolute path (Node.js version)
 * @param inputPath - Input path (can be relative or absolute)
 * @param defaultPath - Default path to use if inputPath is empty
 * @returns Normalized absolute path
 */
export function normalizeWorkspacePath(inputPath, defaultPath) {
    return path.resolve(inputPath || defaultPath);
}
/**
 * Get a workspace key for indexing (handles case-insensitivity on Windows)
 * Node.js version with proper platform detection
 * @param workspacePath - Workspace path
 * @returns Normalized key for indexing
 */
export function getWorkspaceKey(workspacePath) {
    const normalized = workspacePath.replace(/[\\/]+$/, "");
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
/**
 * Extract a workspace name from its path (Node.js version)
 * @param workspacePath - Workspace path
 * @param fallbackIndex - Index to use for fallback name
 * @returns Workspace name
 */
export function getWorkspaceName(workspacePath, fallbackIndex) {
    const trimmed = workspacePath.replace(/[\\/]+$/, "");
    const base = path.basename(trimmed);
    return base || `Project ${fallbackIndex}`;
}
