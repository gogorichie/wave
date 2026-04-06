/**
 * Mock Python game engine for demo/testing when Pyodide is unavailable
 * Provides the same API as the Python engine but runs in pure JavaScript
 */

class MockSectorState {
    static IDLE = "idle";
    static ANTICIPATING = "anticipating";
    static STANDING = "standing";
    static SEATED = "seated";
}

class MockCrowdSector {
    constructor(sectorId, size = 100) {
        this.sector_id = sectorId;
        this.size = size;
        this.state = MockSectorState.IDLE;
        this.energy = 0.5;
        this.fatigue = 0.0;
        this.enthusiasm = Math.random() * 0.3 + 0.6;
        this.distractions = 0.0;
        this.timer = 0;
    }

    update(dt) {
        if (this.fatigue > 0) {
            this.fatigue = Math.max(0, this.fatigue - dt * 0.05);
        }
        
        if (this.energy < 1.0) {
            this.energy = Math.min(1.0, this.energy + dt * 0.1);
        }
        
        if (this.state === MockSectorState.STANDING) {
            this.timer += dt;
            if (this.timer > 1.5) {
                this.sit_down();
            }
        } else if (this.state === MockSectorState.ANTICIPATING) {
            this.timer += dt;
            if (this.timer > 0.5) {
                this.state = MockSectorState.IDLE;
                this.timer = 0;
            }
        }
    }

    can_wave() {
        const readiness = (this.energy * this.enthusiasm) - (this.fatigue + this.distractions);
        return readiness > 0.3 && 
               (this.state === MockSectorState.IDLE || this.state === MockSectorState.SEATED);
    }

    start_wave() {
        if (this.can_wave()) {
            this.state = MockSectorState.ANTICIPATING;
            this.timer = 0;
            return true;
        }
        return false;
    }

    stand_up() {
        if (this.state === MockSectorState.ANTICIPATING) {
            this.state = MockSectorState.STANDING;
            this.timer = 0;
            this.energy = Math.max(0, this.energy - 0.2);
            this.fatigue = Math.min(1.0, this.fatigue + 0.1);
            return true;
        }
        return false;
    }

    sit_down() {
        this.state = MockSectorState.SEATED;
        this.timer = 0;
    }

    boost_energy(amount = 0.3) {
        this.energy = Math.min(1.0, this.energy + amount);
        this.distractions = Math.max(0, this.distractions - 0.1);
    }

    to_dict() {
        return {
            id: this.sector_id,
            state: this.state,
            energy: this.energy,
            fatigue: this.fatigue,
            enthusiasm: this.enthusiasm,
            distractions: this.distractions
        };
    }
}

class MockWaveGame {
    constructor(num_sectors = 16) {
        this.num_sectors = num_sectors;
        this.sectors = [];
        for (let i = 0; i < num_sectors; i++) {
            this.sectors.push(new MockCrowdSector(i, Math.floor(Math.random() * 40) + 80));
        }
        this.score = 0;
        this.combo = 0;
        this.max_combo = 0;
        this.wave_active = false;
        this.wave_start_sector = -1;
        this.current_wave_sector = -1;
        this.time_elapsed = 0.0;
        this.successful_waves = 0;
        this.failed_waves = 0;
        this.wave_speed = 0.3;
        this.wave_timer = 0.0;
        this.events = [];
        this.stadium_level = 1;
        this.unlocks = [];

        // Special wave pattern support
        this.wave_pattern = 'normal';  // normal, reverse, double, accelerating
        this.wave_direction = 1;  // 1 for clockwise, -1 for counter-clockwise
        this.base_wave_speed = 0.3;
        this.speed_increment = 0.0;  // for accelerating pattern
        this.sectors_traveled = 0;

        // Double wave support
        this.second_wave_active = false;
        this.second_wave_start_sector = -1;
        this.second_current_wave_sector = -1;
        this.second_wave_timer = 0.0;
    }

    selectWavePattern() {
        // Randomly select a wave pattern
        const patterns = ['normal', 'reverse', 'double', 'accelerating'];
        const rand = Math.random();

        if (rand < 0.4) {
            this.wave_pattern = 'normal';
        } else if (rand < 0.6) {
            this.wave_pattern = 'reverse';
        } else if (rand < 0.8) {
            this.wave_pattern = 'double';
        } else {
            this.wave_pattern = 'accelerating';
        }

        if (this.wave_pattern === 'reverse') {
            this.wave_direction = -1;
        } else if (this.wave_pattern === 'double') {
            this.wave_direction = 1;
        } else if (this.wave_pattern === 'accelerating') {
            this.wave_direction = 1;
            this.speed_increment = -0.015;  // Get faster over time
        } else {  // normal
            this.wave_direction = 1;
        }

        this.sectors_traveled = 0;
        this.wave_speed = this.base_wave_speed;
    }

