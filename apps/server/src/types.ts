// Re-export shared types
export type { Deck, Workspace } from "@side-ide/shared/types";

// Import WebSocket type explicitly from 'ws' package to avoid conflicts
import type { WebSocket as WebSocketType } from "ws";

export type TerminalSession = {
  id: string;
  deckId: string;
  title: string;
  command: string | null;
  createdAt: string;
  term: import("node-pty").IPty;
  sockets: Set<WebSocketType>;
  buffer: string;
  lastActive: number;
  dispose: import("node-pty").IDisposable | null;
};

export type HttpError = Error & { status?: number };
