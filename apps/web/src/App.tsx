import { Folder, GitBranch } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConfig, getWsBase } from "./api";
import { AIWorkflowPanel } from "./components/AIWorkflowPanel";
import { ContextStatus } from "./components/ContextStatus";
import { DeckModal } from "./components/DeckModal";
import { DiffViewer } from "./components/DiffViewer";
import { EditorPane } from "./components/EditorPane";
import { FileTree } from "./components/FileTree";
import { GlobalStatusBar } from "./components/GlobalStatusBar";
import { ServerModal } from "./components/ServerModal";
import { ServerStartupScreen } from "./components/ServerStartupScreen";
import { ServerStatus } from "./components/ServerStatus";
import { SettingsModal } from "./components/SettingsModal";
import { SourceControl } from "./components/SourceControl";
import { StatusMessage } from "./components/StatusMessage";
import { TerminalPane } from "./components/TerminalPane";
import { TitleBar } from "./components/TitleBar";
import { TunnelControl } from "./components/TunnelControl";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { WorkspaceList } from "./components/WorkspaceList";
import { WorkspaceModal } from "./components/WorkspaceModal";
import {
  DEFAULT_ROOT_FALLBACK,
  MESSAGE_SAVED,
  MESSAGE_SELECT_WORKSPACE,
  MESSAGE_WORKSPACE_REQUIRED,
  SAVED_MESSAGE_TIMEOUT,
  STORAGE_KEY_THEME,
} from "./constants";
import { useDeckState } from "./hooks/useDeckState";
import { useDecks } from "./hooks/useDecks";
import { useFileOperations } from "./hooks/useFileOperations";
import { useGitState } from "./hooks/useGitState";
import { useServerStatus } from "./hooks/useServerStatus";
import { useWorkspaceState } from "./hooks/useWorkspaceState";
import { useWorkspaces } from "./hooks/useWorkspaces";
import type { SidebarPanel, WorkspaceMode } from "./types";
import { createEmptyDeckState, createEmptyWorkspaceState } from "./utils/stateUtils";
import { parseUrlState } from "./utils/urlUtils";

