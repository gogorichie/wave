# Stadium Wave Game 🏟️

A browser-based interactive game where players orchestrate the stadium "wave" by coordinating with AI-controlled crowd sectors to achieve synchronized animations and earn combo points.

[![.github/workflows/ci-cd.yml](https://github.com/gogorichie/wave/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/gogorichie/wave/actions/workflows/ci-cd.yml)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues-closed/gogorichie/wave)
![GitHub top language](https://img.shields.io/github/languages/top/gogorichie/wave)
![GitHub Release](https://img.shields.io/github/v/release/gogorichie/wave)

## Screenshots

### Welcome Screen
![Game Welcome Screen](https://github.com/user-attachments/assets/f339b050-8a71-4e7e-a0a4-ba511caa75d6)

### Game in Action
![Game Playing Screen](https://github.com/user-attachments/assets/3fbca810-4e45-4d0c-8d02-9f8cf51420f6)

## Features

### Core Gameplay

- **Customizable Field**: Choose between soccer, football, and baseball fields.
- **Stadium Themes**: Select from Classic, Modern, and Retro stadium visual themes.
- **Interactive Wave Mechanics**: Click on crowd sectors to initiate and propagate waves around the stadium
- **Crowd Simulation**: 16 AI-controlled sectors with individual states (idle, anticipating, standing, seated)
- **Energy & Fatigue System**: Sectors have dynamic energy levels that affect wave readiness
- **Combo System**: Chain successful wave propagations for multiplier bonuses
- **Stadium Events**:
  - Mascot distractions that affect nearby sectors
  - Scoreboard hype events that boost all sectors
- **Player Interactions**:
  - Left-click sectors to start waves
  - Right-click to boost sector energy
  - Spacebar to quick-start from sector 0
  - Touch support: tap to start wave, long-press to boost energy
- **Performance Optimization**: Automatic performance tier detection for smooth gameplay across devices

### Technology Stack

- **Frontend**: HTML5 Canvas with high-DPI support for crisp rendering
- **Python Engine**: Game logic runs via Pyodide v0.24.1 in the browser
- **Fallback Engine**: JavaScript mock engine provides identical gameplay when Pyodide is unavailable
- **Audio**: Web Audio API for procedural sound effects
- **Build Tool**: Vite for development and production builds
- **Testing**: pytest for Python unit tests, Playwright for E2E tests

### Game Architecture

- **Hybrid Engine**: Game logic runs in-browser via Python (Pyodide) or JavaScript fallback, both exposing identical APIs
- **Python Game Engine Layer** (`game_engine.py`): State management, wave propagation algorithms, scoring
- **JavaScript Mock Engine** (`mock_engine.js`): Fallback engine mirroring Python API for offline/demo use
- **JavaScript Rendering Layer** (`main.js`): Canvas-based visualization, Pyodide integration, input handling
- **UI Layer**: HUD displaying score, combo, waves, accuracy, streak, and game time

## Installation

### Prerequisites

- Node.js 20+ and npm 10+
- Modern web browser with JavaScript enabled (Chrome, Firefox, Safari, Edge)
- Internet connection for Pyodide CDN (optional - JavaScript fallback available)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/gogorichie/wave.git
cd wave
```

2. Install dependencies:

```bash
npm install
```

3. Start development server:

```bash
npm run dev
```

The game will open automatically in your browser at `http://localhost:3000`.

### Running with Python Engine (Pyodide)

The game attempts to load Pyodide v0.24.1 from CDN to run the Python game engine in the browser. If Pyodide is unavailable (e.g., offline, CDN blocked), the game automatically falls back to a JavaScript mock engine.

Check browser console for:
- "Running with Python/Pyodide engine" - Python engine active
- "Running with JavaScript mock engine" - Fallback active

Both engines provide identical gameplay experience and API contracts.

## Development

### Development Commands

```bash
# Start development server (Vite, hot reload)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build locally
npm run preview

# Run Python unit tests (pytest)
npm test

# Run E2E tests (Playwright, requires dev server running)
npm run test:e2e
```

### Development Notes

- Vite dev server runs on port 3000 (configured in `vite.config.js`)
- Dev server automatically opens browser on start
- Python engine code is loaded via fetch from `/game_engine.py`
- Mock engine is imported as ES module in `main.js`
- High-DPI rendering uses `devicePixelRatio` (adjusted by performance tier)
- All game state is JSON-serialized between Python and JavaScript
- Security: Always use `pyodide.globals.set()` to pass parameters, never string interpolation

## How to Play

### Getting Started

1. **Configure Settings**: Choose your preferences in the tutorial screen:
   - Sound effects (on/off)
   - Difficulty (Easy/Medium/Hard)
   - Field type (Soccer/Baseball/Football)
   - Stadium theme (Classic/Modern/Retro)
2. **Start the Game**: Click "Let's Go!" to begin

### Controls

**Mouse/Desktop:**
- Left-click any crowd sector to start a wave
- Right-click any sector to boost its energy
- Press `Space` to quick-start wave at sector 0
- Press `P` to pause/resume
- Press `H` to toggle help overlay
- Press `F` for fullscreen mode
- Press `Esc` to pause or close help

**Touch/Mobile:**
- Tap any sector to start a wave
- Long-press (>500ms) any sector to boost its energy

### Gameplay

- **Initiate Waves**: Click sectors with sufficient energy (green/yellow bars)
- **Build Combos**: Chain successful wave propagations for multiplier bonuses
- **Boost Energy**: Right-click/long-press low energy sectors (red bars)
- **Trigger Events**: Use event buttons to activate mascot or scoreboard effects
- **Watch Stats**: Monitor time, accuracy, and streak in the stats panel

### Scoring

- Wave participation: 10 points × current combo multiplier
- Full stadium completion: 100 points × (1 + combo × 0.5)
- Combos increase by 1 for each successful sector wave
- Failed waves reset combo to 0

### Tips

- Energy bars below sector numbers show readiness (red < 30%, yellow 30-60%, green > 60%)
- Sectors must be in idle or seated state to start waves
- Green/animated sectors indicate active wave participation
- Yellow indicates anticipation state (about to stand)
- Mascot events distract nearby sectors - boost them to recover
- Scoreboard events boost all sectors' energy

## Project Structure

```
wave/
├── game_engine.py           # Python game logic and state management
├── mock_engine.js           # JavaScript fallback engine (mirrors Python API)
├── index.html               # Main HTML with canvas, UI components, and styles
├── main.js                  # Core game: rendering, Pyodide integration, input handling
├── vite.config.js           # Vite bundler configuration
├── playwright.config.js     # Playwright E2E test configuration
├── pyproject.toml           # Python project configuration
├── package.json             # Node dependencies and npm scripts
├── tests/
│   ├── test_game_engine.py  # Python unit tests for game engine
│   └── e2e/
│       └── game.spec.js     # Playwright E2E tests for UI/gameplay
├── infra/                   # Azure Static Web Apps infrastructure
└── README.md
```

## Game Design

### Crowd Sectors

Each of the 16 sectors has:

- **State Machine**: idle → anticipating → standing → seated
  - `idle`: Default state, ready for new waves
  - `anticipating`: Brief 0.5s preparation before standing
  - `standing`: Active participation for 1.5s
  - `seated`: Recovery state after wave completes
- **Energy**: 0.0-1.0 (regenerates at 0.1/second, consumed 0.2 per wave)
- **Fatigue**: 0.0-1.0 (increases 0.1 per wave, recovers 0.05/second)
- **Enthusiasm**: 0.6-0.9 (randomized personality trait, affects readiness)
- **Distractions**: 0.0-1.0 (external events affect focus, reduces over time)

### Wave Propagation Mechanics

- Waves travel clockwise around the stadium at 0.3 seconds per sector
- **Readiness Formula**: `(energy × enthusiasm) - (fatigue + distractions) > 0.3`
- Sectors must be in idle or seated state to start new waves
- Standing transition occurs 0.2 seconds after anticipating starts
- Failed propagation ends wave and resets combo to 0
- Full circle completion awards bonus: `100 × (1 + combo × 0.5)` points

### Stadium Events

- **Mascot**: Distracts 3 adjacent sectors (+0.3 distraction)
  - Auto-triggered every 30s by JavaScript layer
  - Manual trigger via "Mascot Moment" button
- **Scoreboard**: Boosts all sectors (+0.2 energy)
  - Auto-triggered every 45s by JavaScript layer
  - Manual trigger via "Scoreboard Hype" button
- Event logic implemented in Python engine, timing managed by JavaScript

### Performance Optimization

- **Tier Detection**: Automatic detection based on device capabilities (DPR, viewport, CPU cores)
- **Adaptive Rendering**: Low/Medium/High tiers adjust pixel ratio and effects
- **FPS Monitoring**: Auto-downgrade if FPS drops below 30
- **Tab Visibility**: Throttles updates to 5 FPS when tab is hidden

## Technical Details

### Engine API Contract

Both Python and JavaScript engines expose identical functions:

- `init_game(num_sectors)`: Initialize new game with N sectors
- `update_game(dt)`: Update game state by delta time
- `start_wave_at(sector_id)`: Attempt to start wave at sector
- `boost_sector_energy(sector_id)`: Boost sector's energy
- `get_game_state()`: Get current game state as JSON
- `get_events()`: Get and clear pending events
- `trigger_event(event_type, sector_id)`: Trigger stadium events
- `save_game()`: Serialize game state to JSON
- `load_game(save_data)`: Restore game from JSON

### Field Types

- **Soccer**: Rectangular pitch with center circle, penalty boxes, goal boxes
- **Baseball**: Diamond-shaped infield with bases, pitcher's mound, foul lines
- **Football**: Rectangular field with yard lines, hash marks, end zones

### Stadium Themes

- **Classic**: Blue idle, yellow anticipating, green standing, indigo seated
- **Modern**: Purple idle, orange anticipating, cyan standing, purple seated
- **Retro**: Red idle, amber anticipating, green standing, rose seated

## Future Enhancements

Potential additions:

- Multiple stadium venues with varying difficulty
- Special wave patterns (reverse-wave, double-wave)
- Weather effects and day/night cycles
- Progressive difficulty scaling
- Cosmetic unlocks and achievements
- Leaderboards and replay sharing
- Campaign mode with unlockable stadiums

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
