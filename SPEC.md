# Deck IDE Spec

## Goals
- Create and open multiple decks, including multiple decks that point to the same root.
- Each deck has a fixed default root path that cannot be changed after creation.
- Provide a full-screen terminal mode and multi-pane workspace layout.
- Offer editor capabilities comparable to VS Code via Monaco Editor.
- Work well on mobile with view switching and touch-friendly controls.

## Non-goals (initial release)
- Remote SSH, cloud sync, multi-user collaboration.
- Plugin marketplace or extension system.
- Binary file editing.

## Core concepts
- Deck: saved workspace with a fixed root, layout state, open files, and terminal sessions.
- Root: absolute filesystem path used for file browsing and file IO.
- Panel: UI area for editor, terminal, or file explorer.

## UX flow
1. User creates a deck. Root is set to `DEFAULT_ROOT`.
2. User can create another deck with the same root.
3. Opening a deck shows the file tree rooted at the deck root.
4. Editor tabs and terminals are associated with the active deck.
5. Terminal can be maximized to fill the main workspace area.
6. On mobile, user switches between Decks, Files, Editor, and Terminal.

## Data model (front-end)
```json
{
  "deck": {
    "id": "uuid",
    "name": "Deck A",
    "root": "C:/workspace",
    "openFiles": ["path/to/file"],
    "terminalSessions": ["term-1"],
    "layout": {
      "terminalMaximized": false
    }
  }
}
```

## API
- `GET /api/decks` -> list decks (in-memory in v0).
- `POST /api/decks` -> create deck using `DEFAULT_ROOT`.
- `GET /api/files?path=...` -> list directory entries.
- `GET /api/file?path=...` -> read file contents.
- `PUT /api/file` -> write file contents.
- `POST /api/terminals` -> create terminal session.
- `WS /api/terminals/:id` -> interactive terminal stream.

## Security
- All filesystem operations are constrained under `DEFAULT_ROOT`.
- Reject any path traversal attempts.

## Mobile behavior
- Sidebar collapses into a bottom switcher.
- Primary views (Decks, Files, Editor, Terminal) render full-screen.

## Future work
- Persistent deck storage.
- Layout presets and split panes.
- Project-level settings per deck.
