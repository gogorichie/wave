# Copilot Instructions for Stadium Wave Game

## Project Overview
- **Stadium Wave Game** is a browser-based game simulating the stadium "wave" using a hybrid Python (Pyodide) and JavaScript architecture.
- **Game logic** (state, rules, scoring, wave propagation) is implemented in Python (`game_engine.py`), executed in-browser via Pyodide. If Pyodide is unavailable, a JavaScript mock engine (`mock_engine.js`) provides identical APIs for seamless fallback.
- **Rendering/UI** is handled by JavaScript (`main.js`) using HTML5 Canvas, with all user interaction and animation logic in JS.

## Key Components
- `game_engine.py`: Python game logic, state management, and API functions for JS integration.
- `mock_engine.js`: JS fallback engine, mirrors Python API for offline/demo use.
- `main.js`: JS entry point, manages Pyodide loading, engine selection, rendering, and user input.
- `index.html`: UI layout, canvas, and controls. Loads Pyodide from CDN.
- `tests/`: Python unit tests (`test_game_engine.py`) and Playwright E2E tests (`e2e/game.spec.js`).

## Developer Workflows
- **Start Dev Server:** `npm run dev` (Vite, serves at http://localhost:3000)
- **Build Production:** `npm run build` (output in `dist/`)
- **Preview Build:** `npm run preview`
- **Python Unit Tests:** `npm test` (runs pytest on `tests/`)
- **E2E Tests:** `npm run test:e2e` (requires dev server running)

## Engine Integration Pattern
- JS calls Python via Pyodide using `runPython`/`runPythonAsync` for all game state changes.
- If Pyodide fails to load, `useMockEngine` is set and all API calls are routed to `mockGameAPI` (JS implementation).
- Both engines expose the same API: `init_game`, `update_game`, `start_wave_at`, `boost_sector_energy`, `get_game_state`, `get_events`, `save_game`, `load_game`.
- Game state is always serialized as JSON for JS rendering.

## UI/Interaction Patterns
- Canvas-based stadium rendering; sector states visualized by color and animation.
- User actions:
  - Left-click sector: start wave at that sector
  - Right-click sector: boost energy
  - Spacebar: start wave at sector 0
  - Save/Load buttons: persist game state to localStorage
- HUD and notifications are DOM elements updated by JS.

## Testing & Conventions
- **Python:** All game logic is tested in `tests/test_game_engine.py` (pytest, class-based, ~20 tests).
- **E2E:** Playwright tests in `tests/e2e/game.spec.js` cover UI, loading, and gameplay flows.
- **Pyodide fallback:** Always ensure both Python and JS engines remain API-compatible.
- **No backend/server:** All logic runs client-side; persistence is via localStorage only.

## Notable Patterns
- **Engine fallback** is automatic and transparent to the user.
- **Game state** is always passed as JSON between Python/JS.
- **Sector state machine:** idle → anticipating → standing → seated, with energy/fatigue/distraction affecting readiness.
- **Wave propagation** is clockwise, with combo/bonus logic in both engines.

## Example: Adding a New Game Mechanic
- Update both `game_engine.py` and `mock_engine.js` to keep APIs in sync.
- Expose new Python functions via Pyodide and mirror them in the JS mock.
- Update `main.js` to call new APIs and handle new events.
- Add/extend tests in both Python and Playwright as needed.

## References
- See `README.md` for gameplay, architecture, and setup details.
- See `game_engine.py` and `mock_engine.js` for engine API contracts.
- See `main.js` for integration and rendering logic.
