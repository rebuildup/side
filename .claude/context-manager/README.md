# Claude Context Manager

## Overview

The Context Manager is a modular system for managing Claude Code conversation sessions, context persistence, and output logging. It provides tools for saving, restoring, and analyzing conversation contexts.

## Directory Structure

```
.claude/
├── sessions/           # Session JSON files
├── logs/              # Trimmed output logs
├── context-manager/   # Main directory
│   ├── core/          # Core session management
│   ├── storage/       # Storage layer implementations
│   ├── cli/           # CLI commands
│   ├── analyzers/     # Context analysis tools
│   └── formatters/    # Output formatting utilities
```

## Usage Examples

### Save a session

```typescript
import { saveSession } from './core/session-manager';

await saveSession({
  id: 'session-20240203-001',
  timestamp: new Date().toISOString(),
  messages: [...],
  metadata: { project: 'my-app', tags: ['bugfix'] }
});
```

### Restore a session

```typescript
import { restoreSession } from './core/session-manager';

const session = await restoreSession('session-20240203-001');
```

### List sessions

```bash
npx context-manager list
npx context-manager list --tag bugfix
```

### Analyze context

```typescript
import { analyzeContext } from './analyzers/context-analyzer';

const analysis = await analyzeContext(session);
console.log(alysis.summary); // Token usage, topic clusters, etc.
```

## Components

### Core (`core/`)
- `session-manager.ts` - Main session CRUD operations
- `context-tracker.ts` - Track conversation context changes
- `session-merger.ts` - Merge multiple sessions

### Storage (`storage/`)
- `storage-interface.ts` - Abstract storage interface
- `file-storage.ts` - Filesystem-based storage
- `memory-storage.ts` - In-memory storage for testing

### CLI (`cli/`)
- `commands.ts` - CLI command definitions
- `index.ts` - CLI entry point

### Analyzers (`analyzers/`)
- `context-analyzer.ts` - Analyze session patterns
- `token-estimator.ts` - Estimate token usage

### Formatters (`formatters/`)
- `markdown-formatter.ts` - Export to Markdown
- `json-formatter.ts` - Export to JSON
