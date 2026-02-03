import { API_BASE } from "./constants";
const HTTP_STATUS_NO_CONTENT = 204;
/**
 * Makes an HTTP request to the API
 * @param path - API endpoint path
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws Error if request fails
 */
async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed (${response.status})`);
    }
    if (response.status === HTTP_STATUS_NO_CONTENT) {
        return undefined;
    }
    // Type assertion is safe here because we validate the response status
    // and the caller is responsible for providing the correct type parameter
    const data = await response.json();
    return data;
}
const CONTENT_TYPE_JSON = "application/json";
const HTTP_METHOD_POST = "POST";
const HTTP_METHOD_PUT = "PUT";
const HTTP_METHOD_DELETE = "DELETE";
/**
 * Converts HTTP(S) base URL to WebSocket URL
 */
export function getWsBase() {
    const base = API_BASE || window.location.origin;
    return base.replace(/^http/, "ws");
}
/**
 * Fetches a one-time WebSocket authentication token
 */
export function getWsToken() {
    return request("/api/ws-token");
}
/**
 * Fetches all workspaces
 */
export function listWorkspaces() {
    return request("/api/workspaces");
}
/**
 * Fetches server configuration
 */
export function getConfig() {
    return request("/api/config");
}
/**
 * Creates a new workspace
 */
export function createWorkspace(path) {
    return request("/api/workspaces", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ path }),
    });
}
/**
 * Fetches all decks
 */
export function listDecks() {
    return request("/api/decks");
}
/**
 * Creates a new deck
 */
export function createDeck(name, workspaceId) {
    return request("/api/decks", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ name, workspaceId }),
    });
}
/**
 * Lists files in a workspace directory
 */
export function listFiles(workspaceId, path = "") {
    const query = new URLSearchParams({ workspaceId, path });
    return request(`/api/files?${query.toString()}`);
}
/**
 * Previews files in a directory (without workspace context)
 */
export function previewFiles(rootPath, subpath = "") {
    const query = new URLSearchParams({ path: rootPath, subpath });
    return request(`/api/preview?${query.toString()}`);
}
/**
 * Reads the contents of a file
 */
export function readFile(workspaceId, path) {
    const query = new URLSearchParams({ workspaceId, path });
    return request(`/api/file?${query.toString()}`);
}
/**
 * Writes contents to a file
 */
export function writeFile(workspaceId, path, contents) {
    return request("/api/file", {
        method: HTTP_METHOD_PUT,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, path, contents }),
    });
}
/**
 * Creates a new file
 */
export function createFile(workspaceId, path, contents = "") {
    return request("/api/file", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, path, contents }),
    });
}
/**
 * Deletes a file
 */
export function deleteFile(workspaceId, path) {
    const query = new URLSearchParams({ workspaceId, path });
    return request(`/api/file?${query.toString()}`, {
        method: HTTP_METHOD_DELETE,
    });
}
/**
 * Creates a new directory
 */
export function createDirectory(workspaceId, path) {
    return request("/api/dir", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, path }),
    });
}
/**
 * Deletes a directory
 */
export function deleteDirectory(workspaceId, path) {
    const query = new URLSearchParams({ workspaceId, path });
    return request(`/api/dir?${query.toString()}`, {
        method: HTTP_METHOD_DELETE,
    });
}
/**
 * Creates a new terminal session
 */
export function createTerminal(deckId, title, command) {
    return request("/api/terminals", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ deckId, title, command }),
    });
}
/**
 * Lists all terminals for a deck
 */
export function listTerminals(deckId) {
    const query = new URLSearchParams({ deckId });
    return request(`/api/terminals?${query.toString()}`);
}
/**
 * Deletes a terminal session
 */
export function deleteTerminal(terminalId) {
    return request(`/api/terminals/${terminalId}`, {
        method: HTTP_METHOD_DELETE,
    });
}
/**
 * Fetches Git status for a workspace or specific repo within workspace
 */
export function getGitStatus(workspaceId, repoPath) {
    const params = { workspaceId };
    if (repoPath !== undefined) {
        params.repoPath = repoPath;
    }
    const query = new URLSearchParams(params);
    return request(`/api/git/status?${query.toString()}`);
}
/**
 * Lists all git repositories within a workspace
 */
export function getGitRepos(workspaceId) {
    const query = new URLSearchParams({ workspaceId });
    return request(`/api/git/repos?${query.toString()}`);
}
/**
 * Gets aggregated status from all git repos in a workspace
 */
export function getMultiRepoStatus(workspaceId) {
    const query = new URLSearchParams({ workspaceId });
    return request(`/api/git/multi-status?${query.toString()}`);
}
/**
 * Stages files for commit
 */
export function stageFiles(workspaceId, paths, repoPath) {
    return request("/api/git/stage", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, paths, repoPath }),
    });
}
/**
 * Unstages files from commit
 */
export function unstageFiles(workspaceId, paths, repoPath) {
    return request("/api/git/unstage", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, paths, repoPath }),
    });
}
/**
 * Commits staged changes
 */
export function commitChanges(workspaceId, message, repoPath) {
    return request("/api/git/commit", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, message, repoPath }),
    });
}
/**
 * Discards changes to files
 */
export function discardChanges(workspaceId, paths, repoPath) {
    return request("/api/git/discard", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, paths, repoPath }),
    });
}
/**
 * Gets diff for a file
 */
export function getGitDiff(workspaceId, path, staged, repoPath) {
    const params = {
        workspaceId,
        path,
        staged: staged.toString(),
    };
    if (repoPath !== undefined) {
        params.repoPath = repoPath;
    }
    const query = new URLSearchParams(params);
    return request(`/api/git/diff?${query.toString()}`);
}
/**
 * Pushes commits to remote
 */
export function pushChanges(workspaceId, repoPath) {
    return request("/api/git/push", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, repoPath }),
    });
}
/**
 * Pulls changes from remote
 */
export function pullChanges(workspaceId, repoPath) {
    return request("/api/git/pull", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, repoPath }),
    });
}
/**
 * Fetches from remote
 */
export function fetchChanges(workspaceId, repoPath) {
    return request("/api/git/fetch", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, repoPath }),
    });
}
/**
 * Gets branch status (ahead/behind)
 */
export function getBranchStatus(workspaceId, repoPath) {
    const params = { workspaceId };
    if (repoPath !== undefined) {
        params.repoPath = repoPath;
    }
    const query = new URLSearchParams(params);
    return request(`/api/git/branch-status?${query.toString()}`);
}
/**
 * Gets remote configuration
 */
export function getGitRemotes(workspaceId, repoPath) {
    const params = { workspaceId };
    if (repoPath !== undefined) {
        params.repoPath = repoPath;
    }
    const query = new URLSearchParams(params);
    return request(`/api/git/remotes?${query.toString()}`);
}
/**
 * Lists all branches
 */
export function listBranches(workspaceId, repoPath) {
    const params = { workspaceId };
    if (repoPath !== undefined) {
        params.repoPath = repoPath;
    }
    const query = new URLSearchParams(params);
    return request(`/api/git/branches?${query.toString()}`);
}
/**
 * Checkout a branch
 */
export function checkoutBranch(workspaceId, branchName, repoPath) {
    return request("/api/git/checkout", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, branchName, repoPath }),
    });
}
/**
 * Create a new branch
 */
export function createBranch(workspaceId, branchName, checkout = true, repoPath) {
    return request("/api/git/create-branch", {
        method: HTTP_METHOD_POST,
        headers: { "Content-Type": CONTENT_TYPE_JSON },
        body: JSON.stringify({ workspaceId, branchName, checkout, repoPath }),
    });
}
/**
 * Get git log
 */
export function getGitLog(workspaceId, limit = 50, repoPath) {
    const params = { workspaceId, limit: String(limit) };
    if (repoPath !== undefined) {
        params.repoPath = repoPath;
    }
    const query = new URLSearchParams(params);
    return request(`/api/git/log?${query.toString()}`);
}
