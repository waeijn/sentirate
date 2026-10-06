import time
import pytest
from dashboard.backend.algorithms.heuristic_engine import (
    TrafficMonitor,
    HeuristicEngine,
    TrafficType,
)

def test_heuristic_normal_traffic(monkeypatch):
    """Test that evenly spaced slow requests classify as NORMAL."""
    monitor = TrafficMonitor(ip_address="192.168.1.1")
    engine = HeuristicEngine()
    
    current_time = [1000.0]
    monkeypatch.setattr(time, "time", lambda: current_time[0])
    
    for _ in range(5):
        monitor.update_history(current_time[0])
        current_time[0] += 1.0
        
    # Set time to exactly when the last request happened for the calculation
    current_time[0] -= 1.0
    assert engine.classify(monitor) == TrafficType.NORMAL

def test_heuristic_suspicious_traffic(monkeypatch):
    """Test that rapid, robotic requests classify as SUSPICIOUS_ABUSIVE."""
    monitor = TrafficMonitor(ip_address="10.0.0.99")
    engine = HeuristicEngine()
    
    current_time = [1000.0]
    monkeypatch.setattr(time, "time", lambda: current_time[0])
    
    for _ in range(50):
        monitor.update_history(current_time[0])
        current_time[0] += 0.01  # 10ms intervals
        
    current_time[0] -= 0.01
    classification = engine.classify(monitor)
    assert classification == TrafficType.SUSPICIOUS_ABUSIVE
    assert monitor.get_request_rate() > 30.0
    assert monitor.get_interval_regularity() < 0.1

def test_heuristic_bursty_traffic(monkeypatch):
    """Test that rapid but highly irregular bursts classify as BURSTY_LEGITIMATE."""
    monitor = TrafficMonitor(ip_address="172.16.0.5")
    engine = HeuristicEngine()
    
    current_time = [1000.0]
    monkeypatch.setattr(time, "time", lambda: current_time[0])
    
    intervals = [0.05, 0.02, 0.01, 0.15, 0.03, 0.06, 0.02, 0.19, 0.1, 0.07, 0.04, 0.08, 0.02, 0.04]
    
    monitor.update_history(current_time[0])
    for interval in intervals:
        current_time[0] += interval
        monitor.update_history(current_time[0])
        
    classification = engine.classify(monitor)
    assert classification == TrafficType.BURSTY_LEGITIMATE

def test_insufficient_history(monkeypatch):
    """Test that a new client with no history defaults to NORMAL."""
    monitor = TrafficMonitor(ip_address="1.1.1.1")
    engine = HeuristicEngine()
    
    current_time = [1000.0]
    monkeypatch.setattr(time, "time", lambda: current_time[0])
    
    monitor.update_history(current_time[0])
    
    assert engine.classify(monitor) == TrafficType.NORMAL
