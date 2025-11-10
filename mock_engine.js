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
    }

    start_wave(sector_id) {
        if (this.wave_active) {
            return false;
        }
        
        const sector = this.sectors[sector_id];
        if (sector.start_wave()) {
            this.wave_active = true;
            this.wave_start_sector = sector_id;
            this.current_wave_sector = sector_id;
            this.wave_timer = 0.0;
            this.schedule_event('wave_started', sector_id);
            return true;
        }
        return false;
    }

    update(dt) {
        this.time_elapsed += dt;
        
        for (const sector of this.sectors) {
            sector.update(dt);
        }
        
        if (this.wave_active) {
            this.wave_timer += dt;
            
            const current = this.sectors[this.current_wave_sector];
            if (current.state === MockSectorState.ANTICIPATING) {
                if (this.wave_timer > 0.2) {
                    if (current.stand_up()) {
                        this.combo += 1;
                        this.score += 10 * this.combo;
                    }
                }
            }
            
            if (this.wave_timer >= this.wave_speed) {
                const next_sector_id = (this.current_wave_sector + 1) % this.num_sectors;
                const next_sector = this.sectors[next_sector_id];
                
                if (next_sector_id === this.wave_start_sector) {
                    this.complete_wave();
                } else {
                    if (next_sector.start_wave()) {
                        this.current_wave_sector = next_sector_id;
                        this.wave_timer = 0.0;
                    } else {
                        this.fail_wave();
                    }
                }
            }
        }
    }

    complete_wave() {
        this.wave_active = false;
        this.successful_waves += 1;
        const bonus = 100 * (1 + this.combo * 0.5);
        this.score += Math.floor(bonus);
        this.max_combo = Math.max(this.max_combo, this.combo);
        this.schedule_event('wave_completed', {
            combo: this.combo,
            bonus: bonus
        });
    }

    fail_wave() {
        this.wave_active = false;
        this.failed_waves += 1;
        this.combo = 0;
        this.schedule_event('wave_failed', this.current_wave_sector);
    }

    boost_sector(sector_id) {
        if (sector_id >= 0 && sector_id < this.num_sectors) {
            this.sectors[sector_id].boost_energy();
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
            time_elapsed: this.time_elapsed
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
    
    start_wave_at(sector_id) {
        const success = this.game.start_wave(sector_id);
        return JSON.stringify({ success, sector: sector_id });
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
    }
};
