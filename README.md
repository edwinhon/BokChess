# BokChess

A Chinese Chess (Xiangqi) web application built with Next.js 15, featuring:

- **Local multiplayer** — two players on the same screen
- **Online multiplayer** — real-time games via WebSocket (Socket.IO)
- **Human vs AI** — play against the [Pikafish](https://github.com/pikafish/pikafish) engine at multiple difficulty levels
- **Learning Mode** — evaluation bar and score tracking when playing vs AI

## Prerequisites

- **Node.js** 18+
- **Pikafish engine binary** — place the `Pikafish.2026-01-02/` folder in the project root (it should contain `pikafish.nnue` and the platform binaries under `Windows/`, `Linux/`, `MacOS/`)

## Setup

```bash
# Install dependencies
npm install

# Set the Pikafish binary path for your platform
# Windows (PowerShell):
$env:PIKAFISH_PATH = ".\Pikafish.2026-01-02\Windows\pikafish-bmi2.exe"

# Linux:
export PIKAFISH_PATH="./Pikafish.2026-01-02/Linux/pikafish-avx2"

# macOS:
export PIKAFISH_PATH="./Pikafish.2026-01-02/MacOS/pikafish-apple-silicon"

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Pikafish Debug Logging & Analysis

The server logs all Pikafish UCI communication with structured prefixes and ISO 8601 timestamps for easy filtering and post-game analysis.

### Log prefixes

| Prefix | Content |
|---|---|
| `[pikafish:uci]` | Raw UCI protocol lines from the engine stdout (`info depth...`, `bestmove...`, `id name...`) |
| `[pikafish:cmd]` | Commands sent to the engine and their completion status |
| `[pikafish:search]` | Search lifecycle: FEN position, GO parameters, start/end markers |
| `[pikafish:info]` | Parsed info lines — one per depth level with score, nodes, time, PV |
| `[pikafish:result]` | Structured result summary after each search |
| `[pikafish:parse]` | Move decoding and info line counts |
| `[pikafish:stderr]` | Engine stderr output |
| `[pikafish:lifecycle]` | Engine boot, NNUE load, shutdown |
| `[pikafish:err]` | Errors and timeouts |
| `[api/ai]` | API response summary with move, score, nodes, PV |

### Capturing logs to a file

```bash
# PowerShell — capture all output to a file
npm run dev 2>&1 | Tee-Object -FilePath pikafish-debug.log

# Bash / Linux / macOS — capture all output to a file
npm run dev 2>&1 | tee pikafish-debug.log
```

### Filtering logs for analysis

```bash
# View only raw engine output (UCI protocol)
grep "pikafish:uci" pikafish-debug.log

# View search result summaries (one per AI move)
grep "pikafish:result" pikafish-debug.log

# View parsed info lines (depth-by-depth evaluation)
grep "pikafish:info" pikafish-debug.log

# Extract all scores over time
grep "pikafish:result" pikafish-debug.log | grep -oP 'score=\K[-\d]+'

# View FEN positions sent to the engine
grep "FEN:" pikafish-debug.log

# View API-level responses
grep "api/ai" pikafish-debug.log

# Count searches per second (engine performance)
grep "SEARCH.*END" pikafish-debug.log | wc -l

# Find all errors
grep "pikafish:err" pikafish-debug.log
```

### Example log output

```
[pikafish:lifecycle] [2026-06-07T12:00:00.000Z] booting engine at C:\...\pikafish-bmi2.exe
[pikafish:lifecycle] [2026-06-07T12:00:00.500Z] engine ready
[pikafish:search] [2026-06-07T12:00:05.000Z] === SEARCH #1 START ===
[pikafish:search] [2026-06-07T12:00:05.000Z] color=black skillLevel=10 hash=64MB threads=1 moveTime=3000ms
[pikafish:search] [2026-06-07T12:00:05.001Z] FEN: rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b
[pikafish:cmd]    [2026-06-07T12:00:05.001Z] > position fen rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b
[pikafish:cmd]    [2026-06-07T12:00:05.002Z] > go movetime 3000
[pikafish:uci]    [2026-06-07T12:00:05.100Z] info depth 1 score cp 15 nodes 42 time 5 pv b9c7
[pikafish:info]   [2026-06-07T12:00:05.100Z] depth=1 cp=15 nodes=42 time=5ms pv=[b9c7]
[pikafish:uci]    [2026-06-07T12:00:05.300Z] info depth 2 score cp 20 nodes 180 time 12 pv b9c7 h2e2
[pikafish:info]   [2026-06-07T12:00:05.300Z] depth=2 cp=20 nodes=180 time=12ms pv=[b9c7,h2e2]
...
[pikafish:uci]    [2026-06-07T12:00:08.000Z] bestmove b9c7
[pikafish:result] [2026-06-07T12:00:08.000Z] === SEARCH #1 RESULT ===
[pikafish:result] [2026-06-07T12:00:08.000Z] bestmove=(0,1)->(2,2) score=15 depth=12 nodes=450000 time=3000ms pv=[b9c7,h2e2,...]
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests once |
| `npm run test:watch` | Run Vitest in watch mode |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS 4, Lucide icons
- **State**: Zustand
- **AI Engine**: Pikafish (UCI-compatible Chinese Chess engine via child process)
- **Multiplayer**: Socket.IO
- **Testing**: Vitest
