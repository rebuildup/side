# Deck IDE

Multi-deck terminal and editor workspace with a fixed default root per deck,
full-screen terminal mode, and a mobile-friendly layout.

## Quick start

1. Install dependencies from the repo root:

```bash
npm install
```

2. Start the API server:

```bash
npm run dev:server
```

3. Start the web client:

```bash
npm run dev:web
```

The web client defaults to `http://localhost:5173` and proxies `/api` to
`http://localhost:8787` during dev.

## Production-ish serve

Build the web client and start the server that serves the static files:

```bash
npm run serve
```

## Environment

- `DEFAULT_ROOT` (server): fixed filesystem root for decks.
- `VITE_DEFAULT_ROOT` (web): default root label used in the UI.
- `VITE_API_BASE` (web): base URL for the API server (leave empty to use Vite proxy).
