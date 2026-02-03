/**
 * State management utilities
 */
/**
 * Creates an empty workspace state object
 */
export function createEmptyWorkspaceState() {
    return {
        files: [],
        activeFileId: null,
        tree: [],
        treeLoading: false,
        treeError: null,
    };
}
/**
 * Creates an empty deck state object
 */
export function createEmptyDeckState() {
    return {
        terminals: [],
        terminalsLoaded: false,
    };
}
