import { useCallback, useState } from "react";
import { createEmptyDeckState } from "../utils";
export const useDeckState = () => {
    const [deckStates, setDeckStates] = useState({});
    const updateDeckState = useCallback((deckId, updater) => {
        setDeckStates((prev) => {
            const current = prev[deckId] || createEmptyDeckState();
            return { ...prev, [deckId]: updater(current) };
        });
    }, []);
    const initializeDeckStates = useCallback((deckIds) => {
        setDeckStates((prev) => {
            const next = { ...prev };
            deckIds.forEach((id) => {
                if (!next[id]) {
                    next[id] = createEmptyDeckState();
                }
            });
            return next;
        });
    }, []);
    return {
        deckStates,
        setDeckStates,
        updateDeckState,
        initializeDeckStates,
    };
};
