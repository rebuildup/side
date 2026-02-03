import { useCallback, useState } from "react";
import { createEmptyWorkspaceState } from "../utils";
export const useWorkspaceState = () => {
    const [workspaceStates, setWorkspaceStates] = useState({});
    const updateWorkspaceState = useCallback((workspaceId, updater) => {
        setWorkspaceStates((prev) => {
            const current = prev[workspaceId] || createEmptyWorkspaceState();
            return { ...prev, [workspaceId]: updater(current) };
        });
    }, []);
    const initializeWorkspaceStates = useCallback((workspaceIds) => {
        setWorkspaceStates((prev) => {
            const next = { ...prev };
            workspaceIds.forEach((id) => {
                if (!next[id]) {
                    next[id] = createEmptyWorkspaceState();
                }
            });
            return next;
        });
    }, []);
    return {
        workspaceStates,
        setWorkspaceStates,
        updateWorkspaceState,
        initializeWorkspaceStates,
    };
};
