import type { Deck, FileSystemEntry } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json() as Promise<T>;
}

export function getApiBase(): string {
  return API_BASE || window.location.origin;
}

export function getWsBase(): string {
  const base = API_BASE || window.location.origin;
  return base.replace(/^http/, 'ws');
}

export function listDecks(): Promise<Deck[]> {
  return request<Deck[]>('/api/decks');
}

export function createDeck(name: string): Promise<Deck> {
  return request<Deck>('/api/decks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
}

export function listFiles(path = ''): Promise<FileSystemEntry[]> {
  const query = new URLSearchParams({ path });
  return request<FileSystemEntry[]>(`/api/files?${query.toString()}`);
}

export function readFile(
  path: string
): Promise<{ path: string; contents: string }> {
  const query = new URLSearchParams({ path });
  return request<{ path: string; contents: string }>(
    `/api/file?${query.toString()}`
  );
}

export function writeFile(
  path: string,
  contents: string
): Promise<{ path: string; saved: boolean }> {
  return request<{ path: string; saved: boolean }>('/api/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, contents })
  });
}

export function createTerminal(): Promise<{ id: string }> {
  return request<{ id: string }>('/api/terminals', {
    method: 'POST'
  });
}
