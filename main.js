/**
 * Stadium Wave Game - Main JavaScript Entry
 * Handles Pyodide initialization, rendering, and game loop
 */

import { mockGameAPI } from './mock_engine.js';

// Global state
let pyodide = null;
let useMockEngine = false;
let canvas = null;
let ctx = null;
let gameState = null;
let lastTime = 0;
let animationId = null;
let isGameRunning = false;
let selectedVenue = 'baseball';  // Default venue

// Canvas settings
const STADIUM_RADIUS = 250;
const SECTOR_HEIGHT = 60;

// Performance optimization
let sectorPaths = [];
let offscreenCanvas = null;
let offscreenCtx = null;
let resizeTimeout = null;

// Cached field gradients keyed by venue
let fieldGradients = {};
let lastDrawnVenue = null;

/**
 * Initialize Pyodide and load Python game engine
 */
async function initPyodide() {
    // Check if Pyodide is available
    if (typeof loadPyodide === 'undefined') {
        console.warn('Pyodide not available, using mock JavaScript engine');
        useMockEngine = true;
        return true;
    }
    
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
        console.log('Falling back to mock JavaScript engine');
        useMockEngine = true;
        return true;
    }
}

/**
 * Initialize game with Python
 */
function initGame(venue = 'baseball') {
    try {
        let result;
        if (useMockEngine) {
            result = mockGameAPI.init_game(venue);
        } else {
            pyodide.globals.set('venue_param', venue);
            result = pyodide.runPython(`init_game(venue_param)`);
        }
        console.log('Game initialized:', result);
        const initData = JSON.parse(result);
        
        // Update venue info display
        updateVenueDisplay(initData);
        
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
        let stateJson, eventsJson;
        if (useMockEngine) {
            stateJson = mockGameAPI.update_game(dt);
            eventsJson = mockGameAPI.get_events();
        } else {
            pyodide.globals.set('dt_value', dt);
            stateJson = pyodide.runPython(`update_game(dt_value)`);
            eventsJson = pyodide.runPython(`get_events()`);
        }
        
        gameState = JSON.parse(stateJson);
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
        let resultJson;
        if (useMockEngine) {
            resultJson = mockGameAPI.start_wave_at(sectorId);
        } else {
            pyodide.globals.set('sector_id', sectorId);
            resultJson = pyodide.runPython(`start_wave_at(sector_id)`);
        }
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
        if (useMockEngine) {
            mockGameAPI.boost_sector_energy(sectorId);
        } else {
            pyodide.globals.set('sector_id', sectorId);
            pyodide.runPython(`boost_sector_energy(sector_id)`);
        }
    } catch (error) {
        console.error('Failed to boost sector:', error);
    }
}

/**
 * Save game to localStorage
 */
function saveGame() {
    try {
        let saveData;
        if (useMockEngine) {
            saveData = mockGameAPI.save_game();
        } else {
            saveData = pyodide.runPython(`save_game()`);
        }
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
            if (useMockEngine) {
                mockGameAPI.load_game(saveData);
            } else {
                pyodide.globals.set('save_data', saveData);
                pyodide.runPython(`load_game(save_data)`);
            }
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
 * Debounce function to prevent excessive resize calls
 */
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(resizeTimeout);
            func.apply(this, args);
        };
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(later, wait);
    };
}

/**
 * Setup high-DPI canvas with proper scaling
 */
function setupHighDPICanvas(canvas, ctx, container) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    // Set display size (CSS pixels)
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // Set actual size (device pixels)
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    
    // Scale context to ensure correct drawing operations
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    return { width: rect.width, height: rect.height };
}

/**
 * Precompute sector paths for better performance
 */
function precomputeSectorPaths(totalSectors, centerX, centerY) {
    sectorPaths = [];
    const angleWidth = (Math.PI * 2) / totalSectors;
    const innerRadius = STADIUM_RADIUS - SECTOR_HEIGHT;
    const outerRadius = STADIUM_RADIUS;
    
    for (let i = 0; i < totalSectors; i++) {
        const angle = (i / totalSectors) * Math.PI * 2 - Math.PI / 2;
        const startAngle = angle - angleWidth / 2;
        const endAngle = angle + angleWidth / 2;
        
        const path = new Path2D();
        path.arc(centerX, centerY, outerRadius, startAngle, endAngle);
        path.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        path.closePath();
        
        sectorPaths[i] = {
            path,
            angle,
            startAngle,
            endAngle,
            innerRadius,
            outerRadius,
            textX: centerX + Math.cos(angle) * ((innerRadius + outerRadius) / 2),
            textY: centerY + Math.sin(angle) * ((innerRadius + outerRadius) / 2)
        };
    }
}

