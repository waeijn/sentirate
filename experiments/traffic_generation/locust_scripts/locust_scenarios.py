"""
locust_scenarios.py
====================
Thesis Evaluation — Adaptive API Rate Limiting Middleware
Chapter 4: Synthetic Traffic Simulation

Three traffic scenarios matching Chapter 3 Table 2 classifications:

  Scenario 1 — Normal Traffic
    Target λ: 1–10 req/s per user
    Pattern: natural human rhythm — active bursts with think time gaps
    Expected classification: NORMAL

  Scenario 2 — Bursty Legitimate Traffic
    Target λ: 11–30 req/s per user
    Pattern: batch job spikes — high rate for short windows, then quiet
    Expected classification: BURSTY_LEGITIMATE

  Scenario 3 — Suspicious/Abusive Traffic
    Target λ: > 30 req/s per user
    Pattern: attack waves — intense flood bursts with brief pauses
    Expected classification: SUSPICIOUS_ABUSIVE

IMPORTANT — before every test run, reset middleware state:
  Invoke-RestMethod -Method DELETE -Uri http://localhost:8050/api/clients
"""

import time
import random
import threading

from locust import HttpUser, task, between, constant, events

@events.init_command_line_parser.add_listener
def _(parser):
    parser.add_argument(
        "--traffic-profile",
        type=str,
        default="",
        help="Traffic profile to isolate: normal, bursty, suspicious, or blank for mixed",
        include_in_web_ui=True,
    )

@events.test_start.add_listener
def filter_by_profile(environment, **kwargs):
    profile = environment.parsed_options.traffic_profile.strip().lower()
    profile_map = {
        "normal": NormalUser,
        "bursty": BurstyUser,
        "suspicious": SuspiciousUser,
    }

    if profile in profile_map:
        environment.user_classes = [profile_map[profile]]
        print(f"\n>>> Profile filter active: running ONLY {profile_map[profile].__name__}\n")
    elif profile == "":
        print("\n>>> No profile specified — running MIXED (all three, weighted)\n")
    else:
        print(f"\n>>> WARNING: unknown profile '{profile}' — running MIXED (all three, weighted)\n")


# ── Thread-safe unique IP per user ────────────────────────────────────────────

_ip_lock    = threading.Lock()
_ip_counter = {"normal": 0, "bursty": 0, "suspicious": 0}


def _next_ip(category: str) -> str:
    with _ip_lock:
        idx = _ip_counter[category]
        _ip_counter[category] += 1

    if category == "normal":
        pool_idx = idx % 10000
        return f"10.0.{(pool_idx // 250) + 1}.{(pool_idx % 250) + 1}"
    elif category == "bursty":
        pool_idx = idx % 10000
        return f"10.0.{(pool_idx // 250) + 50}.{(pool_idx % 250) + 1}"
    else:
        pool_idx = idx % 10000
        return f"203.0.{(pool_idx // 250) + 113}.{(pool_idx % 250) + 1}"


# ── Realistic wait time generators ───────────────────────────────────────────

def human_wait(self):
    """
    Human browsing rhythm — normally slow but occasionally quick.
    Creates natural oscillation on the chart:
      80% of the time: 0.3–1.5s gaps (normal human pace)
      20% of the time: 0.1–0.3s gaps (quick tab switching moment)
    """
    if random.random() < 0.8:
        return random.uniform(0.5, 2.0)
    else:
        return random.uniform(0.1, 0.5)


def batch_wait(self):
    """
    Batch job / app sync pattern — creates visible spikes then silence:
      60% of the time: rapid fire 0.04–0.08s (active batch window)
      30% of the time: moderate 0.1–0.3s (winding down)
      10% of the time: long pause 2.0–5.0s (job finished, waiting for next)
    This creates the spike-then-drop pattern seen in the Figma prototype.
    """
    roll = random.random()
    if roll < 0.15:
        return random.uniform(0.01, 0.04)   # fast burst
    elif roll < 0.50:
        return random.uniform(0.1, 0.4)     # moderate
    else:
        return random.uniform(1.0, 4.0)     # long idle — bucket resets


