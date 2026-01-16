import type { FileTreeNode } from '../types';

const renderEntries = (
  entries: FileTreeNode[],
  depth: number,
  onToggleDir: (node: FileTreeNode) => void,
  onOpenFile: (node: FileTreeNode) => void
): JSX.Element[] =>
  entries.map((entry) => (
    <div key={entry.path}>
      <button
        type="button"
        className={`tree-row ${entry.type === 'dir' ? 'is-dir' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() =>
          entry.type === 'dir' ? onToggleDir(entry) : onOpenFile(entry)
        }
      >
        <span className="tree-icon">
          {entry.type === 'dir' ? (entry.expanded ? '▾' : '▸') : '•'}
        </span>
        <span className="tree-label">{entry.name}</span>
        {entry.loading ? <span className="tree-meta">Loading...</span> : null}
      </button>
      {entry.expanded && entry.children && entry.children.length > 0
        ? renderEntries(entry.children, depth + 1, onToggleDir, onOpenFile)
        : null}
    </div>
  ));

interface FileTreeProps {
  root: string;
  entries?: FileTreeNode[];
  loading?: boolean;
  error?: string | null;
  onToggleDir: (node: FileTreeNode) => void;
  onOpenFile: (node: FileTreeNode) => void;
  onRefresh: () => void;
}

export function FileTree({
  root,
  entries = [],
  loading,
  error,
  onToggleDir,
  onOpenFile,
  onRefresh
}: FileTreeProps) {
  const safeEntries = entries ?? [];
  return (
    <section className="panel file-tree">
      <div className="panel-header">
        <div>
          <div className="panel-title">ファイル</div>
          <div className="panel-subtitle">{root}</div>
        </div>
        <button type="button" className="chip" onClick={onRefresh}>
          更新
        </button>
      </div>
      <div className="panel-body tree-body">
        {loading ? <div className="tree-state">読み込み中...</div> : null}
        {error ? <div className="tree-state error">{error}</div> : null}
        {safeEntries.length === 0 && !loading ? (
          <div className="tree-state">ファイルが見つかりません。</div>
        ) : null}
        {renderEntries(safeEntries, 0, onToggleDir, onOpenFile)}
      </div>
    </section>
  );
}
