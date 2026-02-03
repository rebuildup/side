import { useEffect, useMemo, useState } from "react";
import { previewFiles } from "../api";
import { getErrorMessage, getParentPath, joinPath, toTreeNodes } from "../utils";
import { FileTree } from "./FileTree";
export const WorkspaceModal = ({ isOpen, defaultRoot, onSubmit, onClose }) => {
    const [workspacePathDraft, setWorkspacePathDraft] = useState("");
    const [previewTree, setPreviewTree] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const previewRoot = workspacePathDraft.trim() || defaultRoot;
    const canPreviewBack = useMemo(() => {
        if (!previewRoot)
            return false;
        return getParentPath(previewRoot) !== previewRoot;
    }, [previewRoot]);
    useEffect(() => {
        if (!isOpen) {
            setPreviewTree([]);
            setPreviewLoading(false);
            setPreviewError(null);
            return;
        }
        let alive = true;
        setPreviewLoading(true);
        setPreviewError(null);
        previewFiles(previewRoot, "")
            .then((entries) => {
            if (!alive)
                return;
            setPreviewTree(toTreeNodes(entries));
            setPreviewLoading(false);
        })
            .catch((error) => {
            if (!alive)
                return;
            setPreviewError(getErrorMessage(error));
            setPreviewLoading(false);
        });
        return () => {
            alive = false;
        };
    }, [isOpen, previewRoot]);
    useEffect(() => {
        if (!isOpen)
            return;
        if (workspacePathDraft.trim())
            return;
        if (defaultRoot) {
            setWorkspacePathDraft(defaultRoot);
        }
    }, [defaultRoot, isOpen, workspacePathDraft]);
    const handlePreviewRefresh = () => {
        if (!isOpen)
            return;
        setPreviewLoading(true);
        setPreviewError(null);
        previewFiles(previewRoot, "")
            .then((entries) => {
            setPreviewTree(toTreeNodes(entries));
            setPreviewLoading(false);
        })
            .catch((error) => {
            setPreviewError(getErrorMessage(error));
            setPreviewLoading(false);
        });
    };
    const handlePreviewToggleDir = (node) => {
        if (node.type !== "dir")
            return;
        const nextPath = joinPath(previewRoot, node.name);
        setWorkspacePathDraft(nextPath);
    };
    const handlePreviewBack = () => {
        if (!previewRoot)
            return;
        const parent = getParentPath(previewRoot);
        if (parent && parent !== previewRoot) {
            setWorkspacePathDraft(parent);
        }
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        await onSubmit(workspacePathDraft);
        setWorkspacePathDraft("");
    };
    if (!isOpen)
        return null;
    return (<div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">
          {"\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8ffd\u52a0"}
        </div>
        <label className="field">
          <span>{"\u30d1\u30b9"}</span>
          <input type="text" value={workspacePathDraft} placeholder={defaultRoot || ""} onChange={(event) => setWorkspacePathDraft(event.target.value)}/>
        </label>
        <div className="modal-explorer">
          <FileTree root={previewRoot} entries={previewTree} loading={previewLoading} error={previewError} mode="navigator" canBack={canPreviewBack} onBack={handlePreviewBack} onToggleDir={handlePreviewToggleDir} onOpenFile={() => undefined} onRefresh={handlePreviewRefresh}/>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            {"\u30ad\u30e3\u30f3\u30bb\u30eb"}
          </button>
          <button type="submit" className="primary-button">
            {"\u8ffd\u52a0"}
          </button>
        </div>
      </form>
    </div>);
};
