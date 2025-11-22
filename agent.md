# Agent Guide: Stadium Wave Game 🏟️

This document is for OpenAI Codex and similar AI coding agents working on the **Stadium Wave Game** project.

## Essential Guidance for Codex Agents

- **Hybrid engine:** Game logic runs in-browser via Python (`game_engine.py` with Pyodide) or, if unavailable, a JS mock (`mock_engine.js`). Both must expose the same API and remain in sync.
- **Rendering/UI:** All user interaction, animation, and rendering is in JS (`main.js`) using HTML5 Canvas. Game state is always passed as JSON between Python and JS.
- **Persistence:** Game state and scores are saved to browser `localStorage` (no backend).

### Key Files
- `game_engine.py`: Python game logic, state machine, scoring, and API for JS integration
- `mock_engine.js`: JS fallback engine, mirrors Python API contract
- `main.js`: Handles Pyodide loading, engine selection, rendering, and user input
- `index.html`: UI layout, canvas, and controls (loads Pyodide from CDN)
- `tests/test_game_engine.py`: Python unit tests for game logic
- `tests/e2e/game.spec.js`: Playwright E2E tests for UI and gameplay

### Integration & Security
- JS calls Python via Pyodide using `runPython`/`runPythonAsync` for all game state changes
- **Security:** Always use `pyodide.globals.set('param', value)` and then `pyodide.runPython('func(param)')` (never string interpolation) to prevent code injection
- If Pyodide fails to load, set `useMockEngine` and route all API calls to `mockGameAPI` (identical API)
- Exposed engine API: `init_game`, `update_game`, `start_wave_at`, `boost_sector_energy`, `get_game_state`, `get_events`, `save_game`, `load_game`

### Developer Workflows
- **Start dev server:** `npm run dev` (Vite, opens at http://localhost:3000)
- **Build production:** `npm run build` (output in `dist/`)
- **Preview build:** `npm run preview`
- **Python unit tests:** `npm test` (pytest on `tests/`)
- **E2E tests:** `npm run test:e2e` (requires dev server)

### Project Conventions
- **Engine fallback** is automatic and transparent
- **Game state** is always JSON between Python/JS
- **Sector state machine:** idle → anticipating → standing → seated, with energy/fatigue/distraction
- **Wave propagation:** always clockwise, with combo/bonus logic in both engines
- **No backend/server:** All logic is client-side

### Extending the Game
- When adding new mechanics, update both `game_engine.py` and `mock_engine.js` to keep APIs in sync
- Expose new Python functions via Pyodide and mirror in JS mock
- Update `main.js` for new APIs/events
- Add/extend tests in both Python and Playwright

### References
- See `.github/copilot-instructions.md` for the canonical, up-to-date agent instructions
- See `README.md` for gameplay, architecture, and setup details
- See `game_engine.py` and `mock_engine.js` for engine API contracts
- See `main.js` for integration and rendering logic
### 2.3 Persistence


