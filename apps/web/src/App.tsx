import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeckList } from './components/DeckList';
import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { TerminalPane } from './components/TerminalPane';
import { TopBar } from './components/TopBar';
import {
  createDeck as apiCreateDeck,
  createTerminal as apiCreateTerminal,
  getApiBase,
  getWsBase,
  listDecks,
  listFiles,
  readFile,
  writeFile
} from './api';
import type {
  Deck,
  DeckState,
  EditorFile,
  FileSystemEntry,
  FileTreeNode
} from './types';

const DEFAULT_ROOT = import.meta.env.VITE_DEFAULT_ROOT || 'C:/workspace';

type MobileView = 'decks' | 'files' | 'editor' | 'terminal';

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

const fallbackTree: FileTreeNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'dir',
    expanded: true,
    loading: false,
    children: [
      {
        name: 'components',
        path: 'src/components',
        type: 'dir',
        expanded: false,
        loading: false,
        children: []
      },
      {
        name: 'app.tsx',
        path: 'src/app.tsx',
        type: 'file',
        expanded: false,
        loading: false
      },
      {
        name: 'styles.css',
        path: 'src/styles.css',
        type: 'file',
        expanded: false,
        loading: false
      }
    ]
  },
  {
    name: 'README.md',
    path: 'README.md',
    type: 'file',
    expanded: false,
    loading: false
  },
  {
    name: 'package.json',
    path: 'package.json',
    type: 'file',
    expanded: false,
    loading: false
  }
];

const fallbackFiles: EditorFile[] = [
  {
    id: 'readme',
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    contents: '# Deck IDE\n\nフルスクリーンのターミナルと編集可能なデッキ。',
    dirty: false
  },
  {
    id: 'app',
    name: 'App.tsx',
    path: 'src/App.tsx',
    language: 'typescript',
    contents: `export default function App() {\n  return <div>Deck IDE</div>;\n}`,
    dirty: false
  }
];

