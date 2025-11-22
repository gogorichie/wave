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
let isPaused = false;
let gameStartTime = 0;
let totalGameTime = 0;
let waveAttempts = 0;
let successfulWaves = 0;
let currentStreak = 0;
let soundEnabled = true;
let difficulty = 'medium';
let hoveredSector = -1;
let fieldType = 'soccer';
let stadiumType = 'classic';
let eventIntervals = [];
let activeEventIndicators = [];

// Canvas settings
const STADIUM_RADIUS = 250;
const SECTOR_HEIGHT = 60;

// Stadium color themes
const STADIUM_THEMES = {
    classic: {
        idle: '#2563eb',
        anticipating: '#fbbf24',
        standing: '#10b981',
        seated: '#6366f1',
        border: 'rgba(255, 255, 255, 0.3)',
        hoverBorder: 'rgba(255, 255, 255, 0.8)'
    },
    modern: {
        idle: '#8b5cf6',
        anticipating: '#f97316',
        standing: '#06b6d4',
        seated: '#a855f7',
        border: 'rgba(255, 255, 255, 0.4)',
        hoverBorder: 'rgba(255, 255, 0, 0.9)'
    },
    retro: {
        idle: '#dc2626',
        anticipating: '#f59e0b',
        standing: '#16a34a',
        seated: '#be123c',
        border: 'rgba(255, 255, 200, 0.4)',
        hoverBorder: 'rgba(255, 255, 100, 0.95)'
    }
};

// Baseball field colors
const BASEBALL_FIELD_COLORS = {
    dirt: '#c68642',
    basePath: '#f5e0c3',
    base: '#f5f5f5',
    pitchersMound: '#d9a066',
    homePlate: '#ffffff',
    foulLine: 'rgba(255, 255, 255, 0.8)'
};

// Baseball field layout constants
const BASEBALL_COS_45 = Math.sqrt(2) / 2;  // ~0.707, for 45-degree angle calculations
const BASEBALL_MOUND_DISTANCE_RATIO = 0.9;  // Pitcher's mound is 90% of base distance from home
const BASEBALL_FOUL_LINE_EXTENT_H = 0.9;  // Horizontal extent of foul lines
const BASEBALL_FOUL_LINE_EXTENT_V = 0.6;  // Vertical extent of foul lines

// Performance optimization
let sectorPaths = [];
let offscreenCanvas = null;
let offscreenCtx = null;
let resizeTimeout = null;
let fieldGradients = {};

// Performance tier and monitoring
let performanceTier = 'high'; // 'low', 'medium', 'high'
let effectivePixelRatio = 1;
let isTabVisible = true;
let lastFrameTime = 0;
let frameCount = 0;
let fpsHistory = [];
const TARGET_FPS = 60;
const LOW_FPS_THRESHOLD = 30;
const PERFORMANCE_TIER_LOW_THRESHOLD = 40;
const PERFORMANCE_TIER_MEDIUM_THRESHOLD = 70;
const HIDDEN_TAB_UPDATE_INTERVAL = 200; // milliseconds

/**
 * Get effective pixel ratio for a given performance tier
 */
function getEffectivePixelRatio(tier) {
    const dpr = window.devicePixelRatio || 1;
    switch (tier) {
        case 'low':
            return Math.min(dpr, 1);
        case 'medium':
            return Math.min(dpr, 1.5);
        case 'high':
        default:
            return dpr;
    }
}

/**
 * Save performance tier to localStorage
 */
function savePerformanceTier() {
    try {
        localStorage.setItem('wave_performance_tier', performanceTier);
    } catch (e) {
        console.warn('Could not save performance tier to localStorage');
    }
}

/**
 * Detect device capabilities and set performance tier
 */
