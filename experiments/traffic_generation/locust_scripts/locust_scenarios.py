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


# ── Custom Locust Web UI Enhancements ────────────────────────────────────────
# Injects JavaScript that transforms the default text inputs into user-friendly
# dropdowns for Traffic Profile and Number of Users.

CUSTOM_UI_JS = """
(function() {
    // ── Utility: Set value on React-controlled input ────────────────────────
    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    ).set;

    function setReactValue(el, val) {
        nativeSetter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ── Shared dropdown styling ─────────────────────────────────────────────
    const selectCSS = `
        width: 100%;
        padding: 12.5px 14px;
        background: transparent;
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.23);
        border-radius: 4px;
        font-size: 1rem;
        font-family: "Roboto", "Helvetica", "Arial", sans-serif;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='rgba(255,255,255,0.7)' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        outline: none;
    `;

    const labelCSS = `
        color: rgba(255, 255, 255, 0.7);
        font-size: 1rem;
        font-family: "Roboto", "Helvetica", "Arial", sans-serif;
        margin-bottom: 8px;
        display: block;
    `;

    // ── Build dropdown helper ───────────────────────────────────────────────
    function createDropdown(options, onChange) {
        const select = document.createElement('select');
        select.style.cssText = selectCSS;
        // Hover and focus effects
        select.onmouseover = () => select.style.border = '1px solid #fff';
        select.onmouseout = () => select.style.border = '1px solid rgba(255, 255, 255, 0.23)';
        select.onfocus = () => select.style.border = '2px solid #90caf9';
        select.onblur = () => select.style.border = '1px solid rgba(255, 255, 255, 0.23)';

        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            o.style.background = '#1d2228'; // Dark bg for the dropdown options list
            select.appendChild(o);
        });
        select.addEventListener('change', onChange);
        return select;
    }

    function hideMuiRoot(input) {
        // Find the top-level MUI component wrapper
        let root = input.closest('.MuiFormControl-root');
        if (!root) root = input.parentElement.parentElement;
        if (root) {
            root.style.position = 'absolute';
            root.style.opacity = '0';
            root.style.pointerEvents = 'none';
            root.style.zIndex = '-1';
            root.style.height = '0';
            root.style.overflow = 'hidden';
            root.style.margin = '0';
        }
        return root;
    }

    // ── 1. Transform "Number of users" input ────────────────────────────────
    function enhanceUserCount() {
        const input = document.querySelector('input[name="userCount"], input[name="user_count"]');
        if (!input || input.dataset.enhanced) return false;
        input.dataset.enhanced = 'true';

        const muiRoot = hideMuiRoot(input);
        
        const container = document.createElement('div');
        container.style.cssText = 'margin-top: 16px; margin-bottom: 8px; width: 100%;';

        const label = document.createElement('label');
        label.textContent = 'Number of users (peak concurrency) *';
        label.style.cssText = labelCSS;

        const customInput = document.createElement('input');
        customInput.type = 'number';
        customInput.min = '1';
        customInput.placeholder = 'Enter number of users...';
        customInput.style.cssText = selectCSS; // Match the select box style
        customInput.style.display = 'none';
        customInput.style.marginTop = '8px';
        customInput.addEventListener('input', function() {
            if (this.value) setReactValue(input, this.value);
        });

        const select = createDropdown([
            { value: '100',   label: '100 users' },
            { value: '250',   label: '250 users' },
            { value: '500',   label: '500 users' },
            { value: '1000',  label: '1,000 users' },
            { value: '5000',  label: '5,000 users' },
            { value: '10000', label: '10,000 users' },
            { value: 'custom', label: 'Custom...' },
        ], function() {
            if (this.value === 'custom') {
                customInput.style.display = 'block';
                customInput.focus();
            } else {
                customInput.style.display = 'none';
                setReactValue(input, this.value);
            }
        });

        container.appendChild(label);
        container.appendChild(select);
        container.appendChild(customInput);
        
        muiRoot.parentNode.insertBefore(container, muiRoot);

        // Set default to 100
        select.value = '100';
        setReactValue(input, '100');
        return true;
    }

    // ── 2. Transform "Traffic Profile" custom param ─────────────────────────
    function enhanceTrafficProfile() {
        const input = document.querySelector('input[name="traffic-profile"], input[name="trafficProfile"]');
        if (!input || input.dataset.enhanced) return false;
        input.dataset.enhanced = 'true';

        const muiRoot = hideMuiRoot(input);

        const container = document.createElement('div');
        container.style.cssText = 'margin-top: 16px; margin-bottom: 8px; width: 100%;';

        const label = document.createElement('label');
        label.textContent = 'Traffic Profile';
        label.style.cssText = labelCSS;

        const select = createDropdown([
            { value: '',           label: 'Mixed (All three, weighted)' },
            { value: 'normal',     label: 'Normal Traffic' },
            { value: 'bursty',     label: 'Bursty Legitimate' },
            { value: 'suspicious', label: 'Suspicious / Abusive' },
            { value: 'baseline',   label: 'Baseline (Raw Throughput)' },
        ], function() {
            setReactValue(input, this.value);
        });

        container.appendChild(label);
        container.appendChild(select);
        
        muiRoot.parentNode.insertBefore(container, muiRoot);

        // Default to mixed
        select.value = '';
        setReactValue(input, '');
        return true;
    }

    // ── 3. Also expand "Custom parameters" section automatically ────────────
    function expandCustomParams() {
        const toggles = document.querySelectorAll('.MuiAccordionSummary-root, [class*="Accordion"] button, [role="button"]');
        toggles.forEach(el => {
            if (el.textContent && el.textContent.includes('Custom parameters')) {
                const accordion = el.closest('[class*="Accordion"]') || el.parentElement;
                if (accordion && !accordion.classList.contains('Mui-expanded') && !accordion.dataset.autoExpanded) {
                    accordion.dataset.autoExpanded = 'true';
                    el.click();
                }
            }
        });
    }

    // ── 4. Run enhancement with persistent MutationObserver ─────────────────
    function tryEnhance() {
        enhanceUserCount();
        enhanceTrafficProfile();
        expandCustomParams();
    }

    // Try immediately, then continuously observe DOM for React modal renders
    tryEnhance();
    const observer = new MutationObserver(() => {
        tryEnhance();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
"""

