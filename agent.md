# Agent.md Guide: Stadium Wave Game 🏟️

This document is for automated coding agents (and humans) working on the **Stadium Wave Game** project.

The goal of this project is to provide a **browser-based interactive game** where players orchestrate a stadium “wave” by coordinating with AI-controlled crowd sectors to achieve synchronized animations and earn combo points.

---

## 1. Repository Overview

**Core idea:**  
A browser game where the user triggers and maintains a stadium wave. Crowd sectors are simulated with energy, fatigue, and simple AI. The game can run with either:

- A **Python game engine** compiled to WebAssembly via **Pyodide** (preferred)
- A **JavaScript mock engine** with the same public API (fallback when Pyodide is unavailable)

**Primary responsibilities of this codebase:**

- Maintain game state (sectors, wave propagation, score, combos)
- Render crowd and HUD via HTML5 Canvas at ~60fps
- Persist scores / game state using browser `localStorage`
- Provide a seamless Python↔JavaScript integration via Pyodide

---

## 2. Tech Stack & Architecture

### 2.1 Frontend

- **Rendering:** HTML5 Canvas (visualization of crowd, sectors, wave)
- **Runtime:** Browser (modern Chromium/Firefox/Safari/Edge)
- **Bundler/Dev server:** Vite (via `npm run dev` / `npm run build`)

### 2.2 Game Engine

- **Primary engine:** `game_engine.py`
  - Written in Python
  - Loaded via Pyodide in the browser
  - Handles:
    - Sector state machine (idle, anticipating, standing, seated)
    - Wave propagation logic (clockwise around stadium)
    - Energy/fatigue adjustments
    - Scoring & combo calculations

- **Fallback engine:** `mock_engine.js`
  - Pure JS implementation
  - Exposes the same public API as `game_engine.py`
  - Used when Pyodide is unreachable (e.g., CDN blocked)

### 2.3 Persistence

- **localStorage**
  - Save/load gameplay progress and high scores
  - Must remain backward compatible whenever possible

### 2.4 CI/CD

- Find the CI plan in the .github/workflows folder.

---

## 3. Project Structure

Key files/directories:

```text
wave/
├── game_engine.py       # Python game logic and state management
├── mock_engine.js       # JavaScript fallback engine (same API as Python)
├── index.html           # Main HTML structure with canvas
├── main.js              # JavaScript rendering and Pyodide integration
├── vite.config.js       # Vite bundler configuration
├── package.json         # Node dependencies and scripts
├── tests/
│   ├── test_game_engine.py   # Python unit tests (for game_engine)
│   └── e2e/
│       └── game.spec.js      # Playwright E2E tests
└── README.md

