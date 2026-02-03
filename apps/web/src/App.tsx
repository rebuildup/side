import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Folder, GitBranch } from 'lucide-react';
import { DeckModal } from './components/DeckModal';
import { DiffViewer } from './components/DiffViewer';
import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { SettingsModal } from './components/SettingsModal';
import { SideNav } from './components/SideNav';
import { SourceControl } from './components/SourceControl';
import { StatusMessage } from './components/StatusMessage';
import { TerminalPane } from './components/TerminalPane';
import { WorkspaceList } from './components/WorkspaceList';
import { WorkspaceModal } from './components/WorkspaceModal';
import { GlobalStatusBar } from './components/GlobalStatusBar';
import { ContextStatus } from './components/ContextStatus';
import { AIWorkflowPanel } from './components/AIWorkflowPanel';
import { getConfig, getWsBase } from './api';
import { useWorkspaceState } from './hooks/useWorkspaceState';
import { useDeckState } from './hooks/useDeckState';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useDecks } from './hooks/useDecks';
import { useFileOperations } from './hooks/useFileOperations';
import { useGitState } from './hooks/useGitState';
import type { AppView, WorkspaceMode, SidebarPanel } from './types';
import {
  DEFAULT_ROOT_FALLBACK,
  SAVED_MESSAGE_TIMEOUT,
  MESSAGE_SAVED,
  MESSAGE_WORKSPACE_REQUIRED,
  MESSAGE_SELECT_WORKSPACE,
  MESSAGE_SELECT_DECK,
  STORAGE_KEY_THEME
} from './constants';
import { parseUrlState } from './utils/urlUtils';
import { createEmptyWorkspaceState, createEmptyDeckState } from './utils/stateUtils';

