"""
Stadium Wave Game - Python Game Engine
Main game state manager and wave propagation logic
"""
import random
from enum import Enum
from typing import List, Dict, Optional
import json


class SectorState(Enum):
    """States for individual crowd sectors"""
    IDLE = "idle"
    ANTICIPATING = "anticipating"
    STANDING = "standing"
    SEATED = "seated"


class CrowdSector:
    """Represents a section of the stadium crowd"""
    
    def __init__(self, sector_id: int, size: int = 100):
        self.sector_id = sector_id
        self.size = size
        self.state = SectorState.IDLE
        self.energy = 0.5  # 0.0 to 1.0
        self.fatigue = 0.0  # 0.0 to 1.0
        self.enthusiasm = random.uniform(0.6, 0.9)
        self.distractions = 0.0
        self.timer = 0
        
    def update(self, dt: float):
        """Update sector state over time"""
        # Validate dt to prevent negative or non-numeric values
        if not isinstance(dt, (int, float)) or dt < 0:
            dt = 0.0

        # Recover energy slowly
        if self.fatigue > 0:
            self.fatigue = max(0, self.fatigue - dt * 0.05)

        # Energy regeneration
        if self.energy < 1.0:
            self.energy = min(1.0, self.energy + dt * 0.1)

        # Handle state transitions
        if self.state == SectorState.STANDING:
            self.timer += dt
            if self.timer > 1.5:  # Stand for 1.5 seconds
                self.sit_down()

        elif self.state == SectorState.ANTICIPATING:
            self.timer += dt
            if self.timer > 0.5:  # Anticipate for 0.5 seconds
                self.state = SectorState.IDLE
                self.timer = 0
    
    def can_wave(self) -> bool:
        """Check if sector is ready to participate in wave"""
        readiness = (self.energy * self.enthusiasm) - (self.fatigue + self.distractions)
        return readiness > 0.3 and self.state in [SectorState.IDLE, SectorState.SEATED]
    
    def start_wave(self):
        """Trigger wave in this sector"""
        if self.can_wave():
            self.state = SectorState.ANTICIPATING
            self.timer = 0
            return True
        return False
    
    def stand_up(self):
        """Stand up for the wave"""
        if self.state == SectorState.ANTICIPATING:
            self.state = SectorState.STANDING
            self.timer = 0
            self.energy = max(0, self.energy - 0.2)
            self.fatigue = min(1.0, self.fatigue + 0.1)
            return True
        return False
    
    def sit_down(self):
        """Sit back down after wave"""
        self.state = SectorState.SEATED
        self.timer = 0
        
    def boost_energy(self, amount: float = 0.3):
        """Player boosts sector energy"""
        self.energy = min(1.0, self.energy + amount)
        self.distractions = max(0, self.distractions - 0.1)
        
    def add_distraction(self, amount: float = 0.2):
        """External event distracts crowd"""
        self.distractions = min(1.0, self.distractions + amount)
        
    def to_dict(self) -> Dict:
        """Serialize sector state for JS rendering"""
        return {
            'id': self.sector_id,
            'state': self.state.value,
            'energy': self.energy,
            'fatigue': self.fatigue,
            'enthusiasm': self.enthusiasm,
            'distractions': self.distractions
        }


