# Stadium Wave Game 🌊

A browser-based interactive game where players orchestrate the stadium "wave" by coordinating with AI-controlled crowd sectors to achieve synchronized animations and earn combo points.

## Features

### Core Gameplay
- **Interactive Wave Mechanics**: Click on crowd sectors to initiate and propagate waves around the stadium
- **Crowd Simulation**: 16 AI-controlled sectors with individual states (idle, anticipating, standing, seated)
- **Energy & Fatigue System**: Sectors have dynamic energy levels that affect wave readiness
- **Combo System**: Chain successful wave propagations for multiplier bonuses
- **Player Interactions**:
  - Left-click sectors to start waves
  - Right-click to boost sector energy
  - Spacebar to quick-start from sector 0

### Technology Stack
- **Frontend**: HTML5 Canvas for real-time crowd visualization
- **Python Engine**: Game logic runs via Pyodide in the browser
- **Rendering**: JavaScript handles smooth 60fps animations
- **Persistence**: LocalStorage for save/load functionality

### Game Architecture
- **Python Game Engine Layer**: State management, wave propagation algorithms, scoring
- **JavaScript Rendering Layer**: Canvas-based crowd visualization with color-coded states
- **UI Layer**: HUD displaying score, combo, and wave statistics

## Installation

### Prerequisites
- Node.js 16+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

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

The game will open in your browser at `http://localhost:3000`

### Running with Python Engine (Pyodide)

By default, the game attempts to load Pyodide from CDN to run the Python game engine in the browser. If Pyodide is unavailable (e.g., CDN blocked), the game automatically falls back to a JavaScript mock engine that provides the same functionality.

To ensure Python engine works:
- Ensure internet connection for CDN access
- Check browser console for "Running with Python/Pyodide engine" message
- If you see "Running with JavaScript mock engine", the fallback is active

Both engines provide identical gameplay experience.

## Development

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Run Tests
```bash
# Python unit tests
npm test

# E2E tests (requires dev server running)
npm run test:e2e
```

## How to Play

1. **Start the Game**: Click "Let's Go!" to begin
2. **Initiate Waves**: Click on any crowd sector to start a wave
3. **Build Combos**: Keep the wave going by maintaining high energy levels
4. **Boost Energy**: Right-click sectors with low energy to boost them
5. **Score Points**: Complete full stadium waves for bonus points
6. **Save Progress**: Use the save button to preserve your high scores

### Scoring
- Basic wave participation: 10 points × combo multiplier
- Full stadium completion: 100 points + combo bonus
- Combos increase with consecutive successful sector waves

### Tips
- Watch the energy bars under sector numbers
- Low energy sectors (red/yellow bars) need boosting
- Timing is key - sectors must be in idle or seated state to start
- Green indicates active wave participation
- Yellow shows anticipation state

## Project Structure

```
wave/
├── game_engine.py       # Python game logic and state management
├── mock_engine.js       # JavaScript fallback engine (same API as Python)
├── index.html           # Main HTML structure with canvas
├── main.js              # JavaScript rendering and Pyodide integration
├── vite.config.js       # Vite bundler configuration
├── package.json         # Node dependencies and scripts
├── tests/
│   ├── test_game_engine.py   # Python unit tests (20 tests)
│   └── e2e/
│       └── game.spec.js       # Playwright E2E tests
└── README.md
```

## Game Design

### Crowd Sectors
Each sector has:
- **State**: idle → anticipating → standing → seated
- **Energy**: 0.0-1.0 (affects readiness)
- **Fatigue**: 0.0-1.0 (increases with activity)
- **Enthusiasm**: 0.6-0.9 (randomized personality trait)
- **Distractions**: External events affecting focus

### Wave Propagation
- Waves travel clockwise around the stadium
- Sectors must be ready (sufficient energy, low fatigue)
- Failed propagation ends the wave and resets combo
- Successful full circles award completion bonuses

## Future Enhancements

Potential additions:
- Multiple stadium venues with varying difficulty
- Special wave patterns (reverse-wave, double-wave)
- Weather effects and day/night cycles
- Mascot events and scoreboard interactions
- Cosmetic unlocks (foam fingers, flags)
- Highlight reel GIF export
- Progressive difficulty campaign mode

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Deployment
[![Azure Static Web Apps CI/CD](https://github.com/gogorichie/wave/actions/workflows/azure-static-web-apps-victorious-cliff-0ab69fe0f.yml/badge.svg)](https://github.com/gogorichie/wave/actions/workflows/azure-static-web-apps-victorious-cliff-0ab69fe0f.yml)