export default function App() {
  const initialUrlState = parseUrlState();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    initialUrlState.workspaceMode
  );
  const theme = 'dark'; // Force dark theme
  const [defaultRoot, setDefaultRoot] = useState(DEFAULT_ROOT_FALLBACK);
  const [statusMessage, setStatusMessage] = useState('');
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('files');

  const { workspaceStates, setWorkspaceStates, updateWorkspaceState, initializeWorkspaceStates } =
    useWorkspaceState();
  const { deckStates, setDeckStates, updateDeckState, initializeDeckStates } =
    useDeckState();

  const { workspaces, editorWorkspaceId, setEditorWorkspaceId, handleCreateWorkspace } =
    useWorkspaces({
      setStatusMessage,
      defaultRoot,
      initializeWorkspaceStates,
      setWorkspaceStates
    });

  const {
    decks,
    activeDeckIds,
    setActiveDeckIds,
    terminalGroups,
    handleCreateDeck,
    handleCreateTerminal,
    handleDeleteTerminal,
    handleToggleGroupCollapsed,
    handleDeleteGroup,
    handleUpdateGroup
  } = useDecks({
    setStatusMessage,
    initializeDeckStates,
    updateDeckState,
    deckStates,
    setDeckStates,
    initialDeckIds: initialUrlState.deckIds
  });


  const defaultWorkspaceState = useMemo(() => createEmptyWorkspaceState(), []);
  const defaultDeckState = useMemo(() => createEmptyDeckState(), []);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === editorWorkspaceId) || null;
  const activeWorkspaceState = editorWorkspaceId
    ? workspaceStates[editorWorkspaceId] || defaultWorkspaceState
    : defaultWorkspaceState;

  const {
    savingFileId,
    handleRefreshTree,
    handleToggleDir,
    handleOpenFile,
    handleFileChange,
    handleSaveFile,
    handleCloseFile,
    handleCreateFile,
    handleCreateDirectory,
    handleDeleteFile,
    handleDeleteDirectory
  } = useFileOperations({
    editorWorkspaceId,
    activeWorkspaceState,
    updateWorkspaceState,
    setStatusMessage
  });

  const {
    gitState,
    refreshGitStatus,
    handleSelectRepo,
    handleStageFile,
    handleUnstageFile,
    handleStageAll,
    handleUnstageAll,
    handleCommit,
    handleDiscardFile,
    handleShowDiff,
    handleCloseDiff,
    handlePush,
    handlePull,
    handleLoadBranches,
    handleCheckoutBranch,
    handleCreateBranch,
    handleLoadLogs
  } = useGitState(editorWorkspaceId, setStatusMessage);

  const wsBase = getWsBase();
  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );
  const deckListItems = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    path: workspaceById.get(deck.workspaceId)?.path || deck.root
  }));

  // Calculate active terminals count for status bar
  const activeTerminalsCount = useMemo(() => {
    let count = 0;
    activeDeckIds.forEach((deckId) => {
      const deckState = deckStates[deckId];
      if (deckState?.terminals) {
        count += deckState.terminals.length;
      }
    });
    return count;
  }, [activeDeckIds, deckStates]);

  // Context manager status state
  const [showContextStatus, setShowContextStatus] = useState(false);
  const [contextHealthScore, setContextHealthScore] = useState<number>(100);

  const handleContextStatusChange = useCallback((status: { healthScore: number }) => {
    setContextHealthScore(status.healthScore);
    // Show notification when health score drops
    if (status.healthScore < 50 && contextHealthScore >= 50) {
      setStatusMessage('Context health is low. Consider compacting.');
    }
  }, [contextHealthScore]);

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
    document.documentElement.dataset.theme = 'dark';
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, 'dark');
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseUrlState();
      setEditorWorkspaceId(next.workspaceId ?? null);
      setActiveDeckIds(next.deckIds);
      setWorkspaceMode(next.workspaceMode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setEditorWorkspaceId, setActiveDeckIds]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (editorWorkspaceId) {
      params.set('workspace', editorWorkspaceId);
    }
    if (activeDeckIds.length > 0) {
      params.set('decks', activeDeckIds.join(','));
    }
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [editorWorkspaceId, activeDeckIds]);

  useEffect(() => {
    if (statusMessage !== MESSAGE_SAVED) return;
    const timer = setTimeout(() => setStatusMessage(''), SAVED_MESSAGE_TIMEOUT);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (workspaceMode === 'editor' && !editorWorkspaceId) {
      setWorkspaceMode('list');
    }
  }, [workspaceMode, editorWorkspaceId]);

  // Track if we've loaded tree for current workspace
  const treeLoadedRef = useRef<string | null>(null);

  // Refresh file tree when opening workspace editor
  useEffect(() => {
    if (workspaceMode !== 'editor' || !editorWorkspaceId) {
      treeLoadedRef.current = null;
      return;
    }

    // Only load if we haven't loaded for this workspace yet
    if (treeLoadedRef.current !== editorWorkspaceId) {
      treeLoadedRef.current = editorWorkspaceId;
      handleRefreshTree();
      refreshGitStatus();
    }
  }, [workspaceMode, editorWorkspaceId, handleRefreshTree, refreshGitStatus]);

  const handleOpenDeckModal = useCallback(() => {
    if (workspaces.length === 0) {
      setStatusMessage(MESSAGE_WORKSPACE_REQUIRED);
      return;
    }
    setIsDeckModalOpen(true);
  }, [workspaces.length]);

  const handleSubmitDeck = useCallback(
    async (name: string, workspaceId: string) => {
      if (!workspaceId) {
        setStatusMessage(MESSAGE_SELECT_WORKSPACE);
        return;
      }
      const deck = await handleCreateDeck(name, workspaceId);
      if (deck) {
        setIsDeckModalOpen(false);
      }
    },
    [handleCreateDeck]
  );

  const handleSaveSettings = useCallback(async (settings: { port: number; basicAuthEnabled: boolean; basicAuthUser: string; basicAuthPassword: string }) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to save settings');
      }

      const result = await response.json();
      setStatusMessage('設定を保存しました。ブラウザをリロードしてください。');

      // Reload after 2 seconds to apply settings
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }, []);

  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      setEditorWorkspaceId(workspaceId);
      setWorkspaceMode('editor');
    },
    [setEditorWorkspaceId]
  );

  const handleCloseWorkspaceEditor = useCallback(() => {
    setWorkspaceMode('list');
  }, []);

  const handleOpenWorkspaceModal = useCallback(() => {
    setIsWorkspaceModalOpen(true);
  }, []);

  const handleSubmitWorkspace = useCallback(
    async (path: string) => {
      const created = await handleCreateWorkspace(path);
      if (created) {
        setIsWorkspaceModalOpen(false);
      }
    },
    [handleCreateWorkspace]
  );

  const handleNewTerminalForDeck = useCallback((deckId: string) => {
    const deckState = deckStates[deckId] || defaultDeckState;
    handleCreateTerminal(deckId, deckState.terminals.length);
  }, [deckStates, defaultDeckState, handleCreateTerminal]);

  const handleNewClaudeTerminalForDeck = useCallback((deckId: string) => {
    const deckState = deckStates[deckId] || defaultDeckState;
    handleCreateTerminal(deckId, deckState.terminals.length, 'claude', 'Claude Code');
  }, [deckStates, defaultDeckState, handleCreateTerminal]);

  const handleNewCodexTerminalForDeck = useCallback((deckId: string) => {
    const deckState = deckStates[deckId] || defaultDeckState;
    handleCreateTerminal(deckId, deckState.terminals.length, 'codex', 'Codex');
  }, [deckStates, defaultDeckState, handleCreateTerminal]);

  const handleTerminalDeleteForDeck = useCallback(
    (deckId: string, terminalId: string) => {
      handleDeleteTerminal(deckId, terminalId);
    },
    [handleDeleteTerminal]
  );

  const handleToggleDeck = useCallback((deckId: string, shiftKey = false) => {
    setActiveDeckIds((prev) => {
      if (prev.includes(deckId)) {
        // Remove deck (but keep at least one)
        if (prev.length > 1) {
          return prev.filter((id) => id !== deckId);
        }
        return prev;
      } else if (shiftKey) {
        // Shift+click: Add deck for split view (max 3)
        if (prev.length < 3) {
          return [...prev, deckId];
        }
        // Replace first one if at max
        return [...prev.slice(1), deckId];
      } else {
        // Normal click: Replace with single deck (no split)
        return [deckId];
      }
    });
  }, [setActiveDeckIds]);


  const gitChangeCount = gitState.status?.files.length ?? 0;

  const workspaceEditor = workspaceMode === 'editor' && Boolean(editorWorkspaceId) ? (
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
        <div className="activity-bar">
          <button
            type="button"
            className={`activity-bar-item ${sidebarPanel === 'files' ? 'active' : ''}`}
            onClick={() => setSidebarPanel('files')}
            title="エクスプローラー"
          >
            <Folder size={20} />
          </button>
          <button
            type="button"
            className={`activity-bar-item ${sidebarPanel === 'git' ? 'active' : ''}`}
            onClick={() => {
              setSidebarPanel('git');
              refreshGitStatus();
            }}
            title="ソースコントロール"
          >
            <GitBranch size={20} />
            {gitChangeCount > 0 && (
              <span className="activity-bar-badge">{gitChangeCount}</span>
            )}
          </button>
        </div>
        <div className="sidebar-panel">
          <div className="sidebar-content">
            {sidebarPanel === 'files' ? (
              <FileTree
                root={activeWorkspace?.path || defaultRoot || ''}
                entries={activeWorkspaceState.tree}
                loading={activeWorkspaceState.treeLoading}
                error={activeWorkspaceState.treeError}
                onToggleDir={handleToggleDir}
                onOpenFile={handleOpenFile}
                onRefresh={handleRefreshTree}
                onCreateFile={handleCreateFile}
                onCreateDirectory={handleCreateDirectory}
                onDeleteFile={handleDeleteFile}
                onDeleteDirectory={handleDeleteDirectory}
                gitFiles={gitState.status?.files}
              />
            ) : sidebarPanel === 'git' ? (
              <SourceControl
                status={gitState.status}
                loading={gitState.loading}
                error={gitState.error}
                workspaceId={editorWorkspaceId}
                branchStatus={gitState.branchStatus}
                hasRemote={gitState.hasRemote}
                pushing={gitState.pushing}
                pulling={gitState.pulling}
                branches={gitState.branches}
                branchesLoading={gitState.branchesLoading}
                logs={gitState.logs}
                logsLoading={gitState.logsLoading}
                repos={gitState.repos}
                selectedRepoPath={gitState.selectedRepoPath}
                onSelectRepo={handleSelectRepo}
                onRefresh={refreshGitStatus}
                onStageFile={handleStageFile}
                onUnstageFile={handleUnstageFile}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
                onCommit={handleCommit}
                onDiscardFile={handleDiscardFile}
                onShowDiff={handleShowDiff}
                onPush={handlePush}
                onPull={handlePull}
                onLoadBranches={handleLoadBranches}
                onCheckoutBranch={handleCheckoutBranch}
                onCreateBranch={handleCreateBranch}
                onLoadLogs={handleLoadLogs}
              />
            ) : sidebarPanel === 'ai' ? (
              <AIWorkflowPanel workspaceId={editorWorkspaceId} />
            ) : null}
          </div>
        </div>
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
          onCloseFile={handleCloseFile}
          onChangeFile={handleFileChange}
          onSaveFile={handleSaveFile}
          savingFileId={savingFileId}
        />
      </div>
      {gitState.diffPath && (
        <DiffViewer
          diff={gitState.diff}
          loading={gitState.diffLoading}
          onClose={handleCloseDiff}
        />
      )}
    </div>
  ) : null;

  const workspaceView = (
    <div className={`workspace-view ${workspaceMode === 'editor' ? 'has-editor' : ''}`}>
      {workspaceMode === 'list' ? (
        <>
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
        </>
      ) : null}
      {workspaceEditor}
    </div>
  );

  // Unified terminal section (always shown below editor)
  const terminalSection = (
    <div className="unified-terminal-section">
      <div className="terminal-topbar">
        <div className="topbar-left">
          <div className="deck-tabs">
            {decks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                className={`deck-tab ${activeDeckIds.includes(deck.id) ? 'active' : ''}`}
                onClick={(e) => handleToggleDeck(deck.id, e.shiftKey)}
                title={`${workspaceById.get(deck.workspaceId)?.path || deck.root}\nShift+クリックで分割表示`}
              >
                {deck.name}
              </button>
            ))}
            <button
              type="button"
              className="deck-tab deck-tab-add"
              onClick={handleOpenDeckModal}
              title="デッキ作成"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="terminal-split-container" style={{ gridTemplateColumns: `repeat(${activeDeckIds.length}, 1fr)` }}>
        {activeDeckIds.length === 0 ? (
          <div className="panel empty-panel">
            {'デッキを作成してください。'}
          </div>
        ) : (
          activeDeckIds.map((deckId) => {
            const deck = decks.find((d) => d.id === deckId);
            const deckState = deckStates[deckId] || defaultDeckState;
            if (!deck) return null;
            return (
              <div key={deckId} className="deck-split-pane">
                <div className="deck-split-header">
                  <span className="deck-split-title">{deck.name}</span>
                  <div className="deck-split-actions">
                    <button
                      type="button"
                      className="topbar-btn-sm"
                      onClick={() => handleNewTerminalForDeck(deckId)}
                      title="ターミナル追加"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="topbar-btn-sm topbar-btn-claude"
                      onClick={() => handleNewClaudeTerminalForDeck(deckId)}
                      title="Claude"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      className="topbar-btn-sm topbar-btn-codex"
                      onClick={() => handleNewCodexTerminalForDeck(deckId)}
                      title="Codex"
                    >
                      X
                    </button>
                  </div>
                </div>
                <TerminalPane
                  terminals={deckState.terminals}
                  wsBase={wsBase}
                  deckId={deckId}
                  onDeleteTerminal={(terminalId) => handleTerminalDeleteForDeck(deckId, terminalId)}
                  onReorderTerminals={(deckId, newOrder) => {
                    updateDeckState(deckId, (state) => ({
                      ...state,
                      terminals: newOrder
                    }));
                  }}
                  terminalGroups={terminalGroups}
                  onToggleGroupCollapsed={handleToggleGroupCollapsed}
                  onDeleteGroup={handleDeleteGroup}
                  onRenameGroup={(groupId) => {
                    // TODO: Implement rename dialog
                    const newName = prompt('Enter new group name:');
                    if (newName) {
                      handleUpdateGroup(groupId, { name: newName });
                    }
                  }}
                  onCreateTerminal={() => handleNewTerminalForDeck(deckId)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="app">
      <SideNav
        sidebarPanel={sidebarPanel}
        onSetSidebarPanel={setSidebarPanel}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onToggleContextStatus={() => setShowContextStatus((prev) => !prev)}
      />
      <main className="main">
        <div className="unified-layout">
          {workspaceView}
          {terminalSection}
        </div>
      </main>
      <StatusMessage message={statusMessage} />
      <GlobalStatusBar
        activeTerminalsCount={activeTerminalsCount}
        contextHealthScore={contextHealthScore}
        onToggleContextStatus={() => setShowContextStatus((prev) => !prev)}
      />
      {showContextStatus && (
        <div className="context-status-overlay" onClick={() => setShowContextStatus(false)}>
          <div className="context-status-panel" onClick={(e) => e.stopPropagation()}>
            <ContextStatus onStatusChange={handleContextStatusChange} />
          </div>
        </div>
      )}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        defaultRoot={defaultRoot}
        onSubmit={handleSubmitWorkspace}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />
      <DeckModal
        isOpen={isDeckModalOpen}
        workspaces={workspaces}
        onSubmit={handleSubmitDeck}
        onClose={() => setIsDeckModalOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
