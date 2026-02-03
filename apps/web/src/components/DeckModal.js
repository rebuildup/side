import { useEffect, useRef, useState } from "react";
export const DeckModal = ({ isOpen, workspaces, onSubmit, onClose }) => {
    const [deckWorkspaceId, setDeckWorkspaceId] = useState(workspaces[0]?.id || "");
    const [deckNameDraft, setDeckNameDraft] = useState("");
    const modalRef = useRef(null);
    const formRef = useRef(null);
    const firstInputRef = useRef(null);
    // Focus trap implementation
    useEffect(() => {
        if (!isOpen)
            return;
        // Focus first input when modal opens
        firstInputRef.current?.focus();
        // Handle tab key for focus trap
        const handleTabKey = (e) => {
            if (e.key !== "Tab")
                return;
            const focusableElements = modalRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [];
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement?.focus();
                    e.preventDefault();
                }
            }
            else {
                if (document.activeElement === lastElement) {
                    firstElement?.focus();
                    e.preventDefault();
                }
            }
        };
        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("keydown", handleTabKey);
        document.addEventListener("keydown", handleEscape);
        // Prevent body scroll when modal is open
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleTabKey);
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose]);
    useEffect(() => {
        if (isOpen && workspaces.length > 0 && !deckWorkspaceId) {
            setDeckWorkspaceId(workspaces[0].id);
        }
    }, [isOpen, workspaces, deckWorkspaceId]);
    const handleSubmit = async (event) => {
        event.preventDefault();
        await onSubmit(deckNameDraft.trim(), deckWorkspaceId);
        setDeckNameDraft("");
    };
    if (!isOpen)
        return null;
    return (<div className="modal-backdrop" role="dialog" aria-modal="true" ref={modalRef}>
      <form className="modal" onSubmit={handleSubmit} ref={formRef}>
        <div className="modal-title">{"\u30c7\u30c3\u30ad\u4f5c\u6210"}</div>
        <label className="field">
          <span>{"\u30c7\u30c3\u30ad\u540d (\u4efb\u610f)"}</span>
          <input ref={firstInputRef} type="text" value={deckNameDraft} placeholder={"\u7a7a\u767d\u306e\u307e\u307e\u3067\u3082OK"} onChange={(event) => setDeckNameDraft(event.target.value)}/>
        </label>
        <label className="field">
          <span>{"\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9"}</span>
          <select value={deckWorkspaceId} onChange={(event) => setDeckWorkspaceId(event.target.value)}>
            {workspaces.map((workspace) => (<option key={workspace.id} value={workspace.id}>
                {workspace.path}
              </option>))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            {"\u30ad\u30e3\u30f3\u30bb\u30eb"}
          </button>
          <button type="submit" className="primary-button">
            {"\u4f5c\u6210"}
          </button>
        </div>
      </form>
    </div>);
};
