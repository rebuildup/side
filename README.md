# S-IDE (Side Studio IDE)

> An intelligent development environment optimized for AI agent workflows with multi-terminal support, Monaco Editor integration, and built-in Git operations.

S-IDE (Side Studio IDE) is designed to maximize AI agent productivity by providing a clean, focused interface with powerful context management capabilities to combat "context rot" in long coding sessions.

---

## Features

### Core Capabilities
- **Multi-Workspace Management** - Add and switch between multiple project directories
- **Deck System** - Create named workspaces (decks) with fixed root paths for organized project management
- **Monaco Editor** - VS Code's powerful editor with syntax highlighting, IntelliSense, and rich editing features
- **Multi-Terminal Support** - Run multiple terminals per deck with drag-reorder capabilities
- **Integrated Git Operations** - Full Git workflow including status, diff, commit, push, pull, branch management
- **File Explorer** - Browse, create, edit, and delete files and directories
- **Split View** - View up to 3 decks simultaneously for multi-project workflows
- **Cross-Platform** - Works on Windows, macOS, and Linux

### Context Manager Features
Deck IDE includes an advanced **Context Manager** system specifically designed to optimize AI agent workflows:

- **Health Score Monitoring** - Real-time assessment of conversation context quality (0-100 scale)
- **Topic Drift Detection** - Identifies when conversations drift from the original topic
- **Session Compaction** - Reduces context bloat by summarizing older messages
- **Snapshot System** - Save and restore conversation states at any point
- **Auto-Compaction** - Automatic context cleanup when thresholds are exceeded
- **Phase Detection** - Identifies conversation phases (planning, implementation, debugging, etc.)
- **Smart Recommendations** - Actionable suggestions based on context analysis

---

## Layout Overview

```
+---------------------------------------------------------------+
|  Side Bar  |  Workspace / Editor Area      |  Terminal Deck  |
|            |                               |                 |
|  - Files   |  +-------------------------+  |  +-----------+  |
|  - Git     |  |   File Explorer /        |  |  | Terminal  |  |
|  - AI     |  |   Monaco Editor          |  |  | Terminal  |  |
|            |  |                         |  |  +-----------+  |
|            |  +-------------------------+  |  +-----------+  |
|            |                               |  | Terminal  |  |
|            |                               |  +-----------+  |
+---------------------------------------------------------------+
```

---

## Installation

### Windows Desktop App (Recommended)

