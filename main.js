/**
 * Stadium Wave Game - Main JavaScript Entry
 * Handles Pyodide initialization, rendering, and game loop
 */

// Global state
let pyodide = null;
let canvas = null;
let ctx = null;
let gameState = null;
let lastTime = 0;
let animationId = null;
let isGameRunning = false;

// Canvas settings
const STADIUM_RADIUS = 250;
const SECTOR_HEIGHT = 60;

/**
 * Initialize Pyodide and load Python game engine
 */
async function initPyodide() {
    try {
        console.log('Loading Pyodide...');
        pyodide = await loadPyodide();
        
        console.log('Loading Python game engine...');
        const response = await fetch('/game_engine.py');
        const pythonCode = await response.text();
        await pyodide.runPythonAsync(pythonCode);
        
        console.log('Python game engine loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize Pyodide:', error);
        return false;
    }
}

/**
 * Initialize game with Python
 */
function initGame() {
    try {
        const result = pyodide.runPython(`init_game(16)`);
        console.log('Game initialized:', result);
        return true;
    } catch (error) {
        console.error('Failed to initialize game:', error);
        return false;
    }
}

/**
 * Update game state from Python
 */
function updateGameState(dt) {
    try {
        const stateJson = pyodide.runPython(`update_game(${dt})`);
        gameState = JSON.parse(stateJson);
        
        // Check for events
        const eventsJson = pyodide.runPython(`get_events()`);
        const events = JSON.parse(eventsJson);
        
        events.forEach(event => handleGameEvent(event));
        
        return gameState;
    } catch (error) {
        console.error('Failed to update game state:', error);
        return null;
    }
}

/**
 * Handle game events from Python
 */
function handleGameEvent(event) {
    switch (event.type) {
        case 'wave_started':
            console.log('Wave started at sector', event.data);
            break;
        case 'wave_completed':
            showNotification(`Wave Complete! +${Math.floor(event.data.bonus)} points`, 'success');
            playSound('success');
            break;
        case 'wave_failed':
            showNotification('Wave Failed!', 'failure');
            playSound('fail');
            break;
    }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'success') {
    const existing = document.getElementById('notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = type;
    notification.textContent = message;
    document.getElementById('game-container').appendChild(notification);
    
    setTimeout(() => notification.remove(), 2000);
}

/**
 * Play sound effect (placeholder - would use Web Audio API)
 */
function playSound(type) {
    // Placeholder for Web Audio API implementation
    console.log('Play sound:', type);
}

/**
 * Start wave from specific sector
 */
function startWave(sectorId) {
    try {
        const resultJson = pyodide.runPython(`start_wave_at(${sectorId})`);
        const result = JSON.parse(resultJson);
        return result.success;
    } catch (error) {
        console.error('Failed to start wave:', error);
        return false;
    }
}

/**
 * Boost sector energy
 */
function boostSector(sectorId) {
    try {
        pyodide.runPython(`boost_sector_energy(${sectorId})`);
    } catch (error) {
        console.error('Failed to boost sector:', error);
    }
}

/**
 * Save game to localStorage
 */
function saveGame() {
    try {
        const saveData = pyodide.runPython(`save_game()`);
        localStorage.setItem('wave_game_save', saveData);
        showNotification('Game Saved!', 'success');
    } catch (error) {
        console.error('Failed to save game:', error);
        showNotification('Save Failed!', 'failure');
    }
}

/**
 * Load game from localStorage
 */
function loadGame() {
    try {
        const saveData = localStorage.getItem('wave_game_save');
        if (saveData) {
            pyodide.runPython(`load_game('${saveData}')`);
            showNotification('Game Loaded!', 'success');
        } else {
            showNotification('No save found!', 'failure');
        }
    } catch (error) {
        console.error('Failed to load game:', error);
        showNotification('Load Failed!', 'failure');
    }
}

/**
 * Setup canvas
 */
function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    // Handle resize
    window.addEventListener('resize', () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    });
}

/**
 * Get sector position and dimensions
 */
function getSectorGeometry(sectorId, totalSectors) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const angle = (sectorId / totalSectors) * Math.PI * 2 - Math.PI / 2;
    
    return {
        angle,
        centerX,
        centerY,
        innerRadius: STADIUM_RADIUS - SECTOR_HEIGHT,
        outerRadius: STADIUM_RADIUS
    };
}

/**
 * Get color for sector based on state
 */
function getSectorColor(sector) {
    const state = sector.state;
    const energy = sector.energy;
    
    switch (state) {
        case 'idle':
            return `rgba(100, 100, 150, ${0.5 + energy * 0.5})`;
        case 'anticipating':
            return `rgba(255, 200, 0, ${0.7 + energy * 0.3})`;
        case 'standing':
            return `rgba(0, 255, 100, ${0.8 + energy * 0.2})`;
        case 'seated':
            return `rgba(80, 80, 120, ${0.4 + energy * 0.4})`;
        default:
            return 'rgba(100, 100, 100, 0.5)';
    }
}

/**
 * Draw crowd sector
 */
