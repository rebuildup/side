import { ChevronRight, File, Folder } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
const LABEL_LOADING = "読み込み中...";
const LABEL_FILES = "ファイル";
const LABEL_REFRESH = "更新";
const LABEL_EMPTY = "ファイルが見つかりません。";
const LABEL_BACK = "戻る";
// Invalid filename characters for Windows and Unix systems
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/;
const _INVALID_FILENAME_CHARS_WIN = /[<>:"/\\|?*\x00-\x1F]/;
const RESERVED_NAMES_WIN = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
function validateFileName(name) {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: "ファイル名を入力してください" };
    }
    // Check for invalid characters
    if (INVALID_FILENAME_CHARS.test(name)) {
        return { valid: false, error: 'ファイル名に無効な文字が含まれています: <>:"/\\|?*' };
    }
    // Check for Windows reserved names
    if (RESERVED_NAMES_WIN.test(name)) {
        return { valid: false, error: "この名前は予約されています" };
    }
    // Check for names ending with space or dot (invalid on Windows)
    if (name.endsWith(" ") || name.endsWith(".")) {
        return { valid: false, error: "ファイル名はスペースまたはピリオドで終わることができません" };
    }
    return { valid: true };
}
function getGitStatusClass(path, gitFiles) {
    if (!gitFiles)
        return "";
    const file = gitFiles.find((f) => f.path === path || path.endsWith(f.path));
    if (!file)
        return "";
    return `git-tree-${file.status}`;
}
const ChevronIcon = () => <ChevronRight size={14} className="tree-chevron-icon"/>;
const FolderIcon = () => <Folder size={16} className="tree-svg"/>;
const FileIcon = () => <File size={16} className="tree-svg"/>;
export function FileTree({ root, entries = [], loading, error, mode = "tree", canBack, onBack, onToggleDir, onOpenFile, onRefresh, onCreateFile, onCreateDirectory, onDeleteFile, onDeleteDirectory, gitFiles, }) {
    const [contextMenu, setContextMenu] = useState(null);
    const [newItemInput, setNewItemInput] = useState(null);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef(null);
    const treeRef = useRef(null);
    const safeEntries = entries ?? [];
    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener("click", handleClickOutside);
            return () => document.removeEventListener("click", handleClickOutside);
        }
    }, [contextMenu]);
    // Focus input when showing new item input
    useEffect(() => {
        if (newItemInput && inputRef.current) {
            inputRef.current.focus();
        }
    }, [newItemInput]);
    const handleContextMenu = useCallback((e, node, isRoot = false) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            node,
            isRoot,
        });
    }, []);
    const handleNewFile = useCallback((parentPath, depth) => {
        setContextMenu(null);
        setNewItemInput({ parentPath, type: "file", depth });
        setInputValue("");
    }, []);
    const handleNewFolder = useCallback((parentPath, depth) => {
        setContextMenu(null);
        setNewItemInput({ parentPath, type: "dir", depth });
        setInputValue("");
    }, []);
    const handleDelete = useCallback((node) => {
        setContextMenu(null);
        if (node.type === "dir") {
            if (window.confirm(`フォルダ "${node.name}" を削除しますか？\n中のファイルも全て削除されます。`)) {
                onDeleteDirectory?.(node.path);
            }
        }
        else {
            if (window.confirm(`ファイル "${node.name}" を削除しますか？`)) {
                onDeleteFile?.(node.path);
            }
        }
    }, [onDeleteFile, onDeleteDirectory]);
    const handleInputSubmit = useCallback(() => {
        if (!newItemInput || !inputValue.trim()) {
            setNewItemInput(null);
            return;
        }
        const name = inputValue.trim();
        // Validate filename
        const validation = validateFileName(name);
        if (!validation.valid) {
            alert(validation.error || "無効なファイル名です");
            setInputValue("");
            inputRef.current?.focus();
            return;
        }
        if (newItemInput.type === "file") {
            onCreateFile?.(newItemInput.parentPath, name);
        }
        else {
            onCreateDirectory?.(newItemInput.parentPath, name);
        }
        setNewItemInput(null);
        setInputValue("");
    }, [newItemInput, inputValue, onCreateFile, onCreateDirectory]);
    const handleInputKeyDown = useCallback((e) => {
        if (e.key === "Enter") {
            handleInputSubmit();
        }
        else if (e.key === "Escape") {
            setNewItemInput(null);
        }
    }, [handleInputSubmit]);
    const renderNewItemInput = (depth) => {
        if (!newItemInput || newItemInput.depth !== depth)
            return null;
        return (<div className="tree-row tree-input-row" style={{ paddingLeft: 12 + depth * 16 }}>
        <span className="tree-icon" aria-hidden="true">
          {newItemInput.type === "dir" ? <FolderIcon /> : <FileIcon />}
        </span>
        <input ref={inputRef} type="text" className="tree-input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleInputKeyDown} onBlur={handleInputSubmit} placeholder={newItemInput.type === "dir" ? "フォルダ名" : "ファイル名"}/>
      </div>);
    };
    const renderEntries = (nodeEntries, depth) => nodeEntries.map((entry) => {
        const gitClass = entry.type === "file" ? getGitStatusClass(entry.path, gitFiles) : "";
        return (<div key={entry.path}>
          <button type="button" className={`tree-row ${entry.type === "dir" ? "is-dir" : ""} ${mode === "tree" && entry.expanded ? "is-open" : ""} ${gitClass}`} style={{ paddingLeft: 12 + depth * 16 }} onClick={() => (entry.type === "dir" ? onToggleDir(entry) : onOpenFile(entry))} onContextMenu={(e) => handleContextMenu(e, entry)} aria-expanded={entry.type === "dir" && mode === "tree" ? entry.expanded : undefined} title={entry.path}>
            <span className="tree-chevron" aria-hidden="true">
              {entry.type === "dir" ? <ChevronIcon /> : null}
            </span>
            <span className={`tree-icon ${entry.type}`} aria-hidden="true">
              {entry.type === "dir" ? <FolderIcon /> : <FileIcon />}
            </span>
            <span className="tree-label">{entry.name}</span>
            {entry.loading ? <span className="tree-meta">{LABEL_LOADING}</span> : null}
          </button>
          {mode === "tree" && entry.expanded && entry.type === "dir" && (<>
              {newItemInput?.parentPath === entry.path && renderNewItemInput(depth + 1)}
              {entry.children &&
                    entry.children.length > 0 &&
                    renderEntries(entry.children, depth + 1)}
            </>)}
        </div>);
    });
    return (<section className="panel file-tree" ref={treeRef}>
      <div className="panel-header">
        <div>
          <div className="panel-title">{LABEL_FILES}</div>
          <div className="panel-subtitle">{root}</div>
        </div>
        <div className="tree-actions">
          {onBack ? (<button type="button" className="chip" onClick={onBack} disabled={canBack === false}>
              {LABEL_BACK}
            </button>) : null}
          <button type="button" className="chip" onClick={onRefresh}>
            {LABEL_REFRESH}
          </button>
        </div>
      </div>
      <div className="panel-body tree-body" onContextMenu={(e) => handleContextMenu(e, null, true)}>
        {loading ? <div className="tree-state">{LABEL_LOADING}</div> : null}
        {error ? <div className="tree-state error">{error}</div> : null}
        {safeEntries.length === 0 && !loading ? (<div className="tree-state">{LABEL_EMPTY}</div>) : null}
        {newItemInput?.parentPath === "" && renderNewItemInput(0)}
        {renderEntries(safeEntries, 0)}
      </div>

      {/* Context Menu */}
      {contextMenu && (<div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          {(contextMenu.isRoot || contextMenu.node?.type === "dir") && (<>
              <button type="button" className="context-menu-item" onClick={() => handleNewFile(contextMenu.node?.path || "", contextMenu.node ? 1 : 0)}>
                新規ファイル
              </button>
              <button type="button" className="context-menu-item" onClick={() => handleNewFolder(contextMenu.node?.path || "", contextMenu.node ? 1 : 0)}>
                新規フォルダ
              </button>
            </>)}
          {contextMenu.node && !contextMenu.isRoot && (<>
              {contextMenu.node.type === "dir" && <div className="context-menu-separator"/>}
              <button type="button" className="context-menu-item delete" onClick={() => handleDelete(contextMenu.node)}>
                削除
              </button>
            </>)}
        </div>)}
    </section>);
}