function detectPerformanceTier() {
    const dpr = window.devicePixelRatio || 1;
    const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
    };
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Calculate a performance score
    let score = 100;
    
    // High DPR can be expensive (e.g., Retina displays)
    if (dpr > 2) score -= 20;
    else if (dpr > 1.5) score -= 10;
    
    // Small viewports typically indicate mobile devices
    const viewportArea = viewport.width * viewport.height;
    if (viewportArea < 500000) score -= 30; // ~700x700 or smaller
    else if (viewportArea < 1000000) score -= 15; // ~1000x1000 or smaller
    
    // Mobile devices generally have less power
    if (isMobile || isTouch) score -= 20;
    
    // Check if hardware concurrency is available (number of CPU cores)
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        score -= 15;
    }
    
    // Determine tier based on score
    if (score < PERFORMANCE_TIER_LOW_THRESHOLD) {
        performanceTier = 'low';
    } else if (score < PERFORMANCE_TIER_MEDIUM_THRESHOLD) {
        performanceTier = 'medium';
    } else {
        performanceTier = 'high';
    }
    
    effectivePixelRatio = getEffectivePixelRatio(performanceTier);
    
    console.log(`Performance tier: ${performanceTier} (score: ${score}, DPR: ${dpr} -> ${effectivePixelRatio})`);
    
    // Store in localStorage for consistency
    savePerformanceTier();
    
    return performanceTier;
}

/**
 * Monitor FPS and adjust performance tier if needed
 */
function monitorPerformance(timestamp) {
    frameCount++;
    
    // Calculate FPS every second
    if (timestamp - lastFrameTime >= 1000) {
        const fps = frameCount;
        fpsHistory.push(fps);
        
        // Keep only last 5 seconds of history
        if (fpsHistory.length > 5) {
            fpsHistory.shift();
        }
        
        // Calculate average FPS
        const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
        
        // Auto-downgrade if consistently low FPS
        if (avgFps < LOW_FPS_THRESHOLD && performanceTier !== 'low') {
            console.warn(`Low FPS detected (${avgFps.toFixed(1)}), downgrading performance tier`);
            if (performanceTier === 'high') {
                performanceTier = 'medium';
            } else if (performanceTier === 'medium') {
                performanceTier = 'low';
            }
            
            effectivePixelRatio = getEffectivePixelRatio(performanceTier);
            
            // Save updated tier to localStorage
            savePerformanceTier();
            
            // Trigger canvas resize to apply new DPR
            const container = document.getElementById('game-container');
            if (container && canvas && ctx) {
                const dimensions = setupHighDPICanvas(canvas, ctx, container);
                precomputeSectorPaths(gameState ? gameState.sectors.length : 16,
                                    dimensions.width / 2, dimensions.height / 2);
            }
        }
        
        frameCount = 0;
        lastFrameTime = timestamp;
    }
}

/**
 * Setup Page Visibility API to handle tab backgrounding
 */
function setupVisibilityHandler() {
    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
        isTabVisible = !document.hidden;
        
        if (isTabVisible) {
            console.log('Tab visible - resuming normal rendering');
            // Reset lastTime to prevent large dt jump
            lastTime = 0;
            // Reset to 0 so first hidden frame after next hide will execute immediately
            lastHiddenUpdateTime = 0;
        } else {
            console.log('Tab hidden - throttling rendering');
            // Initialize hidden update time to current time to start throttling
            lastHiddenUpdateTime = performance.now();
        }
    });
}

/**
 * Determine if expensive effects should be rendered based on performance tier
 */
function shouldRenderExpensiveEffects() {
    return performanceTier === 'high';
}

/**
 * Determine if detailed animations should be rendered
 */