    start_wave(sector_id, pattern = null) {
        if (this.wave_active) {
            return false;
        }

        const sector = this.sectors[sector_id];
        if (sector.start_wave()) {
            // Select pattern (use provided or random)
            if (pattern) {
                this.wave_pattern = pattern;
                // Set direction and speed based on pattern
                if (this.wave_pattern === 'reverse') {
                    this.wave_direction = -1;
                } else if (this.wave_pattern === 'double') {
                    this.wave_direction = 1;
                } else if (this.wave_pattern === 'accelerating') {
                    this.wave_direction = 1;
                    this.speed_increment = -0.015;
                } else {  // normal
                    this.wave_direction = 1;
                }
                this.sectors_traveled = 0;
                this.wave_speed = this.base_wave_speed;
            } else {
                this.selectWavePattern();
            }

            this.wave_active = true;
            this.wave_start_sector = sector_id;
            this.current_wave_sector = sector_id;
            this.wave_timer = 0.0;

            // For double wave, start second wave on opposite side
            if (this.wave_pattern === 'double') {
                const opposite_sector = (sector_id + Math.floor(this.num_sectors / 2)) % this.num_sectors;
                if (this.sectors[opposite_sector].start_wave()) {
                    this.second_wave_active = true;
                    this.second_wave_start_sector = opposite_sector;
                    this.second_current_wave_sector = opposite_sector;
                    this.second_wave_timer = 0.0;
                }
            }

            this.schedule_event('wave_started', {
                sector: sector_id,
                pattern: this.wave_pattern,
                direction: this.wave_direction === 1 ? 'clockwise' : 'counter-clockwise'
            });
            return true;
        }
        return false;
    }

    update(dt) {
        this.time_elapsed += dt;

        for (const sector of this.sectors) {
            sector.update(dt);
        }

        // Handle wave propagation for first wave
        if (this.wave_active) {
            this._updateWave(dt, false);
        }

        // Handle second wave for double pattern
        if (this.second_wave_active) {
            this._updateWave(dt, true);
        }
    }

    _updateWave(dt, isSecondWave = false) {
        // Get appropriate wave state
        let waveTimer = isSecondWave ? this.second_wave_timer : this.wave_timer;
        let currentSector = isSecondWave ? this.second_current_wave_sector : this.current_wave_sector;
        let startSector = isSecondWave ? this.second_wave_start_sector : this.wave_start_sector;

        waveTimer += dt;

        // Check if anticipating sector should stand
        const current = this.sectors[currentSector];
        if (current.state === MockSectorState.ANTICIPATING) {
            if (waveTimer > 0.2) {
                if (current.stand_up()) {
                    this.combo += 1;
                    this.score += 10 * this.combo;
                }
            }
        }

        // Propagate wave to next sector
        if (waveTimer >= this.wave_speed) {
            // For accelerating pattern, increase speed
            if (this.wave_pattern === 'accelerating' && !isSecondWave) {
                this.wave_speed = Math.max(0.1, this.wave_speed + this.speed_increment);
                this.sectors_traveled += 1;
            }

            // Calculate next sector based on direction
            let next_sector_id = (currentSector + this.wave_direction + this.num_sectors) % this.num_sectors;
            const next_sector = this.sectors[next_sector_id];

            // Check if wave completed full circle
            if (next_sector_id === startSector) {
                if (isSecondWave) {
                    this.second_wave_active = false;
                    // Check if both waves completed
                    if (!this.wave_active) {
                        this.complete_wave();
                    }
                } else {
                    // For double wave, wait for second wave to complete
                    this.wave_active = false;
                    if (!this.second_wave_active || this.wave_pattern !== 'double') {
                        this.complete_wave();
                    }
                }
            } else {
                // Propagate to next sector
                if (next_sector.start_wave()) {
                    if (isSecondWave) {
                        this.second_current_wave_sector = next_sector_id;
                        this.second_wave_timer = 0.0;
                    } else {
                        this.current_wave_sector = next_sector_id;
                        this.wave_timer = 0.0;
                    }
                } else {
                    // Wave failed
                    if (isSecondWave) {
                        this.second_wave_active = false;
                    } else {
                        this.wave_active = false;
                        this.second_wave_active = false;  // Both waves fail
                    }
                    this.fail_wave();
                }
            }
        }

        // Update timer
        if (isSecondWave) {
            this.second_wave_timer = waveTimer;
        } else {
            this.wave_timer = waveTimer;
        }
    }

