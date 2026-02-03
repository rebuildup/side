"use strict";
// API client for Deck IDE mobile app
// Handles REST API calls and WebSocket connections
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckIDEClient = void 0;
exports.getClient = getClient;
exports.setServerUrl = setServerUrl;
const DEFAULT_SERVER_URL = "http://localhost:8080";
class DeckIDEClient {
    baseUrl;
    wsUrl;
    constructor(serverUrl) {
        this.baseUrl = `${serverUrl}/api`;
        this.wsUrl = `${serverUrl.replace("http", "ws")}/ws`;
    }
    async get(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    async post(endpoint, data) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    async delete(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
    connectWebSocket(token, callbacks) {
        const ws = new WebSocket(`${this.wsUrl}?token=${token}`);
        ws.onmessage = (event) => callbacks.onMessage(event.data);
        ws.onerror = (error) => callbacks.onError(error);
        ws.onclose = () => callbacks.onClose();
        return ws;
    }
    async getWsToken(terminalId) {
        return this.post("/ws/token", { terminalId }).then((r) => r.token);
    }
}
exports.DeckIDEClient = DeckIDEClient;
let clientInstance = null;
function getClient(serverUrl) {
    if (!clientInstance && serverUrl) {
        clientInstance = new DeckIDEClient(serverUrl);
    }
    if (!clientInstance) {
        // Use default for development
        clientInstance = new DeckIDEClient(DEFAULT_SERVER_URL);
    }
    return clientInstance;
}
function setServerUrl(serverUrl) {
    clientInstance = new DeckIDEClient(serverUrl);
}