/**
 * Setup canvas with high-DPI support and performance optimizations
 */
function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    const container = document.getElementById('game-container');
    
    // Initial setup
    const dimensions = setupHighDPICanvas(canvas, ctx, container);
    precomputeSectorPaths(16, dimensions.width / 2, dimensions.height / 2);
    
    // Setup offscreen canvas for performance
    offscreenCanvas = document.createElement('canvas');
    offscreenCtx = offscreenCanvas.getContext('2d');
    
    // Debounced resize handler
    const debouncedResize = debounce(() => {
        const newDimensions = setupHighDPICanvas(canvas, ctx, container);
        resetFieldGradients();
        precomputeSectorPaths(gameState ? gameState.sectors.length : 16,
                            newDimensions.width / 2, newDimensions.height / 2);
        
        // Update offscreen canvas size
        const devicePixelRatio = window.devicePixelRatio || 1;
        offscreenCanvas.width = newDimensions.width * devicePixelRatio;
        offscreenCanvas.height = newDimensions.height * devicePixelRatio;
        offscreenCtx.scale(devicePixelRatio, devicePixelRatio);
    }, 150);
    
    // Handle resize
    window.addEventListener('resize', debouncedResize);
}

/**
 * Get sector position and dimensions (optimized with precomputed values)
 */