export default function App() {
  const initialUrlState = parseUrlState();

  // Server startup screen state
  const [serverReady, setServerReady] = useState(true); // Start as ready for browser preview

  // Server status
  const serverStatus = useServerStatus();

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(initialUrlState.workspaceMode);
  const _theme = "dark"; // Force dark theme
  const [defaultRoot, setDefaultRoot] = useState(DEFAULT_ROOT_FALLBACK);
  const [statusMessage, setStatusMessage] = useState("");
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("files");

  const { workspaceStates, setWorkspaceStates, updateWorkspaceState, initializeWorkspaceStates } =
    useWorkspaceState();
  const { deckStates, setDeckStates, updateDeckState, initializeDeckStates } = useDeckState();

  const { workspaces, editorWorkspaceId, setEditorWorkspaceId, handleCreateWorkspace } =
    useWorkspaces({
      setStatusMessage,
      defaultRoot,
      initializeWorkspaceStates,
      setWorkspaceStates,
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
    handleUpdateGroup,
    creatingTerminalDeckIds,
  } = useDecks({
    setStatusMessage,
    initializeDeckStates,
    updateDeckState,
    deckStates,
    setDeckStates,
    initialDeckIds: initialUrlState.deckIds,
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
    handleDeleteDirectory,
  } = useFileOperations({
    editorWorkspaceId,
    activeWorkspaceState,
    updateWorkspaceState,
    setStatusMessage,
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
    handleLoadLogs,
  } = useGitState(editorWorkspaceId, setStatusMessage);

  const wsBase = getWsBase();
  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );
  const _deckListItems = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    path: workspaceById.get(deck.workspaceId)?.path || deck.root,
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
    setContextHealthScore((prevHealthScore) => {
      // Show notification when health score drops
      if (status.healthScore < 50 && prevHealthScore >= 50) {
        setStatusMessage("Context health is low. Consider compacting.");
      }
      return status.healthScore;
    });
  }, []);

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
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = "dark";
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, "dark");
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
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setEditorWorkspaceId, setActiveDeckIds]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (editorWorkspaceId) {
      params.set("workspace", editorWorkspaceId);
    }
    if (activeDeckIds.length > 0) {
      params.set("decks", activeDeckIds.join(","));
    }
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [editorWorkspaceId, activeDeckIds]);

  useEffect(() => {
    if (statusMessage !== MESSAGE_SAVED) return;
    const timer = setTimeout(() => setStatusMessage(""), SAVED_MESSAGE_TIMEOUT);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (workspaceMode === "editor" && !editorWorkspaceId) {
      setWorkspaceMode("list");
    }
  }, [workspaceMode, editorWorkspaceId]);

  // Track if we've loaded tree for current workspace
  const treeLoadedRef = useRef<string | null>(null);

  // Refresh file tree when opening workspace editor
  useEffect(() => {
    if (workspaceMode !== "editor" || !editorWorkspaceId) {
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

  const handleSaveSettings = useCallback(
    async (settings: {
      port: number;
      basicAuthEnabled: boolean;
      basicAuthUser: string;
      basicAuthPassword: string;
    }) => {
      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || "Failed to save settings");
        }

        const _result = await response.json();
        setStatusMessage("設定を保存しました。ブラウザをリロードしてください。");

        // Reload after 2 seconds to apply settings
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error: unknown) {
        console.error("Failed to save settings:", error);
        throw error;
      }
    },
    []
  );

  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      setEditorWorkspaceId(workspaceId);
      setWorkspaceMode("editor");
    },
    [setEditorWorkspaceId]
  );

  const handleCloseWorkspaceEditor = useCallback(() => {
    setWorkspaceMode("list");
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

  const handleNewTerminalForDeck = useCallback(
    (deckId: string) => {
      const deckState = deckStates[deckId] || defaultDeckState;
      handleCreateTerminal(deckId, deckState.terminals.length);
    },
    [deckStates, defaultDeckState, handleCreateTerminal]
  );

  const handleNewClaudeTerminalForDeck = useCallback(
    (deckId: string) => {
      const deckState = deckStates[deckId] || defaultDeckState;
      handleCreateTerminal(deckId, deckState.terminals.length, "claude", "Claude Code");
    },
    [deckStates, defaultDeckState, handleCreateTerminal]
  );

  const handleNewCodexTerminalForDeck = useCallback(
    (deckId: string) => {
      const deckState = deckStates[deckId] || defaultDeckState;
      handleCreateTerminal(deckId, deckState.terminals.length, "codex", "Codex");
    },
    [deckStates, defaultDeckState, handleCreateTerminal]
  );

  const handleTerminalDeleteForDeck = useCallback(
    (deckId: string, terminalId: string) => {
      handleDeleteTerminal(deckId, terminalId);
    },
    [handleDeleteTerminal]
  );

  const handleToggleDeck = useCallback(
    (deckId: string, shiftKey = false) => {
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
    },
    [setActiveDeckIds]
  );

  // Keyboard navigation for deck tabs
  const handleDeckTabKeyDown = useCallback(
    (e: ReactKeyboardEvent, _deckId: string, index: number) => {
      // Only handle arrow keys when not modified with ctrl/cmd/alt
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const direction = e.key === "ArrowLeft" ? -1 : 1;
        const newIndex = index + direction;

        // Find the deck at the new index
        if (newIndex >= 0 && newIndex < decks.length) {
          const _targetDeckId = decks[newIndex].id;
          // Focus the new tab but don't change selection (just move focus)
          const targetTab = e.currentTarget.parentElement?.children[newIndex + 1] as HTMLElement;
          targetTab?.focus();
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        // Move to first tab
        const firstTab = e.currentTarget.parentElement?.children[1] as HTMLElement;
        firstTab?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        // Move to last tab
        const lastTab = e.currentTarget.parentElement?.children[decks.length] as HTMLElement;
        lastTab?.focus();
      }
    },
    [decks]
  );

  const gitChangeCount = gitState.status?.files.length ?? 0;

  // Check if welcome screen should be shown
  const showWelcomeScreen = workspaces.length === 0 && decks.length === 0;

  const workspaceEditor =
    workspaceMode === "editor" && Boolean(editorWorkspaceId) ? (
      <div className="workspace-editor-overlay">
        <div className="workspace-editor-header">
          <button type="button" className="ghost-button" onClick={handleCloseWorkspaceEditor}>
            {"\u4e00\u89a7\u306b\u623b\u308b"}
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
              className={`activity-bar-item ${sidebarPanel === "files" ? "active" : ""}`}
              onClick={() => setSidebarPanel("files")}
              title="エクスプローラー"
            >
              <Folder size={20} />
            </button>
            <button
              type="button"
              className={`activity-bar-item ${sidebarPanel === "git" ? "active" : ""}`}
              onClick={() => {
                setSidebarPanel("git");
                refreshGitStatus();
              }}
              title="ソースコントロール"
            >
              <GitBranch size={20} />
              {gitChangeCount > 0 && <span className="activity-bar-badge">{gitChangeCount}</span>}
            </button>
          </div>
          <div className="sidebar-panel">
            <div className="sidebar-content">
              {sidebarPanel === "files" ? (
                <FileTree
                  root={activeWorkspace?.path || defaultRoot || ""}
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
              ) : sidebarPanel === "git" ? (
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
              ) : sidebarPanel === "ai" ? (
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
                activeFileId: fileId,
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
    <div className={`workspace-view ${workspaceMode === "editor" ? "has-editor" : ""}`}>
      {showWelcomeScreen ? (
        <WelcomeScreen
          onOpenWorkspaceModal={handleOpenWorkspaceModal}
          onOpenDeckModal={handleOpenDeckModal}
          hasWorkspace={workspaces.length > 0}
          hasDeck={decks.length > 0}
        />
      ) : workspaceMode === "list" ? (
        <div className="workspace-start">
          <button type="button" className="primary-button" onClick={handleOpenWorkspaceModal}>
            {"\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8ffd\u52a0"}
          </button>
          <WorkspaceList
            workspaces={workspaces}
            selectedWorkspaceId={editorWorkspaceId}
            onSelect={handleSelectWorkspace}
          />
        </div>
      ) : null}
      {workspaceEditor}
    </div>
  );

  // Unified terminal section (always shown below editor)
  const terminalSection = (
    <div className="unified-terminal-section">
      <div className="terminal-topbar">
        <div className="topbar-left">
          <div className="deck-tabs" role="tablist">
            {decks.map((deck, index) => (
              <button
                key={deck.id}
                type="button"
                className={`deck-tab ${activeDeckIds.includes(deck.id) ? "active" : ""}`}
                onClick={(e) => handleToggleDeck(deck.id, e.shiftKey)}
                onKeyDown={(e) => handleDeckTabKeyDown(e, deck.id, index)}
                title={`${workspaceById.get(deck.workspaceId)?.path || deck.root}\nShift+クリックで分割表示`}
                role="tab"
                aria-selected={activeDeckIds.includes(deck.id)}
                tabIndex={activeDeckIds.includes(deck.id) ? 0 : -1}
              >
                {deck.name}
              </button>
            ))}
            <button
              type="button"
              className="deck-tab deck-tab-add"
              onClick={handleOpenDeckModal}
              title="デッキ作成"
              aria-label="デッキ作成"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div
        className="terminal-split-container"
        style={{ gridTemplateColumns: `repeat(${activeDeckIds.length}, 1fr)` }}
      >
        {activeDeckIds.length === 0 ? (
          <div className="panel empty-panel">{"デッキを作成してください。"}</div>
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
                      terminals: newOrder,
                    }));
                  }}
                  terminalGroups={terminalGroups}
                  onToggleGroupCollapsed={handleToggleGroupCollapsed}
                  onDeleteGroup={handleDeleteGroup}
                  onRenameGroup={(groupId) => {
                    // TODO: Implement rename dialog
                    const newName = prompt("Enter new group name:");
                    if (newName) {
                      handleUpdateGroup(groupId, { name: newName });
                    }
                  }}
                  onCreateTerminal={() => handleNewTerminalForDeck(deckId)}
                  isCreatingTerminal={creatingTerminalDeckIds.has(deckId)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // Show startup screen first
  if (!serverReady) {
    return <ServerStartupScreen onComplete={() => setServerReady(true)} />;
  }

  return (
    <div className="app">
      <TitleBar
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenServerModal={() => setIsServerModalOpen(true)}
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
        serverStatus={<ServerStatus status={serverStatus.status} port={serverStatus.port} />}
        tunnelControl={<TunnelControl />}
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
      <ServerModal
        isOpen={isServerModalOpen}
        status={serverStatus.status}
        port={serverStatus.port}
        onClose={() => setIsServerModalOpen(false)}
      />
    </div>
  );
}