def attack_wait(self):
    """
    Attack wave pattern — intense flood with only rare brief pauses.
    95% rapid fire ensures λ stays above 30 req/s threshold consistently.
    5% micro-pause simulates TCP retry gaps, not full attack cessation.
    """
    roll = random.random()
    if roll < 0.95:
        return random.uniform(0.005, 0.020)  # flood — stays above threshold
    else:
        return random.uniform(0.1, 0.3)     # micro-pause only


# ── Scenario 1: Normal Traffic ────────────────────────────────────────────────

class NormalUser(HttpUser):
    """
    Human browsing pattern — natural rhythm with occasional quick bursts.
    Creates gentle oscillation on the chart, never crosses Normal threshold.
    """
    wait_time = human_wait
    weight    = 3

    def on_start(self):
        self.spoofed_ip = _next_ip("normal")

    @task(9)
    def api_call(self):
        self.client.post(
            f"/api/request/{self.spoofed_ip}",
            headers={"X-Forwarded-For": self.spoofed_ip},
            name="/api/request [normal]",
        )

    @task(1)
    def check_metrics(self):
        self.client.get(
            "/api/metrics",
            headers={"X-Forwarded-For": self.spoofed_ip},
            name="/api/metrics [normal]",
        )

# ── Scenario 2: Bursty Legitimate Traffic ─────────────────────────────────────

class BurstyUser(HttpUser):
    wait_time = batch_wait
    weight    = 2

    def on_start(self):
        self.spoofed_ip = _next_ip("bursty")
        self._burst_phase = random.uniform(0, 30)

    @task
    def api_call(self):

        cycle_position = (time.time() + self._burst_phase) % 35
        if cycle_position < 15:
            # Active burst window
            self.client.post(
                f"/api/request/{self.spoofed_ip}",
                headers={"X-Forwarded-For": self.spoofed_ip},
                name="/api/request [bursty]",
            )
        else:
            # Quiet period — sleep instead of sending
            time.sleep(random.uniform(0.5, 2.0))


# ── Scenario 3: Suspicious / Abusive Traffic ──────────────────────────────────

class SuspiciousUser(HttpUser):
    """
    Attack wave pattern — intense flood bursts with brief pauses between waves.
    Creates the sharp spike-and-drop pattern in the Figma prototype chart.
    HTTP 429 marked as success() — correct blocks are not test failures.
    """
    wait_time = attack_wait
    weight    = 1

    def on_start(self):
        self.spoofed_ip = _next_ip("suspicious")

    @task
    def flood(self):
        with self.client.post(
            f"/api/request/{self.spoofed_ip}",
            headers={"X-Forwarded-For": self.spoofed_ip},
            name="/api/request [suspicious]",
            catch_response=True,
        ) as response:
            if response.status_code == 429:
                response.success()
            elif response.status_code == 200:
                response.failure("Suspicious traffic admitted (FN)")


# ── Event hooks ───────────────────────────────────────────────────────────────

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    with _ip_lock:
        _ip_counter["normal"]     = 0
        _ip_counter["bursty"]     = 0
        _ip_counter["suspicious"] = 0

    print("\n" + "=" * 60)
    print("  Adaptive Rate Limiter — Thesis Evaluation")
    print("  Scenarios: Normal | Bursty | Suspicious")
    print("=" * 60)
    print("  Thresholds (Chapter 3 Table 2):")
    print("    Normal:     λ ≤ 10 req/s")
    print("    Bursty:     11 ≤ λ ≤ 30 req/s")
    print("    Suspicious: λ > 30 req/s")
    print("=" * 60)
    print("  REMINDER: Reset state before each run:")
    print("  Invoke-RestMethod -Method DELETE -Uri http://localhost:8050/api/clients")
    print("=" * 60 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    total = stats.total
    print("\n" + "=" * 60)
    print("  Test Complete")
    print("=" * 60)
    print(f"  Total requests : {total.num_requests}")
    print(f"  Total failures : {total.num_failures}")
    print(f"  Median latency : {total.median_response_time} ms")
    print(f"  95th pct       : {total.get_response_time_percentile(0.95)} ms")
    print(f"  Req/sec        : {total.current_rps:.1f}")
    print("=" * 60 + "\n")