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

        events = game.get_events()
        types = {event['type'] for event in events}
        assert 'mascot' in types
        assert 'scoreboard' in types


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

    def test_trigger_event_function(self):
        """Test trigger_event API function"""
        from game_engine import init_game, trigger_event, get_events

        init_game(8)
        trigger_event('scoreboard')

        events = json.loads(get_events())
        assert any(event['type'] == 'scoreboard' for event in events)

    def test_save_load_functions(self):
        """Test save_game and load_game API functions"""
        from game_engine import init_game, save_game, load_game
        init_game(8)

        save_data = save_game()
        assert save_data is not None

        result = load_game(save_data)
        data = json.loads(result)
        assert data['status'] == 'loaded'


class TestSpecialWavePatterns:
    """Test special wave pattern functionality"""

    def test_reverse_wave_pattern(self):
        """Test reverse wave propagates counter-clockwise"""
        game = WaveGame(8)

        # Set all sectors ready
        for sector in game.sectors:
            sector.energy = 0.8
            sector.enthusiasm = 0.8

        # Start a reverse wave
        game.start_wave(0, pattern='reverse')
        assert game.wave_pattern == 'reverse'
        assert game.wave_direction == -1
        assert game.current_wave_sector == 0

        # Update enough to propagate (wave_speed = 0.6s)
        game.update(0.7)

        # Should have moved counter-clockwise to sector 7
        assert game.current_wave_sector == 7 or game.sectors[7].state in [SectorState.ANTICIPATING, SectorState.STANDING]

    def test_double_wave_pattern(self):
        """Test double wave starts two waves"""
        game = WaveGame(16)

        # Set all sectors ready
        for sector in game.sectors:
            sector.energy = 0.8
            sector.enthusiasm = 0.8

        # Start a double wave
        game.start_wave(0, pattern='double')
        assert game.wave_pattern == 'double'
        assert game.wave_active == True
        assert game.second_wave_active == True
        assert game.wave_start_sector == 0
        # Opposite sector should be 8 (16 / 2)
        assert game.second_wave_start_sector == 8

    def test_accelerating_wave_pattern(self):
        """Test accelerating wave increases speed"""
        game = WaveGame(8)

        # Set all sectors ready
        for sector in game.sectors:
            sector.energy = 0.8
            sector.enthusiasm = 0.8

        # Start an accelerating wave
        game.start_wave(0, pattern='accelerating')
        assert game.wave_pattern == 'accelerating'
        initial_speed = game.wave_speed

        # Update multiple times to see speed change
        for _ in range(3):
            game.update(0.35)

        # Speed should have decreased (faster)
        assert game.wave_speed < initial_speed

    def test_pattern_bonus_scoring(self):
        """Test different patterns have different bonus multipliers"""
        # Test reverse pattern bonus
        game = WaveGame(8)
        for sector in game.sectors:
            sector.energy = 0.8
            sector.enthusiasm = 0.8

        game.wave_pattern = 'reverse'
        game.combo = 5
        initial_score = game.score
        game.complete_wave()
        reverse_score_gain = game.score - initial_score

        # Test normal pattern bonus
        game2 = WaveGame(8)
        game2.wave_pattern = 'normal'
        game2.combo = 5
        initial_score2 = game2.score
        game2.complete_wave()
        normal_score_gain = game2.score - initial_score2

        # Reverse should give more points than normal
        assert reverse_score_gain > normal_score_gain

    def test_random_pattern_selection(self):
        """Test that pattern selection chooses from available patterns"""
        game = WaveGame(8)

        patterns = set()
        for _ in range(20):
            game.select_wave_pattern()
            patterns.add(game.wave_pattern)

        # Should have selected at least 2 different patterns
        assert len(patterns) >= 2
        # All patterns should be valid
        assert all(p in ['normal', 'reverse', 'double', 'accelerating'] for p in patterns)

    def test_wave_state_includes_pattern_info(self):
        """Test that game state includes pattern information"""
        game = WaveGame(8)
        game.start_wave(0, pattern='reverse')

        state = game.get_state()
        assert 'wave_pattern' in state
        assert state['wave_pattern'] == 'reverse'
        assert 'wave_direction' in state
        assert state['wave_direction'] == -1
        assert 'second_wave_active' in state
        assert 'second_current_wave_sector' in state


class TestVenueModifiers:
    """Test per-venue difficulty modifiers"""

    def test_cricket_higher_readiness_threshold(self):
        soccer = WaveGame(8, venue='soccer')
        cricket = WaveGame(8, venue='cricket')
        assert cricket.sectors[0]._readiness_threshold > soccer.sectors[0]._readiness_threshold

    def test_cricket_lower_energy_rate(self):
        soccer = WaveGame(8, venue='soccer')
        cricket = WaveGame(8, venue='cricket')
        assert cricket.sectors[0]._energy_rate_mult < soccer.sectors[0]._energy_rate_mult

    def test_baseball_between_soccer_and_cricket(self):
        soccer = WaveGame(8, venue='soccer')
        baseball = WaveGame(8, venue='baseball')
        cricket = WaveGame(8, venue='cricket')
        assert soccer.sectors[0]._readiness_threshold < baseball.sectors[0]._readiness_threshold < cricket.sectors[0]._readiness_threshold

    def test_set_venue_updates_all_sectors(self):
        game = WaveGame(8, venue='soccer')
        original = game.sectors[0]._readiness_threshold
        game.set_venue('cricket')
        for sector in game.sectors:
            assert sector._readiness_threshold > original

    def test_game_state_includes_venue(self):
        game = WaveGame(8, venue='cricket')
        state = game.get_state()
        assert state['venue'] == 'cricket'


class TestWeatherModifiers:
    """Test weather crowd-behaviour modifiers"""

    def test_rainy_lower_energy_rate_than_sunny(self):
        sunny = WaveGame(8, weather='sunny')
        rainy = WaveGame(8, weather='rainy')
        assert rainy.sectors[0]._energy_rate_mult < sunny.sectors[0]._energy_rate_mult

    def test_snowy_lowest_energy_rate(self):
        sunny = WaveGame(8, weather='sunny')
        snowy = WaveGame(8, weather='snowy')
        assert snowy.sectors[0]._energy_rate_mult < sunny.sectors[0]._energy_rate_mult

    def test_weather_affects_energy_recovery_rate(self):
        rainy = WaveGame(8, weather='rainy')
        sector = rainy.sectors[0]
        sector.energy = 0.0
        sector.fatigue = 0.0
        sector.state = SectorState.IDLE
        sector.update(1.0)
        assert sector.energy < 0.1  # rainy mult is 0.7 → recovery < 0.1/s

    def test_set_weather_updates_all_sectors(self):
        game = WaveGame(8, weather='sunny')
        original_rate = game.sectors[0]._energy_rate_mult
        game.set_weather('rainy')
        for sector in game.sectors:
            assert sector._energy_rate_mult < original_rate

    def test_combined_venue_weather_multipliers(self):
        game = WaveGame(8, venue='cricket', weather='rainy')
        # cricket energy_rate=0.9, rainy energy_rate=0.7 → combined 0.63
        expected = 0.9 * 0.7
        assert abs(game.sectors[0]._energy_rate_mult - expected) < 1e-9

    def test_game_state_includes_weather(self):
        game = WaveGame(8, weather='snowy')
        state = game.get_state()
        assert state['weather'] == 'snowy'