function drawSector(sector, index, totalSectors) {
    const geom = getSectorGeometry(index, totalSectors);
    const angleWidth = (Math.PI * 2) / totalSectors;
    const startAngle = geom.angle - angleWidth / 2;
    const endAngle = geom.angle + angleWidth / 2;
    
    // Draw sector arc
    ctx.beginPath();
    ctx.arc(geom.centerX, geom.centerY, geom.outerRadius, startAngle, endAngle);
    ctx.arc(geom.centerX, geom.centerY, geom.innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    
    const color = getSectorColor(sector);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw standing animation
    if (sector.state === 'standing' || sector.state === 'anticipating') {
        const heightMultiplier = sector.state === 'standing' ? 1.5 : 1.2;
        const extendedRadius = geom.outerRadius + SECTOR_HEIGHT * (heightMultiplier - 1);
        
        ctx.beginPath();
        ctx.arc(geom.centerX, geom.centerY, extendedRadius, startAngle, endAngle);
        ctx.arc(geom.centerX, geom.centerY, geom.outerRadius, endAngle, startAngle, true);
        ctx.closePath();
        
        ctx.fillStyle = sector.state === 'standing' 
            ? 'rgba(0, 255, 100, 0.8)' 
            : 'rgba(255, 200, 0, 0.6)';
        ctx.fill();
    }
    
    // Draw sector number
    const textAngle = geom.angle;
    const textRadius = (geom.innerRadius + geom.outerRadius) / 2;
    const textX = geom.centerX + Math.cos(textAngle) * textRadius;
    const textY = geom.centerY + Math.sin(textAngle) * textRadius;
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(index, textX, textY);
    
    // Energy bar
    if (sector.energy < 0.5) {
        const barWidth = 30;
        const barHeight = 5;
        const barX = textX - barWidth / 2;
        const barY = textY + 15;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        ctx.fillStyle = sector.energy < 0.3 ? '#f87171' : '#fbbf24';
        ctx.fillRect(barX, barY, barWidth * sector.energy, barHeight);
    }
}

/**
 * Draw stadium field
 */
function drawField() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const fieldRadius = STADIUM_RADIUS - SECTOR_HEIGHT - 20;
    
    // Grass field
    const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, fieldRadius
    );
    gradient.addColorStop(0, '#2d5016');
    gradient.addColorStop(1, '#1a3d0a');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Field lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    
    // Center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    
    // Center line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - fieldRadius);
    ctx.lineTo(centerX, centerY + fieldRadius);
    ctx.stroke();
}

/**
 * Render game frame
 */
function render() {
    if (!gameState) return;
    
    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw field
    drawField();
    
    // Draw all sectors
    const sectors = gameState.sectors;
    sectors.forEach((sector, index) => {
        drawSector(sector, index, sectors.length);
    });
    
    // Update HUD
    updateHUD();
}

/**
 * Update HUD display
 */
function updateHUD() {
    if (!gameState) return;
    
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('combo').textContent = gameState.combo + 'x';
    document.getElementById('waves').textContent = gameState.successful_waves;
    document.getElementById('max-combo').textContent = gameState.max_combo + 'x';
}

/**
 * Game loop
 */
function gameLoop(timestamp) {
    if (!isGameRunning) return;
    
    const dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
    lastTime = timestamp;
    
    // Cap dt to prevent large jumps
    const cappedDt = Math.min(dt, 0.1);
    
    // Update game state
    updateGameState(cappedDt);
    
    // Render
    render();
    
    // Continue loop
    animationId = requestAnimationFrame(gameLoop);
}

/**
 * Start game loop
 */
function startGameLoop() {
    if (isGameRunning) return;
    
    isGameRunning = true;
    lastTime = 0;
    animationId = requestAnimationFrame(gameLoop);
}

/**
 * Stop game loop
 */
function stopGameLoop() {
    isGameRunning = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

/**
 * Get sector at mouse position
 */
function getSectorAtPosition(x, y) {
    if (!gameState) return -1;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if click is in crowd area
    const innerRadius = STADIUM_RADIUS - SECTOR_HEIGHT;
    if (distance < innerRadius || distance > STADIUM_RADIUS) {
        return -1;
    }
    
    // Calculate angle
    let angle = Math.atan2(dy, dx);
    angle = angle + Math.PI / 2; // Adjust so sector 0 is at top
    if (angle < 0) angle += Math.PI * 2;
    
    const totalSectors = gameState.sectors.length;
    const sectorIndex = Math.floor((angle / (Math.PI * 2)) * totalSectors);
    
    return sectorIndex % totalSectors;
}

/**
 * Setup input handlers
 */
function setupInputHandlers() {
    // Click to start wave
    canvas.addEventListener('click', (e) => {
        if (!isGameRunning) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const sectorId = getSectorAtPosition(x, y);
        if (sectorId >= 0) {
            startWave(sectorId);
        }
    });
    
    // Right-click to boost energy
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!isGameRunning) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const sectorId = getSectorAtPosition(x, y);
        if (sectorId >= 0) {
            boostSector(sectorId);
            showNotification(`Sector ${sectorId} boosted!`, 'success');
        }
    });
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!isGameRunning) return;
        
        if (e.code === 'Space') {
            e.preventDefault();
            startWave(0);
        }
    });
    
    // Save/Load buttons
    document.getElementById('save-btn').addEventListener('click', saveGame);
    document.getElementById('load-btn').addEventListener('click', loadGame);
}

/**
 * Start the game
 */
function startGame() {
    document.getElementById('tutorial').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('controls').classList.remove('hidden');
    
    initGame();
    startGameLoop();
}

/**
 * Main initialization
 */
async function main() {
    console.log('Initializing Stadium Wave Game...');
    
    // Setup canvas
    setupCanvas();
    
    // Initialize Pyodide
    const success = await initPyodide();
    
    if (success) {
        // Hide loading screen
        document.getElementById('loading').classList.add('hidden');
        
        // Setup input handlers
        setupInputHandlers();
        
        // Setup start button
        document.getElementById('start-btn').addEventListener('click', startGame);
        
        console.log('Game ready!');
    } else {
        document.getElementById('loading').innerHTML = 
            '<h2>Failed to Load</h2><p>Could not initialize Python runtime</p>';
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
