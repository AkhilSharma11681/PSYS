from app.workers.capture_worker import run_capture_job

CAMERA_ID = "71433159-5fcc-4a72-80e4-296d1703feea"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"
FIXED_RUN_AT = "2026-08-26T12:00:00+00:00"

print("--- First call (simulates original job execution) ---")
result1 = run_capture_job(CAMERA_ID, SESSION_ID, FIXED_RUN_AT)
print(result1)

print("\n--- Second call, SAME run_at (simulates a retry) ---")
try:
    result2 = run_capture_job(CAMERA_ID, SESSION_ID, FIXED_RUN_AT)
    print(result2)
    print("\nBoth calls succeeded without crashing -- checking for duplicate rows...")
except Exception as e:
    print(f"Second call raised: {e}")
