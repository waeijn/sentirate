import subprocess
import time
import sys
import requests

def reset_state():
    print("[*] Resetting rate limiter state...")
    try:
        requests.delete("http://localhost:8050/api/clients")
    except Exception as e:
        print(f"[-] Failed to reset state: {e}")
        sys.exit(1)

def run_distributed_test(users=5000, spawn_rate=100, duration="30s", workers=4):
    reset_state()
    
    script_path = "experiments/traffic_generation/locust_scripts/locust_scenarios.py"
    
    # Start Master
    master_cmd = [
        "locust", "-f", script_path,
        "--master",
        "--host", "http://localhost:8050",
        "--headless",
        "-u", str(users),
        "-r", str(spawn_rate),
        "-t", duration,
        "--expect-workers", str(workers)
    ]
    
    print(f"[*] Starting Master with {workers} expected workers...")
    master_proc = subprocess.Popen(master_cmd)
    
    # Start Workers
    worker_procs = []
    print(f"[*] Starting {workers} Worker processes...")
    for i in range(workers):
        worker_cmd = ["locust", "-f", script_path, "--worker"]
        p = subprocess.Popen(worker_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        worker_procs.append(p)
        
    try:
        print(f"[*] Test is running ({users} users for {duration}). Waiting for master to complete...")
        master_proc.wait()
    except KeyboardInterrupt:
        print("[*] Interrupted! Shutting down...")
        master_proc.terminate()
    finally:
        print("[*] Cleaning up worker processes...")
        for p in worker_procs:
            p.terminate()
        
        # Give them a moment to exit gracefully
        time.sleep(2)
        for p in worker_procs:
            if p.poll() is None:
                p.kill()
                
        print("[*] Distributed test complete.")

if __name__ == "__main__":
    users = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    duration = sys.argv[2] if len(sys.argv) > 2 else "60s"
    workers = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    
    run_distributed_test(users=users, duration=duration, workers=workers)
