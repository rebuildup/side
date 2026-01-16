export type FileEntryType = 'file' | 'dir';

export interface Deck {
  id: string;
  name: string;
  root: string;
  createdAt: string;
}

export interface FileSystemEntry {
  name: string;
  path: string;
  type: FileEntryType;
}

export interface FileTreeNode extends FileSystemEntry {
  expanded: boolean;
  loading: boolean;
  children?: FileTreeNode[];
}

export interface EditorFile {
  id: string;
  name: string;
  path: string;
  language: string;
  contents: string;
  dirty: boolean;
}

export interface TerminalSession {
  id: string;
  title: string;
}

export interface DeckState {
  files: EditorFile[];
  activeFileId: string | null;
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  tree: FileTreeNode[];
  treeLoading: boolean;
  treeError: string | null;
}