    complete_wave() {
        this.wave_active = false;
        this.second_wave_active = false;
        this.successful_waves += 1;

        // Bonus multiplier for special patterns
        let pattern_bonus = 1.0;
        if (this.wave_pattern === 'reverse') {
            pattern_bonus = 1.5;
        } else if (this.wave_pattern === 'double') {
            pattern_bonus = 2.0;
        } else if (this.wave_pattern === 'accelerating') {
            pattern_bonus = 1.3;
        }

        const bonus = 100 * (1 + this.combo * 0.5) * pattern_bonus;
        this.score += Math.floor(bonus);
        this.max_combo = Math.max(this.max_combo, this.combo);
        this.schedule_event('wave_completed', {
            combo: this.combo,
            bonus: bonus,
            pattern: this.wave_pattern
        });
    }

    fail_wave() {
        this.wave_active = false;
        this.second_wave_active = false;
        this.failed_waves += 1;
        this.combo = 0;
        this.schedule_event('wave_failed', {
            sector: this.current_wave_sector,
            pattern: this.wave_pattern
        });
    }

    boost_sector(sector_id) {
        if (sector_id >= 0 && sector_id < this.num_sectors) {
            this.sectors[sector_id].boost_energy();
        }
    }

    trigger_event(event_type, sector_id = null) {
        if (event_type === 'mascot') {
            if (sector_id !== null && sector_id !== undefined) {
                for (let i = -1; i <= 1; i++) {
                    const idx = (sector_id + i + this.num_sectors) % this.num_sectors;
                    this.sectors[idx].distractions = Math.min(1.0, this.sectors[idx].distractions + 0.3);
                }
            }

            const affected = sector_id === null || sector_id === undefined
                ? []
                : [-1, 0, 1].map(i => (sector_id + i + this.num_sectors) % this.num_sectors);

            this.schedule_event('mascot', {
                sector: sector_id,
                affected,
                effect: 'distraction'
            });
        } else if (event_type === 'scoreboard') {
            this.sectors.forEach(sector => sector.boost_energy(0.2));
            this.schedule_event('scoreboard', {
                boost: 0.2,
                effect: 'energy'
            });
        }
    }

    schedule_event(event_type, data = null) {
        this.events.push({
            type: event_type,
            data: data,
            time: this.time_elapsed
        });
    }

    get_events() {
        const events = [...this.events];
        this.events = [];
        return events;
    }

    get_state() {
        return {
            sectors: this.sectors.map(s => s.to_dict()),
            score: this.score,
            combo: this.combo,
            max_combo: this.max_combo,
            wave_active: this.wave_active,
            current_wave_sector: this.current_wave_sector,
            successful_waves: this.successful_waves,
            failed_waves: this.failed_waves,
            stadium_level: this.stadium_level,
            time_elapsed: this.time_elapsed,
            wave_pattern: this.wave_pattern,
            wave_direction: this.wave_direction,
            second_wave_active: this.second_wave_active,
            second_current_wave_sector: this.second_current_wave_sector
        };
    }

    save_state() {
        const state = this.get_state();
        state.unlocks = this.unlocks;
        return JSON.stringify(state);
    }

    load_state(json_str) {
        const state = JSON.parse(json_str);
        this.score = state.score || 0;
        this.max_combo = state.max_combo || 0;
        this.successful_waves = state.successful_waves || 0;
        this.stadium_level = state.stadium_level || 1;
        this.unlocks = state.unlocks || [];
    }
}

// Export mock game API
export const mockGameAPI = {
    game: null,
    
    init_game(num_sectors = 16) {
        this.game = new MockWaveGame(num_sectors);
        return JSON.stringify({ status: 'initialized', sectors: num_sectors });
    },
    
    update_game(dt) {
        this.game.update(dt);
        return JSON.stringify(this.game.get_state());
    },
    
    start_wave_at(sector_id, pattern = null) {
        const success = this.game.start_wave(sector_id, pattern);
        return JSON.stringify({ success, sector: sector_id, pattern: this.game.wave_pattern });
    },
    
    boost_sector_energy(sector_id) {
        this.game.boost_sector(sector_id);
        return JSON.stringify({ boosted: sector_id });
    },
    
    get_game_state() {
        return JSON.stringify(this.game.get_state());
    },
    
    get_events() {
        return JSON.stringify(this.game.get_events());
    },
    
    save_game() {
        return this.game.save_state();
    },

    load_game(save_data) {
        try {
            this.game.load_state(save_data);
            return JSON.stringify({ status: 'loaded' });
        } catch (e) {
            return JSON.stringify({ status: 'error', message: e.message });
        }
    },

    trigger_event(event_type, sector_id = null) {
        this.game.trigger_event(event_type, sector_id);
        return JSON.stringify({ status: 'triggered', event: event_type, sector: sector_id });
    }
};
