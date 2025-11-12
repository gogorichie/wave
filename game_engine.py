"""
Stadium Wave Game - Python Game Engine
Main game state manager and wave propagation logic
"""
import random
from enum import Enum
from typing import List, Dict, Optional
import json


class StadiumVenue(Enum):
    """Available stadium venues with different characteristics"""
    BASEBALL = "baseball"
    SOCCER = "soccer"
    CRICKET = "cricket"


# Venue configurations defining difficulty and characteristics
VENUE_CONFIGS = {
    StadiumVenue.BASEBALL: {
        'name': 'Baseball Stadium',
        'description': 'Classic American ballpark - Easy difficulty',
        'num_sectors': 16,
        'wave_speed': 0.35,  # Slower = easier
        'energy_drain': 0.15,  # Lower = easier
        'base_enthusiasm': 0.75,  # Higher = easier
        'difficulty': 'Easy'
    },
    StadiumVenue.SOCCER: {
        'name': 'Soccer Stadium',
        'description': 'International football arena - Medium difficulty',
        'num_sectors': 20,
        'wave_speed': 0.3,
        'energy_drain': 0.2,
        'base_enthusiasm': 0.70,
        'difficulty': 'Medium'
    },
    StadiumVenue.CRICKET: {
        'name': 'Cricket Ground',
        'description': 'Traditional cricket oval - Hard difficulty',
        'num_sectors': 24,
        'wave_speed': 0.25,  # Faster = harder
        'energy_drain': 0.25,  # Higher = harder
        'base_enthusiasm': 0.65,  # Lower = harder
        'difficulty': 'Hard'
    }
}


class SectorState(Enum):
    """States for individual crowd sectors"""
    IDLE = "idle"
    ANTICIPATING = "anticipating"
    STANDING = "standing"
    SEATED = "seated"


class CrowdSector:
    """Represents a section of the stadium crowd"""
    
    def __init__(self, sector_id: int, size: int = 100, base_enthusiasm: float = 0.70):
        self.sector_id = sector_id
        self.size = size
        self.state = SectorState.IDLE
        self.energy = 0.5  # 0.0 to 1.0
        self.fatigue = 0.0  # 0.0 to 1.0
        # Enthusiasm varies around the base enthusiasm level for the venue
        self.enthusiasm = random.uniform(base_enthusiasm - 0.15, base_enthusiasm + 0.15)
        self.distractions = 0.0
        self.timer = 0
        self.energy_drain = 0.2  # How much energy is drained when standing
        
    def update(self, dt: float):
        """Update sector state over time"""
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
            self.energy = max(0, self.energy - self.energy_drain)
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
    
    def __init__(self, num_sectors: Optional[int] = None, venue: Optional[StadiumVenue] = None):
        # Support backward compatibility with num_sectors parameter
        if venue is None and num_sectors is not None:
            # Old API: custom sector count, use default venue settings
            self.venue = StadiumVenue.BASEBALL
            self.venue_config = VENUE_CONFIGS[self.venue].copy()
            self.venue_config['num_sectors'] = num_sectors  # Override with custom count
        elif venue is not None:
            # New API: venue-based initialization
            self.venue = venue
            self.venue_config = VENUE_CONFIGS[venue]
        else:
            # Default: Baseball stadium
            self.venue = StadiumVenue.BASEBALL
            self.venue_config = VENUE_CONFIGS[self.venue]
        
        self.num_sectors = self.venue_config['num_sectors']
        
        # Create sectors with venue-specific characteristics
        base_enthusiasm = self.venue_config['base_enthusiasm']
        energy_drain = self.venue_config['energy_drain']
        self.sectors: List[CrowdSector] = []
        for i in range(self.num_sectors):
            sector = CrowdSector(i, size=random.randint(80, 120), base_enthusiasm=base_enthusiasm)
            sector.energy_drain = energy_drain
            self.sectors.append(sector)
        
        self.score = 0
        self.combo = 0
        self.max_combo = 0
        self.wave_active = False
        self.wave_start_sector = -1
        self.current_wave_sector = -1
        self.time_elapsed = 0.0
        self.successful_waves = 0
        self.failed_waves = 0
        self.wave_speed = self.venue_config['wave_speed']
        self.wave_timer = 0.0
        self.events = []
        self.stadium_level = 1
        self.unlocks = []
        
    def start_wave(self, sector_id: int) -> bool:
        """Player initiates wave from specific sector"""
        if self.wave_active:
            return False
            
        sector = self.sectors[sector_id]
        if sector.start_wave():
            self.wave_active = True
            self.wave_start_sector = sector_id
            self.current_wave_sector = sector_id
            self.wave_timer = 0.0
            self.schedule_event('wave_started', sector_id)
            return True
        return False
    
    def update(self, dt: float):
        """Update game state"""
        self.time_elapsed += dt
        
        # Update all sectors
        for sector in self.sectors:
            sector.update(dt)
            
        # Handle wave propagation
        if self.wave_active:
            self.wave_timer += dt
            
            # Check if anticipating sector should stand
            current = self.sectors[self.current_wave_sector]
            if current.state == SectorState.ANTICIPATING:
                # Stand up after brief anticipation
                if self.wave_timer > 0.2:
                    if current.stand_up():
                        self.combo += 1
                        self.score += 10 * self.combo
                        
            # Propagate wave to next sector
            if self.wave_timer >= self.wave_speed:
                next_sector_id = (self.current_wave_sector + 1) % self.num_sectors
                next_sector = self.sectors[next_sector_id]
                
                # Check if wave completed full circle
                if next_sector_id == self.wave_start_sector:
                    self.complete_wave()
                else:
                    # Propagate to next sector
                    if next_sector.start_wave():
                        self.current_wave_sector = next_sector_id
                        self.wave_timer = 0.0
                    else:
                        # Wave failed
                        self.fail_wave()
        
        # Process scheduled events
        self.process_events()
        
    def complete_wave(self):
        """Wave successfully completed full stadium"""
        self.wave_active = False
        self.successful_waves += 1
        bonus = 100 * (1 + self.combo * 0.5)
        self.score += int(bonus)
        self.max_combo = max(self.max_combo, self.combo)
        self.schedule_event('wave_completed', {
            'combo': self.combo,
            'bonus': bonus
        })
        
    def fail_wave(self):
        """Wave failed to propagate"""
        self.wave_active = False
        self.failed_waves += 1
        self.combo = 0
        self.schedule_event('wave_failed', self.current_wave_sector)
        
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
        elif event_type == 'scoreboard':
            # Scoreboard boosts all sectors
            for sector in self.sectors:
                sector.boost_energy(0.2)
                
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
            'venue': self.venue.value,
            'venue_name': self.venue_config['name'],
            'venue_difficulty': self.venue_config['difficulty']
        }
    
    def save_state(self) -> str:
        """Serialize game state to JSON"""
        state = self.get_state()
        state['unlocks'] = self.unlocks
        state['venue'] = self.venue.value
        return json.dumps(state)
    
    def load_state(self, json_str: str):
        """Load game state from JSON"""
        state = json.loads(json_str)
        self.score = state.get('score', 0)
        self.max_combo = state.get('max_combo', 0)
        self.successful_waves = state.get('successful_waves', 0)
        self.stadium_level = state.get('stadium_level', 1)
        self.unlocks = state.get('unlocks', [])
        # Note: venue cannot be changed after initialization


