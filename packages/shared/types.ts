// Core domain types shared across the entire application

export type FileEntryType = "file" | "dir";

// Workspace represents a project root directory
export interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

// Deck represents a workspace view with terminals and editors
export interface Deck {
  id: string;
  name: string;
  root: string;
  workspaceId: string;
  createdAt: string;
}

// File system entry (file or directory)
export interface FileSystemEntry {
  name: string;
  path: string;
  type: FileEntryType;
}

// Extended file tree node with UI state
export interface FileTreeNode extends FileSystemEntry {
  expanded: boolean;
  loading: boolean;
  children?: FileTreeNode[];
}

// Editor file representation
export interface EditorFile {
  id: string;
  name: string;
  path: string;
  language: string;
  contents: string;
  dirty: boolean;
}

// Terminal session
export interface TerminalSession {
  id: string;
  title: string;
  createdAt?: string;
  // Terminal organization properties
  groupId?: string;
  color?: string;
  tags?: string[];
  parentId?: string; // For hierarchical grouping
  shell?: string;
  type?: "default" | "claude" | "codex";
}

// Terminal group for organizing terminals
export interface TerminalGroup {
  id: string;
  name: string;
  color: string;
  terminalIds: string[];
  collapsed?: boolean;
}

// UI State types

export interface WorkspaceState {
  files: EditorFile[];
  activeFileId: string | null;
  tree: FileTreeNode[];
  treeLoading: boolean;
  treeError: string | null;
}

export interface DeckState {
  terminals: TerminalSession[];
  terminalsLoaded: boolean;
}

// API Response types

export interface ApiError {
  error: string;
}

export interface ApiConfig {
  defaultRoot: string;
}

export interface ApiFileResponse {
  path: string;
  contents: string;
}

export interface ApiFileSaveResponse {
  path: string;
  saved: boolean;
}

export interface ApiTerminalCreateResponse {
  id: string;
  title: string;
}

// API Request types

export interface CreateWorkspaceRequest {
  path: string;
  name?: string;
}

export interface CreateDeckRequest {
  name?: string;
  workspaceId: string;
}

export interface CreateTerminalRequest {
  deckId: string;
  title?: string;
}

export interface SaveFileRequest {
  workspaceId: string;
  path: string;
  contents: string;
}

export interface GetFileRequest {
  workspaceId: string;
  path: string;
}

export interface GetFilesRequest {
  workspaceId: string;
  path?: string;
}

export interface GetPreviewRequest {
  path: string;
  subpath?: string;
}

// Git types

export type GitFileStatusCode =
  | "modified"
  | "staged"
  | "untracked"
  | "deleted"
  | "renamed"
  | "conflicted";

export interface GitFileStatus {
  path: string;
  status: GitFileStatusCode;
  staged: boolean;
}

export interface GitStatus {
  isGitRepo: boolean;
  branch: string;
  files: GitFileStatus[];
}

export interface GitDiff {
  original: string;
  modified: string;
  path: string;
}

// Multi-repo support types

export interface GitRepoInfo {
  path: string; // Relative path from workspace root (empty string for root repo)
  name: string; // Display name (folder name or 'root')
  branch: string;
  fileCount: number; // Number of changed files
}

export interface GitFileStatusWithRepo extends GitFileStatus {
  repoPath: string; // Which repo this file belongs to
}

export interface MultiRepoGitStatus {
  repos: GitRepoInfo[];
  files: GitFileStatusWithRepo[];
}

// Agent types
export type AgentId = "claude" | "codex" | "copilot" | "cursor" | "kimi";

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

export interface MCPConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface SkillConfig {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}
