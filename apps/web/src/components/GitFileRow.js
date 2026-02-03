import { Minus, Plus, X } from "lucide-react";
const LABEL_STAGE = "ステージ";
const LABEL_UNSTAGE = "アンステージ";
const LABEL_DISCARD = "変更を破棄";
const LABEL_VIEW_DIFF = "差分を表示";
const STATUS_LABELS = {
    modified: "M",
    staged: "A",
    untracked: "U",
    deleted: "D",
    renamed: "R",
    conflicted: "C",
};
export function GitFileRow({ file, onStage, onUnstage, onDiscard, onShowDiff }) {
    const statusClass = `git-${file.status}`;
    const statusLabel = STATUS_LABELS[file.status];
    return (<div className="git-file-row">
      <button type="button" className="git-file-main" onClick={() => onShowDiff(file)} title={LABEL_VIEW_DIFF}>
        <span className={`git-status-badge ${statusClass}`}>{statusLabel}</span>
        <span className="git-file-path">{file.path}</span>
      </button>
      <div className="git-file-actions">
        {file.staged ? (<button type="button" className="git-action-btn" onClick={() => onUnstage(file.path)} title={LABEL_UNSTAGE}>
            <Minus size={14}/>
          </button>) : (<>
            <button type="button" className="git-action-btn" onClick={() => onDiscard(file.path)} title={LABEL_DISCARD}>
              <X size={14}/>
            </button>
            <button type="button" className="git-action-btn" onClick={() => onStage(file.path)} title={LABEL_STAGE}>
              <Plus size={14}/>
            </button>
          </>)}
      </div>
    </div>);
}