# Global game instance for Pyodide
game = WaveGame()


def init_game(venue: str = 'baseball') -> str:
    """
    Initialize new game with specified venue.
    
    Args:
        venue: Stadium venue type ('baseball', 'soccer', 'cricket')
    
    Returns:
        JSON string with initialization status and game metadata
        
    Note:
        For backward compatibility, integer values (custom sector counts) are still
        supported but deprecated. Use init_game_with_sectors() for custom sector counts.
    """
    global game
    
    # Backward compatibility: Support old API with integer sector counts (deprecated)
    if isinstance(venue, int):
        import warnings
        warnings.warn(
            "Passing integer sector count to init_game() is deprecated. "
            "Use init_game_with_sectors() instead.",
            DeprecationWarning,
            stacklevel=2
        )
        return init_game_with_sectors(venue)
    
    # New API: venue string
    try:
        venue_enum = StadiumVenue(venue.lower())
    except (ValueError, AttributeError):
        venue_enum = StadiumVenue.BASEBALL
    
    game = WaveGame(venue=venue_enum)
    return json.dumps({
        'status': 'initialized',
        'sectors': game.num_sectors,
        'venue': game.venue.value,
        'venue_name': game.venue_config['name'],
        'difficulty': game.venue_config['difficulty']
    })


def init_game_with_sectors(num_sectors: int) -> str:
    """
    Initialize new game with custom sector count (for testing/advanced usage).
    
    Args:
        num_sectors: Number of stadium sectors (e.g., 8, 12, 16)
    
    Returns:
        JSON string with initialization status and game metadata
    """
    global game
    game = WaveGame(num_sectors=num_sectors)
    return json.dumps({
        'status': 'initialized',
        'sectors': game.num_sectors,
        'venue': game.venue.value,
        'venue_name': game.venue_config['name'],
        'difficulty': game.venue_config['difficulty']
    })


def update_game(dt: float) -> str:
    """Update game state - returns JSON state"""
    game.update(dt)
    return json.dumps(game.get_state())


def start_wave_at(sector_id: int) -> str:
    """Start wave from sector"""
    success = game.start_wave(sector_id)
    return json.dumps({'success': success, 'sector': sector_id})


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