class WaveGame:
    """Main game state manager"""

    def __init__(self, num_sectors: int = 16):
        self.num_sectors = num_sectors
        self.sectors: List[CrowdSector] = [
            CrowdSector(i, size=random.randint(80, 120))
            for i in range(num_sectors)
        ]
        self.score = 0
        self.combo = 0
        self.max_combo = 0
        self.wave_active = False
        self.wave_start_sector = -1
        self.current_wave_sector = -1
        self.time_elapsed = 0.0
        self.successful_waves = 0
        self.failed_waves = 0
        self.wave_speed = 0.3  # seconds between sectors
        self.wave_timer = 0.0
        self.events = []
        self.stadium_level = 1
        self.unlocks = []

        # Special wave pattern support
        self.wave_pattern = 'normal'  # normal, reverse, double, accelerating
        self.wave_direction = 1  # 1 for clockwise, -1 for counter-clockwise
        self.base_wave_speed = 0.3
        self.speed_increment = 0.0  # for accelerating pattern
        self.sectors_traveled = 0

        # Double wave support
        self.second_wave_active = False
        self.second_wave_start_sector = -1
        self.second_current_wave_sector = -1
        self.second_wave_timer = 0.0
        
    def select_wave_pattern(self):
        """Randomly select a wave pattern"""
        patterns = ['normal', 'reverse', 'double', 'accelerating']
        weights = [0.4, 0.2, 0.2, 0.2]  # Normal is most common
        self.wave_pattern = random.choices(patterns, weights=weights)[0]

        if self.wave_pattern == 'reverse':
            self.wave_direction = -1
        elif self.wave_pattern == 'double':
            self.wave_direction = 1
        elif self.wave_pattern == 'accelerating':
            self.wave_direction = 1
            self.speed_increment = -0.015  # Get faster over time
        else:  # normal
            self.wave_direction = 1

        self.sectors_traveled = 0
        self.wave_speed = self.base_wave_speed

    def start_wave(self, sector_id: int, pattern: Optional[str] = None) -> bool:
        """Player initiates wave from specific sector"""
        if self.wave_active:
            return False

        # Validate sector_id
        if not isinstance(sector_id, int) or sector_id < 0 or sector_id >= self.num_sectors:
            return False


        sector = self.sectors[sector_id]
        if sector.start_wave():
            # Select pattern (use provided or random)
            if pattern:
                self.wave_pattern = pattern
                # Set direction and speed based on pattern
                if self.wave_pattern == 'reverse':
                    self.wave_direction = -1
                elif self.wave_pattern == 'double':
                    self.wave_direction = 1
                elif self.wave_pattern == 'accelerating':
                    self.wave_direction = 1
                    self.speed_increment = -0.015
                else:  # normal
                    self.wave_direction = 1
                self.sectors_traveled = 0
                self.wave_speed = self.base_wave_speed
            else:
                self.select_wave_pattern()

            self.wave_active = True
            self.wave_start_sector = sector_id
            self.current_wave_sector = sector_id
            self.wave_timer = 0.0

            # For double wave, start second wave on opposite side
            if self.wave_pattern == 'double':
                opposite_sector = (sector_id + self.num_sectors // 2) % self.num_sectors
                if self.sectors[opposite_sector].start_wave():
                    self.second_wave_active = True
                    self.second_wave_start_sector = opposite_sector
                    self.second_current_wave_sector = opposite_sector
                    self.second_wave_timer = 0.0

            self.schedule_event('wave_started', {
                'sector': sector_id,
                'pattern': self.wave_pattern,
                'direction': 'clockwise' if self.wave_direction == 1 else 'counter-clockwise'
            })
            return True
        return False
    
    def update(self, dt: float):
        """Update game state"""
        # Validate dt to prevent negative or non-numeric values
        if not isinstance(dt, (int, float)) or dt < 0:
            dt = 0.0

        self.time_elapsed += dt

        # Update all sectors
        for sector in self.sectors:
            sector.update(dt)

        # Handle wave propagation for first wave
        if self.wave_active:
            self._update_wave(dt, is_second_wave=False)

        # Handle second wave for double pattern
        if self.second_wave_active:
            self._update_wave(dt, is_second_wave=True)

        # Process scheduled events
        self.process_events()

    def _update_wave(self, dt: float, is_second_wave: bool = False):
        """Update a single wave (primary or secondary for double pattern)"""
        if is_second_wave:
            wave_timer = self.second_wave_timer
            current_sector = self.second_current_wave_sector
            start_sector = self.second_wave_start_sector
        else:
            wave_timer = self.wave_timer
            current_sector = self.current_wave_sector
            start_sector = self.wave_start_sector

        wave_timer += dt

        # Check if anticipating sector should stand
        current = self.sectors[current_sector]
        if current.state == SectorState.ANTICIPATING:
            # Stand up after brief anticipation
            if wave_timer > 0.2:
                if current.stand_up():
                    self.combo += 1
                    self.score += 10 * self.combo

        # Propagate wave to next sector
        if wave_timer >= self.wave_speed:
            # For accelerating pattern, increase speed
            if self.wave_pattern == 'accelerating' and not is_second_wave:
                self.wave_speed = max(0.1, self.wave_speed + self.speed_increment)
                self.sectors_traveled += 1

            # Calculate next sector based on direction
            next_sector_id = (current_sector + self.wave_direction) % self.num_sectors
            next_sector = self.sectors[next_sector_id]

            # Check if wave completed full circle
            if next_sector_id == start_sector:
                if is_second_wave:
                    self.second_wave_active = False
                    # Check if both waves completed
                    if not self.wave_active:
                        self.complete_wave()
                else:
                    # For double wave, wait for second wave to complete
                    self.wave_active = False
                    if not self.second_wave_active or self.wave_pattern != 'double':
                        self.complete_wave()
            else:
                # Propagate to next sector
                if next_sector.start_wave():
                    if is_second_wave:
                        self.second_current_wave_sector = next_sector_id
                        self.second_wave_timer = 0.0
                    else:
                        self.current_wave_sector = next_sector_id
                        self.wave_timer = 0.0
                else:
                    # Wave failed
                    if is_second_wave:
                        self.second_wave_active = False
                    else:
                        self.wave_active = False
                        self.second_wave_active = False  # Both waves fail
                    self.fail_wave()

        # Update timer
        if is_second_wave:
            self.second_wave_timer = wave_timer
        else:
            self.wave_timer = wave_timer
        
    def complete_wave(self):
        """Wave successfully completed full stadium"""
        self.wave_active = False
        self.second_wave_active = False
        self.successful_waves += 1

        # Bonus multiplier for special patterns
        pattern_bonus = 1.0
        if self.wave_pattern == 'reverse':
            pattern_bonus = 1.5
        elif self.wave_pattern == 'double':
            pattern_bonus = 2.0
        elif self.wave_pattern == 'accelerating':
            pattern_bonus = 1.3

        bonus = 100 * (1 + self.combo * 0.5) * pattern_bonus
        self.score += int(bonus)
        self.max_combo = max(self.max_combo, self.combo)
        self.schedule_event('wave_completed', {
            'combo': self.combo,
            'bonus': bonus,
            'pattern': self.wave_pattern
        })

    def fail_wave(self):
        """Wave failed to propagate"""
        self.wave_active = False
        self.second_wave_active = False
        self.failed_waves += 1
        self.combo = 0
        self.schedule_event('wave_failed', {
            'sector': self.current_wave_sector,
            'pattern': self.wave_pattern
        })
        
    def boost_sector(self, sector_id: int):
        """Player boosts energy of a sector"""
        if 0 <= sector_id < self.num_sectors:
            self.sectors[sector_id].boost_energy()
            
    def trigger_event(self, event_type: str, sector_id: Optional[int] = None):
        """Trigger external event affecting crowd"""
        if event_type == 'mascot':
            # Mascot distracts nearby sectors
            if sector_id is not None:
                for i in range(-1, 2):
                    idx = (sector_id + i) % self.num_sectors
                    self.sectors[idx].add_distraction(0.3)
            affected = []
            if sector_id is not None:
                affected = [((sector_id + i) % self.num_sectors) for i in range(-1, 2)]

            self.schedule_event('mascot', {
                'sector': sector_id,
                'affected': affected,
                'effect': 'distraction'
            })
        elif event_type == 'scoreboard':
            # Scoreboard boosts all sectors
            for sector in self.sectors:
                sector.boost_energy(0.2)
            self.schedule_event('scoreboard', {
                'boost': 0.2,
                'effect': 'energy'
            })
                
    def schedule_event(self, event_type: str, data=None):
        """Schedule event for processing"""
        self.events.append({
            'type': event_type,
            'data': data,
            'time': self.time_elapsed
        })
        
    def process_events(self):
        """Process and clear events (for JS consumption)"""
        # Events are cleared by get_events()
        pass
        
    def get_events(self) -> List[Dict]:
        """Get and clear pending events for JS"""
        events = self.events.copy()
        self.events.clear()
        return events
        
    def get_state(self) -> Dict:
        """Get full game state for rendering"""
        return {
            'sectors': [s.to_dict() for s in self.sectors],
            'score': self.score,
            'combo': self.combo,
            'max_combo': self.max_combo,
            'wave_active': self.wave_active,
            'current_wave_sector': self.current_wave_sector,
            'successful_waves': self.successful_waves,
            'failed_waves': self.failed_waves,
            'stadium_level': self.stadium_level,
            'time_elapsed': self.time_elapsed,
            'wave_pattern': self.wave_pattern,
            'wave_direction': self.wave_direction,
            'second_wave_active': self.second_wave_active,
            'second_current_wave_sector': self.second_current_wave_sector
        }
    
    def save_state(self) -> str:
        """Serialize game state to JSON"""
        state = self.get_state()
        state['unlocks'] = self.unlocks
        return json.dumps(state)
    
    def load_state(self, json_str: str):
        """Load game state from JSON"""
        state = json.loads(json_str)
        self.score = state.get('score', 0)
        self.max_combo = state.get('max_combo', 0)
        self.successful_waves = state.get('successful_waves', 0)
        self.stadium_level = state.get('stadium_level', 1)
        self.unlocks = state.get('unlocks', [])


# Global game instance for Pyodide
game = WaveGame()


def init_game(num_sectors: int = 16) -> str:
    """Initialize new game"""
    global game
    game = WaveGame(num_sectors)
    return json.dumps({'status': 'initialized', 'sectors': num_sectors})


def update_game(dt: float) -> str:
    """Update game state - returns JSON state"""
    game.update(dt)
    return json.dumps(game.get_state())


def start_wave_at(sector_id: int, pattern: Optional[str] = None) -> str:
    """Start wave from sector"""
    success = game.start_wave(sector_id, pattern)
    return json.dumps({'success': success, 'sector': sector_id, 'pattern': game.wave_pattern})


def boost_sector_energy(sector_id: int) -> str:
    """Boost sector energy"""
    game.boost_sector(sector_id)
    return json.dumps({'boosted': sector_id})


def get_game_state() -> str:
    """Get current game state as JSON"""
    return json.dumps(game.get_state())


def get_events() -> str:
    """Get pending events"""
    return json.dumps(game.get_events())


def trigger_event(event_type: str, sector_id: Optional[int] = None) -> str:
    """Trigger an external stadium event"""
    game.trigger_event(event_type, sector_id)
    return json.dumps({'status': 'triggered', 'event': event_type, 'sector': sector_id})


def save_game() -> str:
    """Save game state"""
    return game.save_state()


def load_game(save_data: str) -> str:
    """Load game state"""
    try:
        game.load_state(save_data)
        return json.dumps({'status': 'loaded'})
    except Exception as e:
        return json.dumps({'status': 'error', 'message': str(e)})