const createEmptyDeckState = (): DeckState => ({
  files: [],
  activeFileId: null,
  terminals: [],
  activeTerminalId: null,
  tree: [],
  treeLoading: false,
  treeError: null
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

export default function App() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [deckStates, setDeckStates] = useState<Record<string, DeckState>>({});
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('editor');
  const [statusMessage, setStatusMessage] = useState('');
  const [savingFileId, setSavingFileId] = useState<string | null>(null);

  const defaultDeckState = useMemo<DeckState>(() => createEmptyDeckState(), []);
  const activeDeck = useMemo(
    () => decks.find((deck) => deck.id === activeDeckId) ?? decks[0],
    [decks, activeDeckId]
  );
  const activeState = activeDeckId
    ? deckStates[activeDeckId] || defaultDeckState
    : defaultDeckState;
  const activeTerminal = activeState.terminals.find(
    (term) => term.id === activeState.activeTerminalId
  );
  const apiBase = getApiBase();
  const wsBase = getWsBase();

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
    listDecks()
      .then((data) => {
        if (!alive) return;
        setDecks(data);
        setActiveDeckId((prev) => prev ?? data[0]?.id ?? null);
        setDeckStates((prev) => {
          const next = { ...prev };
          data.forEach((deck) => {
            if (!next[deck.id]) {
              next[deck.id] = createEmptyDeckState();
            }
          });
          return next;
        });
        setStatusMessage('');
      })
      .catch(() => {
        if (!alive) return;
        const fallbackDeck: Deck = {
          id: crypto.randomUUID(),
          name: 'Core',
          root: DEFAULT_ROOT,
          createdAt: new Date().toISOString()
        };
        setDecks([fallbackDeck]);
        setActiveDeckId(fallbackDeck.id);
        setDeckStates({
          [fallbackDeck.id]: {
            ...createEmptyDeckState(),
            tree: fallbackTree,
            files: fallbackFiles,
            activeFileId: fallbackFiles[0]?.id ?? null
          }
        });
        setStatusMessage('API未起動です。サーバーを起動してください。');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (statusMessage !== 'Saved.') return;
    const timer = setTimeout(() => setStatusMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!activeDeckId) return;
    const current = deckStates[activeDeckId];
    if (current?.tree?.length || current?.treeLoading) return;
    updateDeckState(activeDeckId, (state) => ({
      ...state,
      treeLoading: true,
      treeError: null
    }));
    listFiles('')
      .then((entries) => {
        updateDeckState(activeDeckId, (state) => ({
          ...state,
          tree: toTreeNodes(entries),
          treeLoading: false
        }));
      })
      .catch((error: unknown) => {
        updateDeckState(activeDeckId, (state) => ({
          ...state,
          treeLoading: false,
          treeError: getErrorMessage(error)
        }));
      });
  }, [activeDeckId, deckStates, updateDeckState]);

  const handleCreateDeck = async () => {
    try {
      const deck = await apiCreateDeck(`Deck ${decks.length + 1}`);
      setDecks((prev) => [...prev, deck]);
      setActiveDeckId(deck.id);
      updateDeckState(deck.id, (state) => ({ ...state }));
    } catch (error: unknown) {
      setStatusMessage(`デッキの作成に失敗しました: ${getErrorMessage(error)}`);
    }
  };

  const handleRefreshTree = () => {
    if (!activeDeckId) return;
    updateDeckState(activeDeckId, (state) => ({
      ...state,
      treeLoading: true,
      treeError: null
    }));
    listFiles('')
      .then((entries) => {
        updateDeckState(activeDeckId, (state) => ({
          ...state,
          tree: toTreeNodes(entries),
          treeLoading: false
        }));
      })
      .catch((error: unknown) => {
        updateDeckState(activeDeckId, (state) => ({
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

  const handleToggleDir = (node: FileTreeNode) => {
    if (!activeDeckId || node.type !== 'dir') return;
    if (node.expanded) {
      updateDeckState(activeDeckId, (state) => ({
        ...state,
        tree: updateTreeNode(state.tree, node.path, (item) => ({
          ...item,
          expanded: false
        }))
      }));
      return;
    }
    if (node.children && node.children.length > 0) {
      updateDeckState(activeDeckId, (state) => ({
        ...state,
        tree: updateTreeNode(state.tree, node.path, (item) => ({
          ...item,
          expanded: true
        }))
      }));
      return;
    }

    updateDeckState(activeDeckId, (state) => ({
      ...state,
      tree: updateTreeNode(state.tree, node.path, (item) => ({
        ...item,
        loading: true
      }))
    }));
    listFiles(node.path)
      .then((entries) => {
        updateDeckState(activeDeckId, (state) => ({
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
        updateDeckState(activeDeckId, (state) => ({
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
    if (!activeDeckId || entry.type !== 'file') return;
    const existing = activeState.files.find((file) => file.path === entry.path);
    if (existing) {
      updateDeckState(activeDeckId, (state) => ({
        ...state,
        activeFileId: existing.id
      }));
      setMobileView('editor');
      return;
    }
    readFile(entry.path)
      .then((data) => {
        const file = {
          id: crypto.randomUUID(),
          name: entry.name,
          path: entry.path,
          language: getLanguageFromPath(entry.path),
          contents: data.contents,
          dirty: false
        };
        updateDeckState(activeDeckId, (state) => ({
          ...state,
          files: [...state.files, file],
          activeFileId: file.id
        }));
        setMobileView('editor');
      })
      .catch((error: unknown) => {
        setStatusMessage(`ファイルを開けませんでした: ${getErrorMessage(error)}`);
      });
  };

  const handleFileChange = (fileId: string, contents: string) => {
    if (!activeDeckId) return;
    updateDeckState(activeDeckId, (state) => ({
      ...state,
      files: state.files.map((file) =>
        file.id === fileId ? { ...file, contents, dirty: true } : file
      )
    }));
  };

  const handleSaveFile = async (fileId: string) => {
    if (!activeDeckId) return;
    const file = activeState.files.find((item) => item.id === fileId);
    if (!file) return;
    setSavingFileId(fileId);
    try {
      await writeFile(file.path, file.contents);
      updateDeckState(activeDeckId, (state) => ({
        ...state,
        files: state.files.map((item) =>
          item.id === fileId ? { ...item, dirty: false } : item
        )
      }));
      setStatusMessage('保存しました。');
    } catch (error: unknown) {
      setStatusMessage(`保存に失敗しました: ${getErrorMessage(error)}`);
    } finally {
      setSavingFileId(null);
    }
  };

  const handleCreateTerminal = async () => {
    if (!activeDeckId) return;
    try {
      const session = await apiCreateTerminal();
      updateDeckState(activeDeckId, (state) => {
        const index = state.terminals.length + 1;
        const terminal = { id: session.id, title: `Terminal ${index}` };
        return {
          ...state,
          terminals: [...state.terminals, terminal],
          activeTerminalId: terminal.id
        };
      });
      setMobileView('terminal');
    } catch (error: unknown) {
      setStatusMessage(`ターミナルを起動できませんでした: ${getErrorMessage(error)}`);
    }
  };

  const handleSelectTerminal = (terminalId: string) => {
    if (!activeDeckId) return;
    updateDeckState(activeDeckId, (state) => ({
      ...state,
      activeTerminalId: terminalId
    }));
  };

  return (
    <div
      className="app"
      data-terminal-max={terminalMaximized ? 'on' : 'off'}
      data-mobile-view={mobileView}
    >
      <aside className="sidebar">
        <DeckList
          decks={decks}
          activeDeckId={activeDeck?.id}
          onSelect={(deckId) => {
            setActiveDeckId(deckId);
            setMobileView('editor');
          }}
          onCreate={handleCreateDeck}
        />
        <FileTree
          root={activeDeck?.root || DEFAULT_ROOT}
          entries={activeState.tree}
          loading={activeState.treeLoading}
          error={activeState.treeError}
          onToggleDir={handleToggleDir}
          onOpenFile={handleOpenFile}
          onRefresh={handleRefreshTree}
        />
      </aside>

      <TopBar
        deck={activeDeck}
        apiBase={apiBase}
        status={statusMessage}
        terminalMaximized={terminalMaximized}
        onCreateDeck={handleCreateDeck}
        onCreateTerminal={handleCreateTerminal}
        onToggleTerminal={() => {
          setTerminalMaximized((prev) => !prev);
          setMobileView('terminal');
        }}
      />

      <main className="workspace">
        <EditorPane
          files={activeState.files}
          activeFileId={activeState.activeFileId}
          onSelectFile={(fileId) => {
            if (!activeDeckId) return;
            updateDeckState(activeDeckId, (state) => ({
              ...state,
              activeFileId: fileId
            }));
          }}
          onChangeFile={handleFileChange}
          onSaveFile={handleSaveFile}
          savingFileId={savingFileId}
        />
        <TerminalPane
          session={activeTerminal}
          terminals={activeState.terminals}
          onSelectTerminal={handleSelectTerminal}
          onNewTerminal={handleCreateTerminal}
          onToggleMaximize={() => {
            setTerminalMaximized((prev) => !prev);
            setMobileView('terminal');
          }}
          isMaximized={terminalMaximized}
          wsUrl={activeTerminal ? `${wsBase}/api/terminals/${activeTerminal.id}` : ''}
        />
      </main>

      <nav className="mobile-nav">
        <button
          type="button"
          className={mobileView === 'decks' ? 'is-active' : ''}
          onClick={() => setMobileView('decks')}
        >
          デッキ
        </button>
        <button
          type="button"
          className={mobileView === 'files' ? 'is-active' : ''}
          onClick={() => setMobileView('files')}
        >
          ファイル
        </button>
        <button
          type="button"
          className={mobileView === 'editor' ? 'is-active' : ''}
          onClick={() => setMobileView('editor')}
        >
          エディタ
        </button>
        <button
          type="button"
          className={mobileView === 'terminal' ? 'is-active' : ''}
          onClick={() => setMobileView('terminal')}
        >
          ターミナル
        </button>
      </nav>
    </div>
  );
}