1. Download the latest installer from [Releases](https://github.com/rebuildup/side/releases)
2. Run `S-IDE-Setup-x.x.x.exe`
3. Launch S-IDE from the desktop or Start menu
4. **Note:** Node.js must be installed on your system. The desktop app will automatically start the backend server.

### From Source

```bash
# Clone the repository
git clone https://github.com/rebuildup/side.git
cd side

# Install dependencies
npm install

# Build for production
npm run build:desktop

# Or run in development mode
npm run dev:desktop
```

**Important:** The desktop app automatically starts the backend server when launched. No manual server startup required.

### Web Version

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## Project Structure

```
side/
├── apps/
│   ├── desktop/          # Tauri desktop app (auto-starts server)
│   │   ├── src-tauri/    # Rust backend
│   │   └── package.json
│   ├── mobile/           # React Native mobile app
│   │   ├── src/          # React Native components
│   │   └── package.json
│   ├── server/           # Backend API server (auto-started by desktop)
│   │   ├── src/
│   │   │   ├── routes/   # API routes
│   │   │   ├── middleware/# Express middleware
│   │   │   └── utils/    # Server utilities
│   │   └── package.json
│   └── web/              # Frontend React PWA app
│       ├── src/
│       │   ├── components/# React components
│       │   ├── hooks/    # Custom React hooks
│       │   └── utils/    # Frontend utilities
│       └── package.json
├── packages/
│   ├── shared/           # Shared utilities
│   └── ui/               # Shared UI components
├── .claude/              # Claude Context Manager
│   └── context-manager/  # Context management system
├── data/                 # SQLite database
├── docs/                 # Documentation
├── package.json          # Root package.json
├── LICENSE               # MIT License
├── README.md             # This file
└── SPEC.md               # Project specification
```

---

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Monaco Editor** - Code editor (VS Code's editor)
- **xterm.js** - Terminal emulator
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Hono** - Web framework
- **node-pty** - Pseudo-terminal for Windows
- **simple-git** - Git operations
- **SQLite (node:sqlite)** - Database
- **WebSocket (ws)** - Real-time terminal communication

### Desktop
- **Tauri 2.0** - Desktop framework with Rust backend
- **Rust** - Backend language for desktop app
- **Sidecar Process** - Automatic Node.js server management

---

## Usage Guide

### Desktop App (One-Click Launch)

The desktop app handles everything automatically:

1. **Launch the app** - Double-click `S-IDE.exe` or run from Start menu
2. **Server auto-starts** - The backend server starts automatically on port 8787
3. **Ready to use** - Once loaded, you can create workspaces, open files, and use terminals

**Requirements:**
- Node.js must be installed and in your PATH
- The app will show an error if Node.js is not found

### Adding Workspaces

1. Click "Workspace" button in the sidebar
2. Click the "+" button to add a new workspace
3. Enter the filesystem path (or use the default home directory)
4. Click "Add Workspace"

### Creating Decks

1. Click the "+" button in the terminal deck tabs
2. Enter a name for your deck
3. Select the workspace to associate with the deck
4. Click "Create"

### Using Terminals

Each deck can have multiple terminals:

- **Add Terminal** - Click the "+" button in deck header
- **Add Claude Terminal** - Click "C" button for pre-configured Claude Code terminal
- **Add Codex Terminal** - Click "X" button for Codex terminal
- **Delete Terminal** - Click the "×" button on terminal tab
- **Reorder Terminals** - Drag terminal tabs to reorder

### Git Operations

The Source Control panel provides:

- **Status View** - See modified, staged, and untracked files
- **Multi-Repo Support** - Work with multiple Git repositories in one workspace
- **Stage/Unstage** - Add or remove files from staging
- **Commit** - Commit staged changes with a message
- **Push/Pull** - Sync with remote repositories
- **Branch Management** - Create, checkout, and list branches
- **Diff View** - See side-by-side differences

### Context Manager Usage

#### Health Score

The Context Manager displays a health score (0-100) indicating the quality of your conversation context:

- **80-100 (Excellent)** - Context is clean and focused
- **50-79 (Good)** - Context is healthy but could be optimized
- **30-49 (Warning)** - Context is degrading, consider compacting
- **0-29 (Critical)** - Context is severely degraded, action recommended

#### Topic Drift Detection

Topic drift measures how much the conversation has diverged from the original topic:

- **0-39% (Low)** - Conversation is on-topic
- **40-69% (Medium)** - Some drift detected
- **70-100% (High)** - Significant drift, consider starting a new session

#### Compact Feature

Reduces context bloat by summarizing older messages:

- Click the "Compact" button in Context Manager panel
- Keeps recent messages intact (default: last 50)
- Summarizes older messages into concise summaries
- Saves token space and improves AI focus

#### Snapshot Feature

Save conversation states for later restoration:

- Click "Snapshot" button to save current state
- Each snapshot includes commit hash, timestamp, and health score
- Restore previous snapshots via API

#### Reading the Status Indicator

The compact status bar shows:
- Health score (colored bar)
- Drift percentage
- Quick action buttons (Compact, Snapshot)

---

## Development

### Available Scripts

```bash
# Development (desktop app auto-starts server)
npm run dev:desktop    # Start desktop app with auto-server

# Development (individual components)
npm run dev:web        # Start web dev server
npm run dev:server     # Start server in dev mode (manual)

# Building
npm run build:web      # Build web frontend
npm run build:server   # Build server
npm run build:desktop  # Build all components for desktop

# Production
npm run build          # Build web only
npm run serve          # Build and serve production
```

### Project Setup

```bash
# Install all dependencies
npm install

# Install workspace-specific dependencies
npm --workspace apps/web install
npm --workspace apps/server install
npm --workspace apps/desktop install
```

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DEFAULT_ROOT` | Default workspace path | `os.homedir()` | No |
| `PORT` | Server port | `8787` | No |
| `HOST` | Server host | `0.0.0.0` | No |
| `BASIC_AUTH_USER` | Basic auth username | - | Production |
| `BASIC_AUTH_PASSWORD` | Basic auth password | - | Production |
| `CORS_ORIGIN` | CORS origin | - | Production |
| `NODE_ENV` | Environment | `development` | No |
| `MAX_FILE_SIZE` | Max file size in bytes | `10485760` | No |
| `TERMINAL_BUFFER_LIMIT` | Terminal buffer size | `50000` | No |
| `TRUST_PROXY` | Trust X-Forwarded headers | `false` | No |

---

## API Endpoints

### Workspaces

```
GET    /api/workspaces          - List all workspaces
POST   /api/workspaces          - Create workspace
GET    /api/config              - Get default root config
```

### Decks

```
GET    /api/decks               - List all decks
POST   /api/decks               - Create deck
```

### Files

```
GET    /api/files               - List directory contents
GET    /api/file                - Read file contents
PUT    /api/file                - Write file contents
POST   /api/file                - Create new file
DELETE /api/file                - Delete file
POST   /api/dir                 - Create directory
DELETE /api/dir                 - Delete directory
GET    /api/preview             - Preview directory
```

### Terminals

```
GET    /api/terminals           - List terminals for deck
POST   /api/terminals           - Create terminal
DELETE /api/terminals/:id       - Delete terminal
WS     /api/terminals/:id       - Terminal WebSocket stream
```

### Git

```
GET    /api/git/status          - Get Git status
GET    /api/git/repos           - Find all Git repos
GET    /api/git/multi-status    - Aggregated status from all repos
POST   /api/git/stage           - Stage files
POST   /api/git/unstage         - Unstage files
POST   /api/git/commit          - Commit changes
POST   /api/git/discard         - Discard changes
GET    /api/git/diff            - Get file diff
POST   /api/git/push            - Push to remote
POST   /api/git/pull            - Pull from remote
POST   /api/git/fetch           - Fetch from remote
GET    /api/git/remotes         - List remotes
GET    /api/git/branch-status   - Get branch status
GET    /api/git/branches        - List branches
POST   /api/git/checkout        - Checkout branch
POST   /api/git/create-branch   - Create new branch
GET    /api/git/log             - Get commit history
```

### Context Manager

```
GET    /api/context-manager/status           - Get health status
POST   /api/context-manager/session          - Create new session
GET    /api/context-manager/session          - Get current session
DELETE /api/context-manager/session          - End current session
POST   /api/context-manager/compact          - Compact context
POST   /api/context-manager/snapshot         - Create snapshot
GET    /api/context-manager/snapshots        - List snapshots
GET    /api/context-manager/snapshots/latest - Get latest snapshot
GET    /api/context-manager/snapshots/healthiest - Get healthiest snapshot
POST   /api/context-manager/snapshots/:commitHash/restore - Restore snapshot
GET    /api/context-manager/stats            - Get statistics
GET    /api/context-manager/sessions         - List sessions
GET    /api/context-manager/sessions/:id     - Get specific session
DELETE /api/context-manager/sessions/:id     - Delete session
POST   /api/context-manager/track/message    - Track message
POST   /api/context-manager/track/tool       - Track tool execution
POST   /api/context-manager/track/error      - Track error
GET    /api/context-manager/drift            - Analyze topic drift
POST   /api/context-manager/trim             - Trim conversation output
POST   /api/context-manager/start            - Start monitoring
POST   /api/context-manager/stop             - Stop monitoring
```

---

## Context Manager Deep Dive

### What is Context Rot?

In long AI coding sessions, "context rot" occurs when:

1. **Token bloat** - The conversation history grows too large, reducing relevant context
2. **Topic drift** - The conversation wanders from the original goal
3. **Noise accumulation** - Irrelevant back-and-forth obscures the actual work
4. **Phase mixing** - Planning, implementation, and debugging get intermingled

This leads to:
- Reduced AI accuracy and relevance
- Increased token costs
- Slower response times
- Agent losing track of original objectives

### How the 7 Features Work

#### 1. Health Score (0-100)

Calculated based on:
- Message count and token efficiency
- Topic drift score
- Phase clarity
- Error rate
- Code-to-chat ratio

#### 2. Topic Drift Detection

Uses semantic analysis to compare:
- Initial prompt vs. recent messages
- Keyword clustering over time
- Intent coherence scoring

#### 3. Session Compaction

- Keeps last N messages intact (configurable)
- Summarizes older messages into concise bullet points
- Preserves code blocks and critical decisions
- Reduces token count by 40-60%

#### 4. Snapshot System

- Saves complete conversation state
- Includes health score at snapshot time
- Enables rollback to any point
- Useful for branching experiments

#### 5. Auto-Compaction

- Triggers when health score drops below threshold
- Runs automatically in background
- Preserves recent context
- Optional: manual override

#### 6. Phase Detection

Identifies conversation phases:
- **Planning** - Requirements and architecture discussion
- **Implementation** - Active coding
- **Debugging** - Error fixing and troubleshooting
- **Review** - Code review and optimization

#### 7. Smart Recommendations

Actionable suggestions such as:
- "Consider compacting - health score below 50"
- "Topic drift detected - start new session?"
- "High error rate - verify recent changes"
- "Large files detected - consider splitting"

### When to Use Each Feature

| Situation | Action |
|-----------|--------|
| Health score drops below 50 | Run Compact |
| Topic drift > 70% | Start new session |
| Before major refactor | Create Snapshot |
| After completing feature | Create Snapshot |
| Conversation feels cluttered | Run Trim Output |
| Switching to new feature | Create new session |
| Want to experiment safely | Create Snapshot first |

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Author

**rebuildup** - [GitHub](https://github.com/rebuildup)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## Support

For issues and questions:
- Open an issue on [GitHub Issues](https://github.com/rebuildup/side/issues)
- Check existing documentation in the `docs/` directory