function shouldRenderDetailedAnimations() {
    return performanceTier !== 'low';
}

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
function initGame() {
    try {
        let result;
        if (useMockEngine) {
            result = mockGameAPI.init_game(16);
        } else {
            result = pyodide.runPython(`init_game(16)`);
        }
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
            waveAttempts++;
            break;
        case 'wave_completed':
            showNotification(`Wave Complete! +${Math.floor(event.data.bonus)} points`, 'success');
            playSound('success');
            successfulWaves++;
            currentStreak++;
            break;
        case 'wave_failed':
            showNotification('Wave Failed!', 'failure');
            playSound('fail');
            currentStreak = 0;
            break;
        case 'mascot':
            if (event.data && typeof event.data.sector === 'number') {
                showNotification(`Mascot distraction near sector ${event.data.sector}!`, 'failure');
            } else {
                showNotification('Mascot distraction!', 'failure');
            }
            addEventIndicator('mascot', event.data || {});
            playSound('alert');
            break;
        case 'scoreboard':
            showNotification('Scoreboard hype! Crowd energy boosted.', 'success');
            addEventIndicator('scoreboard', event.data || {});
            playSound('powerup');
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
    if (!soundEnabled) return;
    // Placeholder for Web Audio API implementation
    console.log('Play sound:', type);
}

/**
 * Add an on-canvas indicator for special events
 */
function addEventIndicator(type, data = {}) {
    activeEventIndicators.push({
        type,
        data,
        start: performance.now(),
        duration: type === 'mascot' ? 2800 : 2200
    });
}

/**
 * Toggle pause state
 */
function togglePause() {
    isPaused = !isPaused;
    const pauseOverlay = document.getElementById('pause-overlay');
    const pauseBtn = document.getElementById('pause-btn');
    
    if (isPaused) {
        pauseOverlay.classList.remove('hidden');
        pauseBtn.textContent = '▶';
        pauseBtn.title = 'Resume Game';
    } else {
        pauseOverlay.classList.add('hidden');
        pauseBtn.textContent = '⏸';
        pauseBtn.title = 'Pause Game';
        lastTime = 0; // Reset time to prevent large dt jump
    }
}

/**
 * Toggle help overlay
 */
function toggleHelp() {
    const helpOverlay = document.getElementById('help-overlay');
    helpOverlay.classList.toggle('hidden');
}

/**
 * Toggle fullscreen
 */
function toggleFullscreen() {
    const container = document.getElementById('game-container');
    
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            console.log('Fullscreen request failed:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

/**
 * Format time as MM:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Update stats panel
 */
function updateStats(dt) {
    if (!isGameRunning || isPaused) return;
    
    // Update game time
    totalGameTime += dt;
    document.getElementById('game-time').textContent = formatTime(totalGameTime);
    
    // Update accuracy
    const accuracy = waveAttempts > 0 ? (successfulWaves / waveAttempts * 100).toFixed(0) : 100;
    document.getElementById('accuracy').textContent = accuracy + '%';
    
    // Update streak
    document.getElementById('streak').textContent = currentStreak;
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
 * Trigger external stadium events (mascot/scoreboard)
 */
function triggerStadiumEvent(eventType, sectorId = null) {
    try {
        if (useMockEngine) {
            mockGameAPI.trigger_event(eventType, sectorId);
        } else {
            pyodide.globals.set('event_type', eventType);
            if (sectorId === null || sectorId === undefined) {
                pyodide.runPython('trigger_event(event_type)');
            } else {
                pyodide.globals.set('sector_id', sectorId);
                pyodide.runPython('trigger_event(event_type, sector_id)');
            }
        }
    } catch (error) {
        console.error('Failed to trigger event:', error);
    }
}

/**
 * Start and manage ambient event timers
 */
function clearEventTimers() {
    eventIntervals.forEach(interval => clearInterval(interval));
    eventIntervals = [];
}

function startEventTimers() {
    clearEventTimers();

    // Periodic scoreboard hype
    const scoreboardInterval = setInterval(() => {
        if (!isGameRunning || isPaused || !gameState) return;
        triggerStadiumEvent('scoreboard');
    }, 45000);

    // Occasional mascot distraction aimed at random sector
    const mascotInterval = setInterval(() => {
        if (!isGameRunning || isPaused || !gameState) return;
        const target = Math.floor(Math.random() * gameState.sectors.length);
        triggerStadiumEvent('mascot', target);
    }, 30000);

    eventIntervals.push(scoreboardInterval, mascotInterval);
}

function resetEventIndicators() {
    activeEventIndicators = [];
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
    // Use effective pixel ratio based on performance tier
    const devicePixelRatio = effectivePixelRatio;
    const rect = container.getBoundingClientRect();
    
    // Set display size (CSS pixels)
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // Set actual size (device pixels) - limited by performance tier
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
        precomputeSectorPaths(gameState ? gameState.sectors.length : 16,
                            newDimensions.width / 2, newDimensions.height / 2);

        // Update offscreen canvas size (only if used, which is minimal in current code)
        const devicePixelRatio = effectivePixelRatio;
        offscreenCanvas.width = newDimensions.width * devicePixelRatio;
        offscreenCanvas.height = newDimensions.height * devicePixelRatio;
        offscreenCtx.scale(devicePixelRatio, devicePixelRatio);

        resetFieldGradients();
        
        // Force a redraw without full re-initialization
        if (gameState) {
            render();
        }
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
    const theme = STADIUM_THEMES[stadiumType] || STADIUM_THEMES.classic;
    
    // Helper to convert hex to rgba with alpha
    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    switch (state) {
        case 'idle':
            return hexToRgba(theme.idle, 0.5 + energy * 0.5);
        case 'anticipating':
            return hexToRgba(theme.anticipating, 0.7 + energy * 0.3);
        case 'standing':
            return hexToRgba(theme.standing, 0.8 + energy * 0.2);
        case 'seated':
            return hexToRgba(theme.seated, 0.4 + energy * 0.4);
        default:
            return 'rgba(100, 100, 100, 0.5)';
    }
}

/**
 * Draw crowd sector (optimized with precomputed paths)
 */
function drawSector(sector, index, totalSectors) {
    const geom = getSectorGeometry(index, totalSectors);
    const theme = STADIUM_THEMES[stadiumType] || STADIUM_THEMES.classic;
    
    // Check if this sector is hovered
    const isHovered = index === hoveredSector;
    
    // Use precomputed path if available
    if (geom.path) {
        ctx.fillStyle = getSectorColor(sector);
        ctx.fill(geom.path);
        
        // Hover highlight
        if (isHovered && isGameRunning && !isPaused) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill(geom.path);
        }
        
        // Border
        ctx.strokeStyle = isHovered ? theme.hoverBorder : theme.border;
        ctx.lineWidth = isHovered ? 3 : 2;
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
        
        // Hover highlight
        if (isHovered && isGameRunning && !isPaused) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();
        }
        
        ctx.strokeStyle = isHovered ? theme.hoverBorder : theme.border;
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();
    }
    
    // Draw standing animation (only for medium and high performance tiers)
    if (shouldRenderDetailedAnimations() && 
        (sector.state === 'standing' || sector.state === 'anticipating')) {
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
    
    // Energy bar (simplified for low performance tier)
    if (performanceTier !== 'low') {
        const barWidth = 30;
        const barHeight = 5;
        const barX = textX - barWidth / 2;
        const barY = textY + 15;
        
        // Background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Energy fill with color gradient (only for high performance)
        let energyColor;
        if (shouldRenderExpensiveEffects()) {
            if (sector.energy < 0.3) {
                energyColor = '#f87171';
            } else if (sector.energy < 0.6) {
                energyColor = '#fbbf24';
            } else {
                energyColor = '#4ade80';
            }
        } else {
            // Simplified color for medium performance
            energyColor = sector.energy < 0.5 ? '#fbbf24' : '#4ade80';
        }
        
        ctx.fillStyle = energyColor;
        ctx.fillRect(barX, barY, barWidth * sector.energy, barHeight);
        
        // Border for energy bar (only for high performance)
        if (shouldRenderExpensiveEffects()) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    }
}

/**
 * Draw stadium field (cached gradients for better performance)
 */
function resetFieldGradients() {
    fieldGradients = {};
}

function getFieldGradient(key, builder) {
    if (!fieldGradients[key]) {
        fieldGradients[key] = builder();
    }
    return fieldGradients[key];
}

function drawGrassBase(centerX, centerY, fieldRadius) {
    const gradient = getFieldGradient('base', () => {
        const baseGradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, fieldRadius
        );
        baseGradient.addColorStop(0, '#2d5016');
        baseGradient.addColorStop(1, '#1a3d0a');
        return baseGradient;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
}

function drawSoccerField(centerX, centerY, fieldRadius) {
    drawGrassBase(centerX, centerY, fieldRadius);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
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

    // Penalty boxes (skip for low performance)
    if (performanceTier !== 'low') {
        const boxWidth = fieldRadius * 0.7;
        const boxHeight = fieldRadius * 0.18;
        ctx.strokeRect(centerX - boxWidth / 2, centerY - fieldRadius, boxWidth, boxHeight);
        ctx.strokeRect(centerX - boxWidth / 2, centerY + fieldRadius - boxHeight, boxWidth, boxHeight);

        // Goal boxes
        const goalBoxWidth = fieldRadius * 0.35;
        const goalBoxHeight = fieldRadius * 0.08;
        ctx.strokeRect(centerX - goalBoxWidth / 2, centerY - fieldRadius, goalBoxWidth, goalBoxHeight);
        ctx.strokeRect(centerX - goalBoxWidth / 2, centerY + fieldRadius - goalBoxHeight, goalBoxWidth, goalBoxHeight);
    }

    ctx.restore();
}

function drawBaseballField(centerX, centerY, fieldRadius) {
    // Draw grass base for entire field
    drawGrassBase(centerX, centerY, fieldRadius);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius, 0, Math.PI * 2);
    ctx.clip();

    // Home plate is at the bottom, diamond extends upward
    // Distance from center to home plate (shifted down)
    const homePlateOffset = fieldRadius * 0.45;
    const homePlateY = centerY + homePlateOffset;
    const homePlateX = centerX;
    
    // Diamond dimensions - going counterclockwise from home
    const baseDistance = fieldRadius * 0.5;
    
    // Base positions (counterclockwise from home at bottom)
    // Home -> 1st (right) -> 2nd (top) -> 3rd (left) -> Home
    const firstBaseX = homePlateX + baseDistance * BASEBALL_COS_45;  // 45 degrees
    const firstBaseY = homePlateY - baseDistance * BASEBALL_COS_45;
    
    const secondBaseX = homePlateX;
    const secondBaseY = homePlateY - baseDistance * BASEBALL_COS_45 * 2;  // Diagonal of diamond
    
    const thirdBaseX = homePlateX - baseDistance * BASEBALL_COS_45;
    const thirdBaseY = homePlateY - baseDistance * BASEBALL_COS_45;
    
    // Draw dirt infield (diamond shape)
    ctx.beginPath();
    ctx.moveTo(homePlateX, homePlateY);
    ctx.lineTo(firstBaseX, firstBaseY);
    ctx.lineTo(secondBaseX, secondBaseY);
    ctx.lineTo(thirdBaseX, thirdBaseY);
    ctx.closePath();
    ctx.fillStyle = BASEBALL_FIELD_COLORS.dirt;
    ctx.fill();
    
    // Draw foul lines from home plate spreading to top edge
    ctx.strokeStyle = BASEBALL_FIELD_COLORS.foulLine;
    ctx.lineWidth = 3;
    
    // Left foul line (3rd base line)
    ctx.beginPath();
    ctx.moveTo(homePlateX, homePlateY);
    // Extend through 3rd base to edge
    const leftFoulExtendX = homePlateX - fieldRadius * BASEBALL_FOUL_LINE_EXTENT_H;
    const leftFoulExtendY = centerY - fieldRadius * BASEBALL_FOUL_LINE_EXTENT_V;
    ctx.lineTo(leftFoulExtendX, leftFoulExtendY);
    ctx.stroke();
    
    // Right foul line (1st base line)
    ctx.beginPath();
    ctx.moveTo(homePlateX, homePlateY);
    // Extend through 1st base to edge
    const rightFoulExtendX = homePlateX + fieldRadius * BASEBALL_FOUL_LINE_EXTENT_H;
    const rightFoulExtendY = centerY - fieldRadius * BASEBALL_FOUL_LINE_EXTENT_V;
    ctx.lineTo(rightFoulExtendX, rightFoulExtendY);
    ctx.stroke();
    
    // Draw base paths (connecting the bases)
    ctx.strokeStyle = BASEBALL_FIELD_COLORS.basePath;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(homePlateX, homePlateY);
    ctx.lineTo(firstBaseX, firstBaseY);
    ctx.lineTo(secondBaseX, secondBaseY);
    ctx.lineTo(thirdBaseX, thirdBaseY);
    ctx.closePath();
    ctx.stroke();
    
    // Draw bases (as white squares)
    const baseSize = fieldRadius * 0.035;
    
    // First base
    ctx.save();
    ctx.translate(firstBaseX, firstBaseY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = BASEBALL_FIELD_COLORS.base;
    ctx.fillRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
    ctx.restore();
    
    // Second base
    ctx.save();
    ctx.translate(secondBaseX, secondBaseY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = BASEBALL_FIELD_COLORS.base;
    ctx.fillRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
    ctx.restore();
    
    // Third base
    ctx.save();
    ctx.translate(thirdBaseX, thirdBaseY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = BASEBALL_FIELD_COLORS.base;
    ctx.fillRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
    ctx.restore();
    
    // Pitcher's mound (between home and 2nd, realistic baseball proportions)
    const moundX = homePlateX;
    const moundY = homePlateY - baseDistance * BASEBALL_MOUND_DISTANCE_RATIO;
    ctx.beginPath();
    ctx.arc(moundX, moundY, fieldRadius * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = BASEBALL_FIELD_COLORS.pitchersMound;
    ctx.fill();
    
    // Home plate (pentagon shape pointing toward pitcher)
    const plateWidth = fieldRadius * 0.06;
    const plateHeight = fieldRadius * 0.05;
    ctx.beginPath();
    ctx.moveTo(homePlateX, homePlateY - plateHeight);  // Point toward pitcher
    ctx.lineTo(homePlateX + plateWidth / 2, homePlateY);
    ctx.lineTo(homePlateX + plateWidth / 2, homePlateY + plateHeight / 2);
    ctx.lineTo(homePlateX - plateWidth / 2, homePlateY + plateHeight / 2);
    ctx.lineTo(homePlateX - plateWidth / 2, homePlateY);
    ctx.closePath();
    ctx.fillStyle = BASEBALL_FIELD_COLORS.homePlate;
    ctx.fill();
    
    ctx.restore();
}

function drawFootballField(centerX, centerY, fieldRadius) {
    drawGrassBase(centerX, centerY, fieldRadius);

    const fieldWidth = fieldRadius * 1.6;
    const fieldHeight = fieldRadius * 0.9;
    const top = centerY - fieldHeight / 2;
    const left = centerX - fieldWidth / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, fieldRadius, 0, Math.PI * 2);
    ctx.clip();

    // Alternating stripes (simplified for low performance)
    const stripeCount = performanceTier === 'low' ? 5 : 10;
    const stripeWidth = fieldWidth / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(26, 96, 38, 0.85)' : 'rgba(35, 128, 50, 0.85)';
        ctx.fillRect(left + i * stripeWidth, top, stripeWidth, fieldHeight);
    }

    // End zones
    const endZoneHeight = fieldHeight * 0.12;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(left, top, fieldWidth, endZoneHeight);
    ctx.fillRect(left, top + fieldHeight - endZoneHeight, fieldWidth, endZoneHeight);

    // Yard lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    const yardLineCount = 11;
    for (let i = 0; i <= yardLineCount; i++) {
        const y = top + (i / yardLineCount) * fieldHeight;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + fieldWidth, y);
        ctx.stroke();
    }

    // Hash marks (skip for low performance)
    if (performanceTier !== 'low') {
        const hashMarkSpacing = fieldWidth / 14;
        for (let i = 1; i < 14; i++) {
            const x = left + i * hashMarkSpacing;
            for (let j = 1; j < yardLineCount; j++) {
                const y = top + (j / yardLineCount) * fieldHeight;
                ctx.beginPath();
                ctx.moveTo(x, y - 4);
                ctx.lineTo(x, y + 4);
                ctx.stroke();
            }
        }
    }

    ctx.restore();
}

function drawField() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const centerX = canvas.width / (2 * devicePixelRatio);
    const centerY = canvas.height / (2 * devicePixelRatio);
    const fieldRadius = STADIUM_RADIUS - SECTOR_HEIGHT - 20;

    switch (fieldType) {
        case 'baseball':
            drawBaseballField(centerX, centerY, fieldRadius);
            break;
        case 'football':
            drawFootballField(centerX, centerY, fieldRadius);
            break;
        default:
            drawSoccerField(centerX, centerY, fieldRadius);
            break;
    }
}

function drawEventIndicators() {
    if (!gameState || activeEventIndicators.length === 0) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    const centerX = canvas.width / (2 * devicePixelRatio);
    const centerY = canvas.height / (2 * devicePixelRatio);

    const remainingIndicators = [];
    const now = performance.now();

    activeEventIndicators.forEach(indicator => {
        const progress = (now - indicator.start) / indicator.duration;
        if (progress >= 1) {
            return;
        }

        let x = centerX;
        let y = centerY - STADIUM_RADIUS * 0.4;

        if (indicator.type === 'mascot' && typeof indicator.data?.sector === 'number') {
            const geom = getSectorGeometry(indicator.data.sector, gameState.sectors.length);
            const radius = (geom.innerRadius + geom.outerRadius) / 2;
            x = geom.centerX + Math.cos(geom.angle) * radius;
            y = geom.centerY + Math.sin(geom.angle) * radius;
        }

        const label = indicator.type === 'mascot' ? 'Mascot' : 'Scoreboard';
        const color = indicator.type === 'mascot'
            ? 'rgba(244, 114, 182, 0.85)'
            : 'rgba(56, 189, 248, 0.85)';
        const floatOffset = progress * 16;

        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - floatOffset, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y - floatOffset);
        ctx.restore();

        remainingIndicators.push(indicator);
    });

    activeEventIndicators = remainingIndicators;
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

    drawEventIndicators();

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
let lastHiddenUpdateTime = 0;
function gameLoop(timestamp) {
    if (!isGameRunning) return;
    
    // Monitor performance
    monitorPerformance(timestamp);
    
    const dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
    lastTime = timestamp;
    
    // Cap dt to prevent large jumps
    const cappedDt = Math.min(dt, 0.1);
    
    // Throttle updates when tab is hidden (reduce to ~5 FPS)
    if (!isTabVisible && !isPaused) {
        // Only update every HIDDEN_TAB_UPDATE_INTERVAL when hidden
        const timeSinceLastHiddenUpdate = timestamp - lastHiddenUpdateTime;
        if (timeSinceLastHiddenUpdate < HIDDEN_TAB_UPDATE_INTERVAL) {
            // Skip this frame but continue loop
            animationId = requestAnimationFrame(gameLoop);
            return;
        }
        lastHiddenUpdateTime = timestamp;
    }
    
    // Only update if not paused
    if (!isPaused) {
        // Update game state
        updateGameState(cappedDt);
        
        // Update stats
        updateStats(cappedDt);
    }
    
    // Always render (so we can see pause state)
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
    clearEventTimers();
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
    // Mouse move for hover effects
    canvas.addEventListener('mousemove', (e) => {
        if (!isGameRunning || isPaused) {
            hoveredSector = -1;
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        hoveredSector = getSectorAtPosition(x, y);
    });
    
    // Mouse leave
    canvas.addEventListener('mouseleave', () => {
        hoveredSector = -1;
    });
    
    // Click to start wave
    canvas.addEventListener('click', (e) => {
        if (!isGameRunning || isPaused) return;
        
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
        if (!isGameRunning || isPaused) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const sectorId = getSectorAtPosition(x, y);
        if (sectorId >= 0) {
            boostSector(sectorId);
            showNotification(`Sector ${sectorId} boosted!`, 'success');
        }
    });
    
    // Touch support for mobile devices
    let touchStartTime = 0;
    let touchStartSector = -1;
    
    canvas.addEventListener('touchstart', (e) => {
        if (!isGameRunning || isPaused) return;
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        touchStartSector = getSectorAtPosition(x, y);
        touchStartTime = Date.now();
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        if (!isGameRunning || isPaused) return;
        e.preventDefault();
        
        const touchDuration = Date.now() - touchStartTime;
        
        if (touchStartSector >= 0) {
            // Long press (>500ms) = boost energy
            // Short tap = start wave
            if (touchDuration > 500) {
                boostSector(touchStartSector);
                showNotification(`Sector ${touchStartSector} boosted!`, 'success');
            } else {
                startWave(touchStartSector);
            }
        }
        
        touchStartSector = -1;
        touchStartTime = 0;
    }, { passive: false });
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!isGameRunning) return;
        
        if (e.code === 'Space' && !isPaused) {
            e.preventDefault();
            startWave(0);
        } else if (e.code === 'KeyP') {
            e.preventDefault();
            togglePause();
        } else if (e.code === 'KeyH') {
            e.preventDefault();
            toggleHelp();
        } else if (e.code === 'KeyF') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.code === 'Escape') {
            e.preventDefault();
            // Close help if open, otherwise pause
            const helpOverlay = document.getElementById('help-overlay');
            if (!helpOverlay.classList.contains('hidden')) {
                toggleHelp();
            } else if (!isPaused) {
                togglePause();
            }
        }
    });
    
    // Button handlers
    document.getElementById('help-toggle').addEventListener('click', toggleHelp);
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('resume-btn').addEventListener('click', togglePause);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    document.getElementById('setup-btn').addEventListener('click', returnToSetup);

    const mascotBtn = document.getElementById('mascot-btn');
    if (mascotBtn) {
        mascotBtn.addEventListener('click', () => {
            if (!gameState) return;
            const targetSector = hoveredSector >= 0
                ? hoveredSector
                : Math.floor(Math.random() * gameState.sectors.length);
            triggerStadiumEvent('mascot', targetSector);
        });
    }

    const scoreboardBtn = document.getElementById('scoreboard-btn');
    if (scoreboardBtn) {
        scoreboardBtn.addEventListener('click', () => {
            if (!gameState) return;
            triggerStadiumEvent('scoreboard');
        });
    }
    
    // Settings handlers
    const soundToggle = document.getElementById('sound-toggle');
    const soundTogglePause = document.getElementById('sound-toggle-pause');
    const fieldTypeSelect = document.getElementById('field-type-select');
    const stadiumTypeSelect = document.getElementById('stadium-type-select');
    fieldType = fieldTypeSelect ? fieldTypeSelect.value : 'soccer';
    stadiumType = stadiumTypeSelect ? stadiumTypeSelect.value : 'classic';

    soundToggle.addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
        soundTogglePause.checked = soundEnabled;
    });
    
    soundTogglePause.addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
        soundToggle.checked = soundEnabled;
    });
    
    document.getElementById('difficulty-select').addEventListener('change', (e) => {
        difficulty = e.target.value;
        console.log('Difficulty set to:', difficulty);
    });

    if (fieldTypeSelect) {
        fieldTypeSelect.addEventListener('change', (e) => {
            fieldType = e.target.value;
            resetFieldGradients();

            if (gameState) {
                render();
            }
        });
    }

    if (stadiumTypeSelect) {
        stadiumTypeSelect.addEventListener('change', (e) => {
            stadiumType = e.target.value;
            
            if (gameState) {
                render();
            }
        });
    }

    document.getElementById('volume-slider').addEventListener('input', (e) => {
        const volume = e.target.value;
        document.getElementById('volume-label').textContent = volume + '%';
    });
}

