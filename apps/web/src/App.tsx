import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { DeckList } from './components/DeckList';
import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { SideNav } from './components/SideNav';
import { TerminalPane } from './components/TerminalPane';
import { WorkspaceList } from './components/WorkspaceList';
import {
  createDeck as apiCreateDeck,
  createTerminal as apiCreateTerminal,
  createWorkspace as apiCreateWorkspace,
  getConfig,
  getWsBase,
  listDecks,
  listFiles,
  listWorkspaces,
  listTerminals,
  previewFiles,
  readFile,
  writeFile
} from './api';
import type {
  Deck,
  DeckState,
  EditorFile,
  FileSystemEntry,
  FileTreeNode,
  Workspace,
  WorkspaceState
} from './types';

type AppView = 'workspace' | 'terminal';
type WorkspaceMode = 'list' | 'editor';
type ThemeMode = 'light' | 'dark';
type UrlState = {
  view: AppView;
  workspaceId: string | null;
  deckId: string | null;
  workspaceMode: WorkspaceMode;
};

const DEFAULT_ROOT_FALLBACK = import.meta.env.VITE_DEFAULT_ROOT || '';
const SAVED_MESSAGE = '\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  ps1: 'powershell',
  py: 'python',
  go: 'go',
  rs: 'rust'
};

const createEmptyWorkspaceState = (): WorkspaceState => ({
  files: [],
  activeFileId: null,
  tree: [],
  treeLoading: false,
  treeError: null
});

const createEmptyDeckState = (): DeckState => ({
  terminals: [],
  activeTerminalId: null,
  terminalsLoaded: false
});

const toTreeNodes = (entries: FileSystemEntry[]): FileTreeNode[] =>
  entries.map((entry) => ({
    ...entry,
    expanded: false,
    loading: false,
    children: entry.type === 'dir' ? [] : undefined
  }));

const getLanguageFromPath = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return LANGUAGE_BY_EXTENSION[extension] || 'plaintext';
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const normalizeWorkspacePath = (value: string): string =>
  value
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLowerCase();

const getPathSeparator = (value: string): string =>
  value.includes('\\') ? '\\' : '/';

const joinPath = (base: string, next: string): string => {
  const separator = getPathSeparator(base);
  const trimmed = base.replace(/[\\/]+$/, '');
  return trimmed ? `${trimmed}${separator}${next}` : next;
};

