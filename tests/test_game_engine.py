"""
Unit tests for the Stadium Wave Game engine
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from game_engine import CrowdSector, WaveGame, SectorState
import json


class TestCrowdSector:
    """Test CrowdSector functionality"""
    
    def test_sector_initialization(self):
        """Test that sectors initialize correctly"""
        sector = CrowdSector(0)
        assert sector.sector_id == 0
        assert sector.state == SectorState.IDLE
        assert 0 <= sector.energy <= 1.0
        assert 0 <= sector.enthusiasm <= 1.0
        
    def test_sector_can_wave(self):
        """Test wave readiness check"""
        sector = CrowdSector(0)
        sector.energy = 0.8
        sector.enthusiasm = 0.8
        sector.fatigue = 0.0
        assert sector.can_wave()
        
        # Test with high fatigue
        sector.fatigue = 0.9
        assert not sector.can_wave()
        
    def test_sector_state_transitions(self):
        """Test sector state machine"""
        sector = CrowdSector(0)
        sector.energy = 0.8
        sector.enthusiasm = 0.8
        
        # Start wave
        assert sector.start_wave()
        assert sector.state == SectorState.ANTICIPATING
        
        # Stand up
        assert sector.stand_up()
        assert sector.state == SectorState.STANDING
        
        # Sit down
        sector.sit_down()
        assert sector.state == SectorState.SEATED
        
    def test_sector_energy_boost(self):
        """Test energy boosting"""
        sector = CrowdSector(0)
        initial_energy = sector.energy
        sector.boost_energy(0.3)
        assert sector.energy > initial_energy
        assert sector.energy <= 1.0
        
    def test_sector_update(self):
        """Test sector update over time"""
        sector = CrowdSector(0)
        sector.state = SectorState.STANDING
        sector.timer = 0
        
        # Update for 2 seconds (should sit down)
        sector.update(2.0)
        assert sector.state == SectorState.SEATED
        
    def test_sector_serialization(self):
        """Test sector to_dict"""
        sector = CrowdSector(5)
        data = sector.to_dict()
        assert data['id'] == 5
        assert 'state' in data
        assert 'energy' in data


class TestWaveGame:
    """Test WaveGame functionality"""
    
    def test_game_initialization(self):
        """Test game initializes correctly"""
        game = WaveGame(16)
        assert len(game.sectors) == 16
        assert game.score == 0
        assert game.combo == 0
        assert not game.wave_active
        
    def test_start_wave(self):
        """Test starting a wave"""
        game = WaveGame(8)
        # Ensure sector is ready
        game.sectors[0].energy = 0.8
        game.sectors[0].enthusiasm = 0.8
        
        success = game.start_wave(0)
        assert success
        assert game.wave_active
        assert game.wave_start_sector == 0
        
    def test_wave_propagation(self):
        """Test wave propagates to next sector"""
        game = WaveGame(8)
        
        # Set all sectors ready
        for sector in game.sectors:
            sector.energy = 0.8
            sector.enthusiasm = 0.8
            
        game.start_wave(0)
        assert game.current_wave_sector == 0
        
        # Update enough to propagate
        game.update(0.5)
        
        # Should have progressed
        assert game.sectors[0].state in [SectorState.STANDING, SectorState.SEATED]
        
    def test_boost_sector(self):
        """Test boosting sector energy"""
        game = WaveGame(8)
        initial_energy = game.sectors[3].energy
        game.boost_sector(3)
        assert game.sectors[3].energy > initial_energy
        
    def test_score_tracking(self):
        """Test score increases with combos"""
        game = WaveGame(8)
        initial_score = game.score
        game.combo = 5
        
        # Manually trigger scoring
        game.sectors[0].stand_up()
        game.combo += 1
        game.score += 10 * game.combo
        
        assert game.score > initial_score
        
    def test_game_state_serialization(self):
        """Test get_state returns valid JSON structure"""
        game = WaveGame(8)
        state = game.get_state()
        
        assert 'sectors' in state
        assert 'score' in state
        assert 'combo' in state
        assert len(state['sectors']) == 8
        
    def test_save_and_load(self):
        """Test save/load functionality"""
        game = WaveGame(8)
        game.score = 1000
        game.max_combo = 15
        
        save_data = game.save_state()
        assert save_data is not None
        
        # Create new game and load
        new_game = WaveGame(8)
        new_game.load_state(save_data)
        assert new_game.score == 1000
        assert new_game.max_combo == 15
        
    def test_event_system(self):
        """Test event scheduling and retrieval"""
        game = WaveGame(8)
        game.schedule_event('test_event', {'data': 'test'})
        
        events = game.get_events()
        assert len(events) == 1
        assert events[0]['type'] == 'test_event'
        
        # Events should be cleared
        events2 = game.get_events()
        assert len(events2) == 0
        
    def test_external_events(self):
        """Test external event effects"""
        game = WaveGame(8)
        
        # Test mascot distraction
        game.trigger_event('mascot', 3)
        assert game.sectors[3].distractions > 0
        
        # Test scoreboard boost
        initial_energy = [s.energy for s in game.sectors]
        game.trigger_event('scoreboard')
        for i, sector in enumerate(game.sectors):
            assert sector.energy >= initial_energy[i]


class TestGameAPI:
    """Test Python API functions exposed to JavaScript"""
    
    def test_init_game_function(self):
        """Test init_game API function"""
        from game_engine import init_game
        result = init_game(12)
        data = json.loads(result)
        assert data['status'] == 'initialized'
        assert data['sectors'] == 12
        
    def test_update_game_function(self):
        """Test update_game API function"""
        from game_engine import init_game, update_game
        init_game(8)
        result = update_game(0.016)
        state = json.loads(result)
        assert 'sectors' in state
        assert 'score' in state
        
    def test_start_wave_at_function(self):
        """Test start_wave_at API function"""
        from game_engine import init_game, start_wave_at
        init_game(8)
        result = start_wave_at(0)
        data = json.loads(result)
        assert 'success' in data
        assert data['sector'] == 0
        
    def test_get_game_state_function(self):
        """Test get_game_state API function"""
        from game_engine import init_game, get_game_state
        init_game(8)
        result = get_game_state()
        state = json.loads(result)
        assert 'sectors' in state
        
    def test_save_load_functions(self):
        """Test save_game and load_game API functions"""
        from game_engine import init_game, save_game, load_game
        init_game(8)
        
        save_data = save_game()
        assert save_data is not None
        
        result = load_game(save_data)
        data = json.loads(result)
        assert data['status'] == 'loaded'


class TestVenueSystem:
    """Test venue-based gameplay"""
    
    def test_venue_initialization(self):
        """Test different venues initialize correctly"""
        from game_engine import StadiumVenue, WaveGame
        
        # Baseball (easy)
        baseball = WaveGame(venue=StadiumVenue.BASEBALL)
        assert baseball.num_sectors == 16
        assert baseball.wave_speed == 0.35
        assert baseball.venue == StadiumVenue.BASEBALL
        
        # Soccer (medium)
        soccer = WaveGame(venue=StadiumVenue.SOCCER)
        assert soccer.num_sectors == 20
        assert soccer.wave_speed == 0.3
        assert soccer.venue == StadiumVenue.SOCCER
        
        # Cricket (hard)
        cricket = WaveGame(venue=StadiumVenue.CRICKET)
        assert cricket.num_sectors == 24
        assert cricket.wave_speed == 0.25
        assert cricket.venue == StadiumVenue.CRICKET
        
    def test_venue_difficulty_affects_gameplay(self):
        """Test that different venues have different difficulty characteristics"""
        from game_engine import StadiumVenue, WaveGame
        
        baseball = WaveGame(venue=StadiumVenue.BASEBALL)
        cricket = WaveGame(venue=StadiumVenue.CRICKET)
        
        # Cricket should be harder (more sectors, faster wave, higher energy drain)
        assert cricket.num_sectors > baseball.num_sectors
        assert cricket.wave_speed < baseball.wave_speed  # Faster = smaller number
        assert cricket.sectors[0].energy_drain > baseball.sectors[0].energy_drain
        
    def test_venue_api_init(self):
        """Test init_game API function with venues"""
        from game_engine import init_game
        
        # Test baseball venue
        result = init_game('baseball')
        data = json.loads(result)
        assert data['status'] == 'initialized'
        assert data['venue'] == 'baseball'
        assert data['sectors'] == 16
        
        # Test soccer venue
        result = init_game('soccer')
        data = json.loads(result)
        assert data['venue'] == 'soccer'
        assert data['sectors'] == 20
        
        # Test cricket venue
        result = init_game('cricket')
        data = json.loads(result)
        assert data['venue'] == 'cricket'
        assert data['sectors'] == 24
        
    def test_venue_state_includes_info(self):
        """Test that game state includes venue information"""
        from game_engine import StadiumVenue, WaveGame
        
        game = WaveGame(venue=StadiumVenue.SOCCER)
        state = game.get_state()
        
        assert 'venue' in state
        assert 'venue_name' in state
        assert 'venue_difficulty' in state
        assert state['venue'] == 'soccer'
        assert state['venue_name'] == 'Soccer Stadium'
        assert state['venue_difficulty'] == 'Medium'
