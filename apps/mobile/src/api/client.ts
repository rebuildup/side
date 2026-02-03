// API client for Deck IDE mobile app
// Handles REST API calls and WebSocket connections

const DEFAULT_SERVER_URL = "http://localhost:8080";

export class DeckIDEClient {
  private baseUrl: string;
  private wsUrl: string;

  constructor(serverUrl: string) {
    this.baseUrl = `${serverUrl}/api`;
    this.wsUrl = `${serverUrl.replace("http", "ws")}/ws`;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as T;
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as T;
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as T;
  }

  connectWebSocket(
    token: string,
    callbacks: {
      onMessage: (data: string) => void;
      onError: (error: Event) => void;
      onClose: () => void;
    }
  ): WebSocket {
    const ws = new WebSocket(`${this.wsUrl}?token=${token}`);
    ws.onmessage = (event) => callbacks.onMessage(event.data);
    ws.onerror = (error) => callbacks.onError(error);
    ws.onclose = () => callbacks.onClose();
    return ws;
  }

  async getWsToken(terminalId: string): Promise<string> {
    return this.post<{ token: string }>("/ws/token", { terminalId }).then((r) => r.token);
  }
}

let clientInstance: DeckIDEClient | null = null;

export function getClient(serverUrl?: string): DeckIDEClient {
  if (!clientInstance && serverUrl) {
    clientInstance = new DeckIDEClient(serverUrl);
  }
  if (!clientInstance) {
    // Use default for development
    clientInstance = new DeckIDEClient(DEFAULT_SERVER_URL);
  }
  return clientInstance;
}

export function setServerUrl(serverUrl: string): void {
  clientInstance = new DeckIDEClient(serverUrl);
}