function getSectorGeometry(sectorId, totalSectors) {
    if (sectorPaths[sectorId]) {
        return sectorPaths[sectorId];
    }
    
    // Fallback for dynamic calculations
    const centerX = canvas.width / (2 * (window.devicePixelRatio || 1));
    const centerY = canvas.height / (2 * (window.devicePixelRatio || 1));
    const angle = (sectorId / totalSectors) * Math.PI * 2 - Math.PI / 2;
    
    return {
        angle,
        centerX,
        centerY,
        innerRadius: STADIUM_RADIUS - SECTOR_HEIGHT,
        outerRadius: STADIUM_RADIUS,
        textX: centerX + Math.cos(angle) * ((STADIUM_RADIUS - SECTOR_HEIGHT + STADIUM_RADIUS) / 2),
        textY: centerY + Math.sin(angle) * ((STADIUM_RADIUS - SECTOR_HEIGHT + STADIUM_RADIUS) / 2)
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
 * Draw crowd sector (optimized with precomputed paths)
 */
function drawSector(sector, index, totalSectors) {
    const geom = getSectorGeometry(index, totalSectors);
    
    // Use precomputed path if available
    if (geom.path) {
        ctx.fillStyle = getSectorColor(sector);
        ctx.fill(geom.path);
        
        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke(geom.path);
    } else {
        // Fallback to manual drawing
        const angleWidth = (Math.PI * 2) / totalSectors;
        const startAngle = geom.angle - angleWidth / 2;
        const endAngle = geom.angle + angleWidth / 2;
        
        ctx.beginPath();
        ctx.arc(geom.centerX, geom.centerY, geom.outerRadius, startAngle, endAngle);
        ctx.arc(geom.centerX, geom.centerY, geom.innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        
        ctx.fillStyle = getSectorColor(sector);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Draw standing animation
    if (sector.state === 'standing' || sector.state === 'anticipating') {
        const heightMultiplier = sector.state === 'standing' ? 1.5 : 1.2;
        const extendedRadius = geom.outerRadius + SECTOR_HEIGHT * (heightMultiplier - 1);
        const centerX = geom.centerX || (canvas.width / (2 * (window.devicePixelRatio || 1)));
        const centerY = geom.centerY || (canvas.height / (2 * (window.devicePixelRatio || 1)));
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, extendedRadius, geom.startAngle, geom.endAngle);
        ctx.arc(centerX, centerY, geom.outerRadius, geom.endAngle, geom.startAngle, true);
        ctx.closePath();
        
        ctx.fillStyle = sector.state === 'standing' 
            ? 'rgba(0, 255, 100, 0.8)' 
            : 'rgba(255, 200, 0, 0.6)';
        ctx.fill();
    }
    
    // Draw sector number (use precomputed text position)
    const textX = geom.textX;
    const textY = geom.textY;
    
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

function resetFieldGradients() {
    fieldGradients = {};
}

function getFieldGradient(venue, centerX, centerY, fieldRadius) {
    const key = `${venue}-${Math.round(centerX)}-${Math.round(centerY)}-${Math.round(fieldRadius)}`;
    if (!fieldGradients[key]) {
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, fieldRadius
        );

        if (venue === 'baseball') {
            gradient.addColorStop(0, '#3c7a2f');
            gradient.addColorStop(1, '#1f4516');
        } else if (venue === 'soccer') {
            gradient.addColorStop(0, '#2d5016');
            gradient.addColorStop(1, '#1a3d0a');
        } else {
            gradient.addColorStop(0, '#2a4920');
            gradient.addColorStop(1, '#153111');
        }

        fieldGradients[key] = gradient;
    }
    return fieldGradients[key];
}

function drawSoccerField(centerX, centerY, fieldRadius) {
    const gradient = getFieldGradient('soccer', centerX, centerY, fieldRadius);

    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;

    // Outer boundary circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius * 0.95, 0, Math.PI * 2);
    ctx.stroke();

    // Center circle and line
    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius * 0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY - fieldRadius * 0.95);
    ctx.lineTo(centerX, centerY + fieldRadius * 0.95);
    ctx.stroke();

    // Penalty boxes
    const boxWidth = fieldRadius * 1.3;
    const boxDepth = fieldRadius * 0.35;
    ctx.strokeRect(centerX - boxWidth / 2, centerY - fieldRadius * 0.95 - boxDepth, boxWidth, boxDepth);
    ctx.strokeRect(centerX - boxWidth / 2, centerY + fieldRadius * 0.95, boxWidth, boxDepth);

    // Goal boxes
    const goalWidth = fieldRadius * 0.8;
    const goalDepth = fieldRadius * 0.18;
    ctx.strokeRect(centerX - goalWidth / 2, centerY - fieldRadius * 0.95 - goalDepth, goalWidth, goalDepth);
    ctx.strokeRect(centerX - goalWidth / 2, centerY + fieldRadius * 0.95, goalWidth, goalDepth);

    // Penalty arcs
    const penaltyRadius = fieldRadius * 0.3;
    ctx.beginPath();
    ctx.arc(centerX, centerY - fieldRadius * 0.6, penaltyRadius, Math.PI * 0.8, Math.PI * 0.2, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY + fieldRadius * 0.6, penaltyRadius, Math.PI * 1.2, Math.PI * 1.8, true);
    ctx.stroke();
}

function drawBaseballField(centerX, centerY, fieldRadius) {
    const gradient = getFieldGradient('baseball', centerX, centerY, fieldRadius);

    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Warning track / outfield wall
    ctx.strokeStyle = 'rgba(20, 45, 18, 0.7)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius * 0.98, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();

    // Infield grass circle
    const infieldGrassRadius = fieldRadius * 0.55;
    ctx.beginPath();
    ctx.arc(centerX, centerY, infieldGrassRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#3f8a32';
    ctx.fill();

    // Infield dirt diamond
    const diamondRadius = fieldRadius * 0.42;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - diamondRadius);
    ctx.lineTo(centerX + diamondRadius, centerY);
    ctx.lineTo(centerX, centerY + diamondRadius);
    ctx.lineTo(centerX - diamondRadius, centerY);
    ctx.closePath();
    ctx.fillStyle = '#c68642';
    ctx.fill();

    // Base paths
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + diamondRadius);
    ctx.lineTo(centerX + diamondRadius, centerY);
    ctx.lineTo(centerX, centerY - diamondRadius);
    ctx.lineTo(centerX - diamondRadius, centerY);
    ctx.closePath();
    ctx.stroke();

    // Bases
    const baseSize = fieldRadius * 0.06;
    const basePositions = [
        { x: centerX, y: centerY + diamondRadius }, // Home
        { x: centerX + diamondRadius, y: centerY }, // First
        { x: centerX, y: centerY - diamondRadius }, // Second
        { x: centerX - diamondRadius, y: centerY }  // Third
    ];

    basePositions.forEach((pos, index) => {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = index === 0 ? '#ffffff' : '#f8f8f8';
        ctx.fillRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
        ctx.restore();
    });

    // Pitcher's mound
    const moundRadius = fieldRadius * 0.08;
    ctx.beginPath();
    ctx.arc(centerX, centerY, moundRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#d5a273';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, moundRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Foul lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + diamondRadius);
    ctx.lineTo(centerX + fieldRadius * 0.9, centerY + fieldRadius * 0.9);
    ctx.moveTo(centerX, centerY + diamondRadius);
    ctx.lineTo(centerX - fieldRadius * 0.9, centerY + fieldRadius * 0.9);
    ctx.stroke();

    // Home plate detail
    ctx.save();
    ctx.translate(centerX, centerY + diamondRadius);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -baseSize / 2);
    ctx.lineTo(baseSize / 2, 0);
    ctx.lineTo(0, baseSize / 2);
    ctx.lineTo(-baseSize / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawField() {
    if (!gameState) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    const centerX = canvas.width / (2 * devicePixelRatio);
    const centerY = canvas.height / (2 * devicePixelRatio);
    const fieldRadius = STADIUM_RADIUS - SECTOR_HEIGHT - 20;
    const venue = (gameState.venue || 'baseball').toLowerCase();

    if (lastDrawnVenue !== venue) {
        resetFieldGradients();
        lastDrawnVenue = venue;
    }

    if (venue === 'baseball') {
        drawBaseballField(centerX, centerY, fieldRadius);
    } else if (venue === 'soccer') {
        drawSoccerField(centerX, centerY, fieldRadius);
    } else {
        drawSoccerField(centerX, centerY, fieldRadius);
    }
}

/**
 * Render game frame (optimized for high-DPI and performance)
 */
function render() {
    if (!gameState) return;
    
    const devicePixelRatio = window.devicePixelRatio || 1;
    const canvasWidth = canvas.width / devicePixelRatio;
    const canvasHeight = canvas.height / devicePixelRatio;
    
    // Clear canvas with proper dimensions
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw field
    drawField();
    
    // Draw all sectors (batch operations for better performance)
    const sectors = gameState.sectors;
    
    // Update precomputed paths if sector count changed
    if (sectorPaths.length !== sectors.length) {
        precomputeSectorPaths(sectors.length, canvasWidth / 2, canvasHeight / 2);
    }
    
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
 * Update venue info display
 */
function updateVenueDisplay(initData) {
    const venueInfo = document.getElementById('venue-info');
    if (venueInfo && initData.venue_name) {
        let difficultyClass = 'difficulty-easy';
        if (initData.difficulty === 'Medium') difficultyClass = 'difficulty-medium';
        if (initData.difficulty === 'Hard') difficultyClass = 'difficulty-hard';
        
        venueInfo.innerHTML = `${initData.venue_name} <span class="difficulty-badge ${difficultyClass}">${initData.difficulty}</span>`;
        venueInfo.classList.remove('hidden');
    }
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
 * Get sector at mouse position (adjusted for high-DPI)
 */
function getSectorAtPosition(x, y) {
    if (!gameState) return -1;
    
    const devicePixelRatio = window.devicePixelRatio || 1;
    const centerX = (canvas.width / devicePixelRatio) / 2;
    const centerY = (canvas.height / devicePixelRatio) / 2;
    
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
    document.getElementById('game-title').classList.remove('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('controls').classList.remove('hidden');
    
    initGame(selectedVenue);
    startGameLoop();
}

/**
 * Main initialization
 */
async function main() {
    console.log('Initializing Stadium Wave Game...');
    
    // Setup canvas
    setupCanvas();
    
    // Initialize Pyodide or fallback to mock
    const success = await initPyodide();
    
    if (success) {
        // Hide loading screen
        document.getElementById('loading').classList.add('hidden');
        
        // Show engine info
        if (useMockEngine) {
            console.log('Running with JavaScript mock engine');
        } else {
            console.log('Running with Python/Pyodide engine');
        }
        
        // Setup input handlers
        setupInputHandlers();
        
        // Setup start button
        document.getElementById('start-btn').addEventListener('click', startGame);
        
        // Setup venue selection
        const venueOptions = document.querySelectorAll('.venue-option');
        venueOptions.forEach(option => {
            option.addEventListener('click', function() {
                venueOptions.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                selectedVenue = this.dataset.venue;
            });
        });
        
        console.log('Game ready!');
    } else {
        document.getElementById('loading').innerHTML = 
            '<h2>Failed to Load</h2><p>Could not initialize game engine</p>';
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
