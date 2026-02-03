/**
 * URL and routing utilities
 */
/**
 * Parses URL search parameters into application state
 */
export function parseUrlState() {
    if (typeof window === "undefined") {
        return {
            view: "terminal",
            workspaceId: null,
            deckIds: [],
            workspaceMode: "list",
        };
    }
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    const modeParam = params.get("mode");
    const deckParam = params.get("decks") || params.get("deck");
    const deckIds = deckParam ? deckParam.split(",").filter(Boolean) : [];
    return {
        view: viewParam === "workspace" ? "workspace" : "terminal",
        workspaceId: params.get("workspace"),
        deckIds,
        workspaceMode: modeParam === "editor" ? "editor" : "list",
    };
}