const getParentPath = (value: string): string => {
  const trimmed = value.replace(/[\\/]+$/, '');
  if (!trimmed) return value;
  if (/^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }
  if (trimmed === '/') {
    return '/';
  }
  const lastSlash = Math.max(
    trimmed.lastIndexOf('/'),
    trimmed.lastIndexOf('\\')
  );
  if (trimmed.startsWith('/') && lastSlash === 0) {
    return '/';
  }
  if (lastSlash <= 0) {
    return trimmed;
  }
  const parent = trimmed.slice(0, lastSlash);
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}\\`;
  }
  return parent;
};

const parseUrlState = (): UrlState => {
  if (typeof window === 'undefined') {
    return {
      view: 'terminal',
      workspaceId: null,
      deckId: null,
      workspaceMode: 'list'
    };
  }
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const modeParam = params.get('mode');
  return {
    view: viewParam === 'workspace' ? 'workspace' : 'terminal',
    workspaceId: params.get('workspace'),
    deckId: params.get('deck'),
    workspaceMode: modeParam === 'editor' ? 'editor' : 'list'
  };
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const stored = window.localStorage.getItem('deck-theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

export default function App() {
  const initialUrlState = parseUrlState();
  const [view, setView] = useState<AppView>(initialUrlState.view);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    initialUrlState.workspaceMode
  );
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [editorWorkspaceId, setEditorWorkspaceId] = useState<string | null>(
    initialUrlState.workspaceId ?? null
  );
  const [defaultRoot, setDefaultRoot] = useState(DEFAULT_ROOT_FALLBACK);
  const [workspaceStates, setWorkspaceStates] = useState<
    Record<string, WorkspaceState>
  >({});
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(
    initialUrlState.deckId ?? null
  );
  const [deckStates, setDeckStates] = useState<Record<string, DeckState>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [savingFileId, setSavingFileId] = useState<string | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspacePathDraft, setWorkspacePathDraft] = useState('');
  const [previewTree, setPreviewTree] = useState<FileTreeNode[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [deckWorkspaceId, setDeckWorkspaceId] = useState('');
  const [deckNameDraft, setDeckNameDraft] = useState('');
  const [isDeckDrawerOpen, setIsDeckDrawerOpen] = useState(false);

  const defaultWorkspaceState = useMemo(
    () => createEmptyWorkspaceState(),
    []
  );
  const defaultDeckState = useMemo(() => createEmptyDeckState(), []);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === editorWorkspaceId) || null;
  const activeWorkspaceState = editorWorkspaceId
    ? workspaceStates[editorWorkspaceId] || defaultWorkspaceState
    : defaultWorkspaceState;
  const activeDeckState = activeDeckId
    ? deckStates[activeDeckId] || defaultDeckState
    : defaultDeckState;
  const wsBase = getWsBase();
  const previewRoot = workspacePathDraft.trim() || defaultRoot;
  const canPreviewBack = useMemo(() => {
    if (!previewRoot) return false;
    return getParentPath(previewRoot) !== previewRoot;
  }, [previewRoot]);

  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );
  const deckListItems = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    path: workspaceById.get(deck.workspaceId)?.path || deck.root
  }));

  const openDeckDrawer = useCallback(() => {
    setIsDeckDrawerOpen(true);
  }, []);

  const closeDeckDrawer = useCallback(() => {
    setIsDeckDrawerOpen(false);
  }, []);

  const updateWorkspaceState = useCallback(
    (workspaceId: string, updater: (state: WorkspaceState) => WorkspaceState) => {
      setWorkspaceStates((prev) => {
        const current = prev[workspaceId] || createEmptyWorkspaceState();
        return { ...prev, [workspaceId]: updater(current) };
      });
    },
    []
  );

  const updateDeckState = useCallback(
    (deckId: string, updater: (state: DeckState) => DeckState) => {
      setDeckStates((prev) => {
        const current = prev[deckId] || createEmptyDeckState();
        return { ...prev, [deckId]: updater(current) };
      });
    },
    []
  );

  useEffect(() => {
    let alive = true;
    getConfig()
      .then((config) => {
        if (!alive) return;
        if (config?.defaultRoot) {
          setDefaultRoot(config.defaultRoot);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('deck-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseUrlState();
      setView(next.view);
      setEditorWorkspaceId(next.workspaceId ?? null);
      setActiveDeckId(next.deckId ?? null);
      setWorkspaceMode(next.workspaceMode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', view);
    if (view === 'workspace' && editorWorkspaceId) {
      params.set('workspace', editorWorkspaceId);
    }
    if (activeDeckId) {
      params.set('deck', activeDeckId);
    }
    if (view === 'workspace' && workspaceMode === 'editor' && editorWorkspaceId) {
      params.set('mode', 'editor');
    }
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [view, editorWorkspaceId, activeDeckId, workspaceMode]);

  useEffect(() => {
    let alive = true;
    listWorkspaces()
      .then((data) => {
        if (!alive) return;
        setWorkspaces(data);
        setEditorWorkspaceId((prev) => {
          if (prev && data.some((workspace) => workspace.id === prev)) {
            return prev;
          }
          return null;
        });
        setWorkspaceStates((prev) => {
          const next = { ...prev };
          data.forEach((workspace) => {
            if (!next[workspace.id]) {
              next[workspace.id] = createEmptyWorkspaceState();
            }
          });
          return next;
        });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStatusMessage(
          `\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });

    listDecks()
      .then((data) => {
        if (!alive) return;
        setDecks(data);
        setDeckStates((prev) => {
          const next = { ...prev };
          data.forEach((deck) => {
            if (!next[deck.id]) {
              next[deck.id] = createEmptyDeckState();
            }
          });
          return next;
        });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStatusMessage(
          `\u30c7\u30c3\u30ad\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (statusMessage !== SAVED_MESSAGE) return;
    const timer = setTimeout(() => setStatusMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!activeDeckId) return;
    const current = deckStates[activeDeckId];
    if (current?.terminalsLoaded) return;
    listTerminals(activeDeckId)
      .then((sessions) => {
        updateDeckState(activeDeckId, (state) => {
          const nextActive =
            state.activeTerminalId &&
            sessions.some((item) => item.id === state.activeTerminalId)
              ? state.activeTerminalId
              : sessions[0]?.id ?? null;
          return {
            ...state,
            terminals: sessions,
            activeTerminalId: nextActive,
            terminalsLoaded: true
          };
        });
      })
      .catch((error: unknown) => {
        updateDeckState(activeDeckId, (state) => ({
          ...state,
          terminalsLoaded: true
        }));
        setStatusMessage(
          `\u30bf\u30fc\u30df\u30ca\u30eb\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });
  }, [activeDeckId, deckStates, updateDeckState]);

  useEffect(() => {
    if (workspaceMode === 'editor' && !editorWorkspaceId) {
      setWorkspaceMode('list');
    }
  }, [workspaceMode, editorWorkspaceId]);

  useEffect(() => {
    if (activeDeckId && decks.some((deck) => deck.id === activeDeckId)) {
      return;
    }
    setActiveDeckId(decks[0]?.id ?? null);
  }, [decks, activeDeckId]);

  useEffect(() => {
    if (!editorWorkspaceId) return;
    const current = workspaceStates[editorWorkspaceId];
    if (current?.tree?.length || current?.treeLoading) return;
    updateWorkspaceState(editorWorkspaceId, (state) => ({
      ...state,
      treeLoading: true,
      treeError: null
    }));
    listFiles(editorWorkspaceId, '')
      .then((entries) => {
        updateWorkspaceState(editorWorkspaceId, (state) => ({
          ...state,
          tree: toTreeNodes(entries),
          treeLoading: false
        }));
      })
      .catch((error: unknown) => {
        updateWorkspaceState(editorWorkspaceId, (state) => ({
          ...state,
          treeLoading: false,
          treeError: getErrorMessage(error)
        }));
      });
  }, [editorWorkspaceId, updateWorkspaceState, workspaceStates]);

  useEffect(() => {
    if (!isWorkspaceModalOpen) {
      setPreviewTree([]);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }
    let alive = true;
    setPreviewLoading(true);
    setPreviewError(null);
    previewFiles(previewRoot, '')
      .then((entries) => {
        if (!alive) return;
        setPreviewTree(toTreeNodes(entries));
        setPreviewLoading(false);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setPreviewError(getErrorMessage(error));
        setPreviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isWorkspaceModalOpen, previewRoot]);

  useEffect(() => {
    if (!isWorkspaceModalOpen) return;
    if (workspacePathDraft.trim()) return;
    if (defaultRoot) {
      setWorkspacePathDraft(defaultRoot);
    }
  }, [defaultRoot, isWorkspaceModalOpen, workspacePathDraft]);

  const handleCreateWorkspace = async (path: string) => {
    const trimmedPath = path.trim();
    const resolvedPath = trimmedPath || defaultRoot;
    if (!resolvedPath) {
      setStatusMessage(
        '\u30d1\u30b9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
      );
      return null;
    }
    const normalized = normalizeWorkspacePath(resolvedPath);
    const exists = workspaces.some(
      (workspace) => normalizeWorkspacePath(workspace.path) === normalized
    );
    if (exists) {
      setStatusMessage(
        '\u540c\u3058\u30d1\u30b9\u306e\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u306f\u8ffd\u52a0\u3067\u304d\u307e\u305b\u3093\u3002'
      );
      return null;
    }
    try {
      const workspace = await apiCreateWorkspace(resolvedPath);
      setWorkspaces((prev) => [...prev, workspace]);
      setEditorWorkspaceId(workspace.id);
      setWorkspaceStates((prev) => ({
        ...prev,
        [workspace.id]: createEmptyWorkspaceState()
      }));
      return workspace;
    } catch (error: unknown) {
      setStatusMessage(
        `\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u8ffd\u52a0\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
      );
      return null;
    }
  };

  const handleOpenDeckModal = () => {
    if (workspaces.length === 0) {
      setStatusMessage(
        '\u30c7\u30c3\u30ad\u3092\u4f5c\u6210\u3059\u308b\u524d\u306b\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
      );
      return;
    }
    setDeckWorkspaceId(workspaces[0].id);
    setDeckNameDraft('');
    setIsDeckModalOpen(true);
  };

  const handleSubmitDeck = async (event: FormEvent) => {
    event.preventDefault();
    if (!deckWorkspaceId) {
      setStatusMessage(
        '\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
      );
      return;
    }
    const name = deckNameDraft.trim();
    try {
      const deck = await apiCreateDeck(name, deckWorkspaceId);
      setDecks((prev) => [...prev, deck]);
      setActiveDeckId(deck.id);
      setDeckStates((prev) => ({
        ...prev,
        [deck.id]: createEmptyDeckState()
      }));
      setIsDeckModalOpen(false);
    } catch (error: unknown) {
      setStatusMessage(
        `\u30c7\u30c3\u30ad\u306e\u4f5c\u6210\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${getErrorMessage(error)}`
      );
    }
  };

  const handleRefreshTree = () => {
    if (!editorWorkspaceId) return;
    updateWorkspaceState(editorWorkspaceId, (state) => ({
      ...state,
      treeLoading: true,
      treeError: null
    }));
    listFiles(editorWorkspaceId, '')
      .then((entries) => {
        updateWorkspaceState(editorWorkspaceId, (state) => ({
          ...state,
          tree: toTreeNodes(entries),
          treeLoading: false
        }));
      })
      .catch((error: unknown) => {
        updateWorkspaceState(editorWorkspaceId, (state) => ({
          ...state,
          treeLoading: false,
          treeError: getErrorMessage(error)
        }));
      });
  };

  const updateTreeNode = (
    nodes: FileTreeNode[],
    targetPath: string,
    updater: (node: FileTreeNode) => FileTreeNode
  ): FileTreeNode[] =>
    nodes.map((node) => {
      if (node.path === targetPath) {
        return updater(node);
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeNode(node.children, targetPath, updater)
        };
      }
      return node;
    });

  const handlePreviewRefresh = () => {
    if (!isWorkspaceModalOpen) return;
    setPreviewLoading(true);
    setPreviewError(null);
    previewFiles(previewRoot, '')
      .then((entries) => {
        setPreviewTree(toTreeNodes(entries));
        setPreviewLoading(false);
      })
      .catch((error: unknown) => {
        setPreviewError(getErrorMessage(error));
        setPreviewLoading(false);
      });
  };

  const handlePreviewToggleDir = (node: FileTreeNode) => {
    if (node.type !== 'dir') return;
    const nextPath = joinPath(previewRoot, node.name);
    setWorkspacePathDraft(nextPath);
  };

  const handlePreviewBack = () => {
    if (!previewRoot) return;
    const parent = getParentPath(previewRoot);
    if (parent && parent !== previewRoot) {
      setWorkspacePathDraft(parent);
    }
  };

  const handleToggleDir = (node: FileTreeNode) => {
    if (!editorWorkspaceId || node.type !== 'dir') return;
    if (node.expanded) {
      updateWorkspaceState(editorWorkspaceId, (state) => ({
        ...state,
        tree: updateTreeNode(state.tree, node.path, (item) => ({
          ...item,
          expanded: false
        }))
      }));
      return;
    }
    if (node.children && node.children.length > 0) {
      updateWorkspaceState(editorWorkspaceId, (state) => ({
        ...state,
        tree: updateTreeNode(state.tree, node.path, (item) => ({
          ...item,
          expanded: true
        }))
      }));
      return;
    }

    updateWorkspaceState(editorWorkspaceId, (state) => ({
      ...state,
      tree: updateTreeNode(state.tree, node.path, (item) => ({
        ...item,
        loading: true
      }))
    }));
    listFiles(editorWorkspaceId, node.path)
      .then((entries) => {
        updateWorkspaceState(editorWorkspaceId, (state) => ({
          ...state,
          tree: updateTreeNode(state.tree, node.path, (item) => ({
            ...item,
            expanded: true,
            loading: false,
            children: toTreeNodes(entries)
          }))
        }));
      })
      .catch((error: unknown) => {
        updateWorkspaceState(editorWorkspaceId, (state) => ({
          ...state,
          treeError: getErrorMessage(error),
          tree: updateTreeNode(state.tree, node.path, (item) => ({
            ...item,
            loading: false
          }))
        }));
      });
  };

  const handleOpenFile = (entry: FileTreeNode) => {
    if (!editorWorkspaceId || entry.type !== 'file') return;
    const existing = activeWorkspaceState.files.find(
      (file) => file.path === entry.path
    );
    if (existing) {
      updateWorkspaceState(editorWorkspaceId, (state) => ({
        ...state,
        activeFileId: existing.id
      }));
      return;
    }
    readFile(editorWorkspaceId, entry.path)
      .then((data) => {
        const file: EditorFile = {
          id: crypto.randomUUID(),
          name: entry.name,
          path: entry.path,
          language: getLanguageFromPath(entry.path),
          contents: data.contents,
          dirty: false
        };
        updateWorkspaceState(editorWorkspaceId, (state) => ({
          ...state,
          files: [...state.files, file],
          activeFileId: file.id
        }));
      })
      .catch((error: unknown) => {
        setStatusMessage(
          `\u30d5\u30a1\u30a4\u30eb\u3092\u958b\u3051\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });
  };

  const handleFileChange = (fileId: string, contents: string) => {
    if (!editorWorkspaceId) return;
    updateWorkspaceState(editorWorkspaceId, (state) => ({
      ...state,
      files: state.files.map((file) =>
        file.id === fileId ? { ...file, contents, dirty: true } : file
      )
    }));
  };

  const handleSaveFile = async (fileId: string) => {
    if (!editorWorkspaceId) return;
    const file = activeWorkspaceState.files.find((item) => item.id === fileId);
    if (!file) return;
    setSavingFileId(fileId);
    try {
      await writeFile(editorWorkspaceId, file.path, file.contents);
      updateWorkspaceState(editorWorkspaceId, (state) => ({
        ...state,
        files: state.files.map((item) =>
          item.id === fileId ? { ...item, dirty: false } : item
        )
      }));
      setStatusMessage(SAVED_MESSAGE);
    } catch (error: unknown) {
      setStatusMessage(
        `\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${getErrorMessage(error)}`
      );
    } finally {
      setSavingFileId(null);
    }
  };

  const handleCreateTerminal = async () => {
    if (!activeDeckId) {
      setStatusMessage(
        '\u30c7\u30c3\u30ad\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
      );
      return;
    }
    try {
      const index = activeDeckState.terminals.length + 1;
      const title = `\u30bf\u30fc\u30df\u30ca\u30eb ${index}`;
      const session = await apiCreateTerminal(activeDeckId, title);
      updateDeckState(activeDeckId, (state) => {
        const terminal = {
          id: session.id,
          title: session.title || title
        };
        return {
          ...state,
          terminals: [...state.terminals, terminal],
          activeTerminalId: terminal.id,
          terminalsLoaded: true
        };
      });
    } catch (error: unknown) {
      setStatusMessage(
        `\u30bf\u30fc\u30df\u30ca\u30eb\u3092\u8d77\u52d5\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
      );
    }
  };

  const handleSelectTerminal = (terminalId: string) => {
    if (!activeDeckId) return;
    updateDeckState(activeDeckId, (state) => ({
      ...state,
      activeTerminalId: terminalId
    }));
  };

  const handleSelectDeck = (deckId: string) => {
    setActiveDeckId(deckId);
  };

  const handleToggleDeckList = () => {
    if (isDeckDrawerOpen) {
      closeDeckDrawer();
    } else {
      openDeckDrawer();
    }
  };

  const handleDeckHandleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggleDeckList();
    }
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    setEditorWorkspaceId(workspaceId);
    setWorkspaceMode('editor');
  };

  const handleCloseWorkspaceEditor = () => {
    setWorkspaceMode('list');
  };

  const handleOpenWorkspaceModal = () => {
    setWorkspacePathDraft(defaultRoot || '');
    setIsWorkspaceModalOpen(true);
  };

  const handleSubmitWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    const created = await handleCreateWorkspace(workspacePathDraft);
    if (created) {
      setWorkspacePathDraft('');
      setIsWorkspaceModalOpen(false);
    }
  };

  const isWorkspaceEditorOpen =
    workspaceMode === 'editor' && Boolean(editorWorkspaceId);

  const workspaceModal = isWorkspaceModalOpen ? (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmitWorkspace}>
        <div className="modal-title">
          {'\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8ffd\u52a0'}
        </div>
        <label className="field">
          <span>{'\u30d1\u30b9'}</span>
          <input
            type="text"
            value={workspacePathDraft}
            placeholder={defaultRoot || ''}
            onChange={(event) => setWorkspacePathDraft(event.target.value)}
          />
        </label>
        <div className="modal-explorer">
          <FileTree
            root={previewRoot}
            entries={previewTree}
            loading={previewLoading}
            error={previewError}
            mode="navigator"
            canBack={canPreviewBack}
            onBack={handlePreviewBack}
            onToggleDir={handlePreviewToggleDir}
            onOpenFile={() => undefined}
            onRefresh={handlePreviewRefresh}
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsWorkspaceModalOpen(false)}
          >
            {'\u30ad\u30e3\u30f3\u30bb\u30eb'}
          </button>
          <button type="submit" className="primary-button">
            {'\u8ffd\u52a0'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const workspaceEditor = isWorkspaceEditorOpen ? (
    <div className="workspace-editor-overlay">
      <div className="workspace-editor-header">
        <button
          type="button"
          className="ghost-button"
          onClick={handleCloseWorkspaceEditor}
        >
          {'\u4e00\u89a7\u306b\u623b\u308b'}
        </button>
        <div className="workspace-meta">
          {activeWorkspace ? (
            <span className="workspace-path">{activeWorkspace.path}</span>
          ) : null}
        </div>
      </div>
      <div className="workspace-editor-grid">
        <FileTree
          root={activeWorkspace?.path || defaultRoot || ''}
          entries={activeWorkspaceState.tree}
          loading={activeWorkspaceState.treeLoading}
          error={activeWorkspaceState.treeError}
          onToggleDir={handleToggleDir}
          onOpenFile={handleOpenFile}
          onRefresh={handleRefreshTree}
        />
        <EditorPane
          files={activeWorkspaceState.files}
          activeFileId={activeWorkspaceState.activeFileId}
          onSelectFile={(fileId) => {
            if (!editorWorkspaceId) return;
            updateWorkspaceState(editorWorkspaceId, (state) => ({
              ...state,
              activeFileId: fileId
            }));
          }}
          onChangeFile={handleFileChange}
          onSaveFile={handleSaveFile}
          savingFileId={savingFileId}
          theme={theme}
        />
      </div>
    </div>
  ) : null;

  const workspaceView = (
    <div className="workspace-view">
      <div className="workspace-start">
        <button
          type="button"
          className="primary-button"
          onClick={handleOpenWorkspaceModal}
        >
          {'\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8ffd\u52a0'}
        </button>
        <WorkspaceList
          workspaces={workspaces}
          selectedWorkspaceId={editorWorkspaceId}
          onSelect={handleSelectWorkspace}
        />
      </div>
      {workspaceEditor}
      {workspaceModal}
    </div>
  );

  const deckModal = isDeckModalOpen ? (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmitDeck}>
        <div className="modal-title">{'\u30c7\u30c3\u30ad\u4f5c\u6210'}</div>
        <label className="field">
          <span>{'\u30c7\u30c3\u30ad\u540d (\u4efb\u610f)'}</span>
          <input
            type="text"
            value={deckNameDraft}
            placeholder={'\u7a7a\u767d\u306e\u307e\u307e\u3067\u3082OK'}
            onChange={(event) => setDeckNameDraft(event.target.value)}
          />
        </label>
        <label className="field">
          <span>{'\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9'}</span>
          <select
            value={deckWorkspaceId}
            onChange={(event) => setDeckWorkspaceId(event.target.value)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.path}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsDeckModalOpen(false)}
          >
            {'\u30ad\u30e3\u30f3\u30bb\u30eb'}
          </button>
          <button type="submit" className="primary-button">
            {'\u4f5c\u6210'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const terminalView = (
    <div className="terminal-layout">
      <button
        type="button"
        className={`deck-handle ${isDeckDrawerOpen ? 'is-open' : ''}`}
        onClick={handleToggleDeckList}
        onKeyDown={handleDeckHandleKeyDown}
        aria-label={
          isDeckDrawerOpen
            ? '\u30c7\u30c3\u30ad\u3092\u9589\u3058\u308b'
            : '\u30c7\u30c3\u30ad\u3092\u958b\u304f'
        }
        title={
          isDeckDrawerOpen
            ? '\u30c7\u30c3\u30ad\u3092\u9589\u3058\u308b'
            : '\u30c7\u30c3\u30ad\u3092\u958b\u304f'
        }
      >
        <span className="deck-handle-bars" aria-hidden="true" />
      </button>
      <aside className={`deck-drawer ${isDeckDrawerOpen ? 'is-open' : ''}`}>
        <DeckList
          decks={deckListItems}
          activeDeckId={activeDeckId}
          onSelect={handleSelectDeck}
          onCreate={handleOpenDeckModal}
        />
      </aside>
      <div className="terminal-stage">
        {activeDeckId ? (
          <TerminalPane
            terminals={activeDeckState.terminals}
            activeTerminalId={activeDeckState.activeTerminalId}
            wsBase={wsBase}
            onSelectTerminal={handleSelectTerminal}
            onNewTerminal={handleCreateTerminal}
          />
        ) : (
          <div className="panel empty-panel">
            {'\u30c7\u30c3\u30ad\u3092\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044\u3002'}
          </div>
        )}
      </div>
      {deckModal}
    </div>
  );

  return (
    <div className="app" data-view={view}>
      <SideNav
        activeView={view}
        onSelect={setView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
      <main className="main">
        {view === 'workspace' ? workspaceView : terminalView}
      </main>
      {statusMessage ? (
        <div className="status-float" role="status">
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
