// Re-export shared types from @side-ide/shared
export type {
  ApiConfig,
  ApiError,
  ApiFileResponse,
  ApiFileSaveResponse,
  ApiTerminalCreateResponse,
  CreateDeckRequest,
  CreateTerminalRequest,
  CreateWorkspaceRequest,
  Deck,
  DeckState,
  EditorFile,
  FileEntryType,
  FileSystemEntry,
  FileTreeNode,
  GetFileRequest,
  GetFilesRequest,
  GetPreviewRequest,
  GitDiff,
  GitFileStatus,
  GitFileStatusCode,
  GitFileStatusWithRepo,
  GitRepoInfo,
  GitStatus,
  MultiRepoGitStatus,
  SaveFileRequest,
  TerminalGroup,
  TerminalSession,
  Workspace,
  WorkspaceState,
} from "@side-ide/shared/types";

// Context Manager API types
export type {
  CompactResponse,
  ContextManagerStatus,
  CreateSessionRequest,
  SnapshotListResponse,
  SnapshotResponse,
} from "./types/context-manager";

export type AppView = "workspace" | "terminal";
export type WorkspaceMode = "list" | "editor";
export type ThemeMode = "light" | "dark";
export type SidebarPanel = "files" | "git" | "ai" | "settings";

export interface UrlState {
  view: AppView;
  workspaceId: string | null;
  deckId: string | null;
  workspaceMode: WorkspaceMode;
}

export interface DeckListItem {
  id: string;
  name: string;
  path: string;
}

// Agent types
export type AgentId = "claude" | "codex" | "copilot" | "cursor" | "kimi";

export interface Agent {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export interface AgentConfig {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  status?: "active" | "inactive" | "error";
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  status?: "active" | "inactive" | "error";
}