/**
 * Start the game
 */
function startGame() {
    document.getElementById('tutorial').classList.add('hidden');
    document.getElementById('game-title').classList.remove('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('controls').classList.remove('hidden');
    document.getElementById('help-toggle').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('hidden');
    document.getElementById('stats-panel').classList.remove('hidden');
    
    // Reset game stats
    gameStartTime = Date.now();
    totalGameTime = 0;
    waveAttempts = 0;
    successfulWaves = 0;
    currentStreak = 0;
    
    // Get settings
    soundEnabled = document.getElementById('sound-toggle').checked;
    difficulty = document.getElementById('difficulty-select').value;
    const fieldTypeSelectElem = document.getElementById('field-type-select');
    const stadiumTypeSelectElem = document.getElementById('stadium-type-select');
    fieldType = fieldTypeSelectElem ? fieldTypeSelectElem.value : 'soccer';
    stadiumType = stadiumTypeSelectElem ? stadiumTypeSelectElem.value : 'classic';
    resetFieldGradients();
    resetEventIndicators();

    initGame();
    startEventTimers();
    startGameLoop();
}

/**
 * Restart the game
 */
function restartGame() {
    // Stop the current game loop
    stopGameLoop();
    
    // Reset game stats
    gameStartTime = Date.now();
    totalGameTime = 0;
    waveAttempts = 0;
    successfulWaves = 0;
    currentStreak = 0;
    
    // Hide pause overlay if it's showing
    document.getElementById('pause-overlay').classList.add('hidden');
    isPaused = false;
    
    // Reset pause button
    const pauseBtn = document.getElementById('pause-btn');
    pauseBtn.textContent = '⏸';
    pauseBtn.title = 'Pause Game';

    // Re-initialize game
    resetFieldGradients();
    resetEventIndicators();
    initGame();
    startEventTimers();
    startGameLoop();
}

/**
 * Return to the setup screen so players can change options
 */
function returnToSetup() {
    stopGameLoop();
    isPaused = false;
    gameState = null;
    hoveredSector = -1;
    resetFieldGradients();
    resetEventIndicators();

    const pauseBtn = document.getElementById('pause-btn');
    pauseBtn.textContent = '⏸';
    pauseBtn.title = 'Pause Game';

    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('help-overlay').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('controls').classList.add('hidden');
    document.getElementById('help-toggle').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden');
    document.getElementById('stats-panel').classList.add('hidden');
    document.getElementById('game-title').classList.add('hidden');
    document.getElementById('tutorial').classList.remove('hidden');

    // Reset surface stats for the next run
    document.getElementById('game-time').textContent = '0:00';
    document.getElementById('accuracy').textContent = '100%';
    document.getElementById('streak').textContent = '0';
    document.getElementById('score').textContent = '0';
    document.getElementById('combo').textContent = '0x';
    document.getElementById('waves').textContent = '0';
    document.getElementById('max-combo').textContent = '0x';
}

/**
 * Main initialization
 */
async function main() {
    console.log('Initializing Stadium Wave Game...');
    
    // Detect device capabilities and set performance tier
    detectPerformanceTier();
    
    // Setup visibility handler for tab backgrounding
    setupVisibilityHandler();
    
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