@events.init.add_listener
def on_locust_init(environment, **kw):
    """Inject custom dropdown UI into Locust's web interface."""
    if environment.web_ui:
        from flask import make_response

        @environment.web_ui.app.after_request
        def inject_custom_ui(response):
            if response.content_type and 'text/html' in response.content_type:
                script_tag = f'<script>{CUSTOM_UI_JS}</script>'
                data = response.get_data(as_text=True)
                data = data.replace('</body>', f'{script_tag}</body>')
                response.set_data(data)
                # Remove Content-Length since we modified the body
                response.headers.pop('Content-Length', None)
            return response

@events.test_start.add_listener
def filter_by_profile(environment, **kwargs):
    profile = environment.parsed_options.traffic_profile.strip().lower()
    if profile == "normal":
        environment.user_classes = [NormalUser]
        print("\n>>> Profile filter active: running ONLY NormalUser\n")
    elif profile == "bursty":
        environment.user_classes = [BurstyUser]
        print("\n>>> Profile filter active: running ONLY BurstyUser\n")
    elif profile == "suspicious":
        environment.user_classes = [SuspiciousUser]
        print("\n>>> Profile filter active: running ONLY SuspiciousUser\n")
    elif profile == "baseline":
        environment.user_classes = [BaselineUser]
        print("\n>>> Profile filter active: running BASELINE\n")
    elif profile == "":
        environment.user_classes = [NormalUser, BurstyUser, SuspiciousUser]
        print("\n>>> No profile specified - running MIXED (all three, weighted)\n")
    else:
        environment.user_classes = [NormalUser, BurstyUser, SuspiciousUser]
        print(f"\n>>> WARNING: unknown profile '{profile}' - running MIXED (all three, weighted)\n")


# ── Thread-safe unique IP per user (Distributed-Safe) ───────────────

_ip_lock    = threading.Lock()
# Start with a random offset so multiple Locust worker processes don't 
# generate identical IP addresses and collide.
_worker_offset = random.randint(0, 1000000)
_ip_counter = {
    "normal": _worker_offset, 
    "bursty": _worker_offset, 
    "suspicious": _worker_offset
}


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
    Batch job / app sync pattern:
    Fires continuously and rapidly during its 15-second active burst window 
    to build mathematically pure "burst persistence".
    """
    cycle_position = (time.time() + getattr(self, "_burst_phase", 0)) % 35
    if cycle_position < 15:
        # Active burst window — fire continuously at ~12–20 req/s
        # This guarantees interval < 0.1s, linking the burst chain for high persistence
        return random.uniform(0.05, 0.08)
    else:
        # Quiet period — long idle
        return random.uniform(1.0, 4.0)


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
        with self.client.post(
            f"/api/request/{self.spoofed_ip}",
            headers={"X-Forwarded-For": self.spoofed_ip},
            name="/api/request [normal]",
            catch_response=True,
        ) as response:
            if response.status_code == 429:
                response.success()
            elif response.status_code >= 500:
                response.failure(f"Server Error: {response.status_code}")

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
        with self.client.post(
            f"/api/request/{self.spoofed_ip}",
            headers={"X-Forwarded-For": self.spoofed_ip},
            name="/api/request [bursty]",
            catch_response=True,
        ) as response:
            if response.status_code == 429:
                response.success()
            elif response.status_code >= 500:
                response.failure(f"Server Error: {response.status_code}")


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

# ── Scenario 4: Raw Baseline Throughput ──────────────────────────────────

class BaselineUser(HttpUser):
    """
    Hits the raw_request endpoint completely bypassing the rate limiter.
    Uses human_wait so that 100 users generate ~100 RPS, allowing direct
    A/B comparison against the middleware at the exact same load levels.
    """
    wait_time = human_wait
    weight    = 1

    def on_start(self):
        self.spoofed_ip = _next_ip("normal")

    @task
    def api_call(self):
        with self.client.post(
            f"/api/raw_request/{self.spoofed_ip}",
            headers={"X-Forwarded-For": self.spoofed_ip},
            name="/api/raw_request [baseline]",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Server Error: {response.status_code}")

# ── Event hooks ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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
    print("    Normal:     rate <= 10 req/s")
    print("    Bursty:     11 <= rate <= 30 req/s")
    print("    Suspicious: rate > 30 req/s")
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