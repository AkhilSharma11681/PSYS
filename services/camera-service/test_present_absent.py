import time
from app.workers.capture_worker import run_capture_job

CAMERA_ID = "fa955acb-1b5b-4330-83c1-e10f3fa11810"
SESSION_ID = "66666666-6666-6666-6666-666666666666"

for i in range(5):
    print(f"\n--- Capture {i+1}/5 ---")
    result = run_capture_job(CAMERA_ID, SESSION_ID)
    print(result.get("recognition"))
    if i < 4:
        print("Waiting 60s for next capture...")
        time.sleep(60)

print("\nDone capturing.")
