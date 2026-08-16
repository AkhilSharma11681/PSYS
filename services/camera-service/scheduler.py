import random
import sys
from datetime import datetime, timedelta, timezone
from app.db.client import get_client


def schedule_capture_jobs(institution_id, session_id, camera_id,
                           duration_seconds, interval_min_sec=20, interval_max_sec=30):
    """Generate randomized capture job times upfront for the session window.
    Production default (per spec): 5-8 MINUTES between captures.
    Here we use seconds so you can test end-to-end in under a minute."""
    client = get_client()
    now = datetime.now(timezone.utc)
    end = now + timedelta(seconds=duration_seconds)

    jobs = []
    t = now
    while t < end:
        t = t + timedelta(seconds=random.randint(interval_min_sec, interval_max_sec))
        if t >= end:
            break
        jobs.append({
            "institution_id": institution_id,
            "session_id": session_id,
            "camera_id": camera_id,
            "run_at": t.isoformat(),
            "status": "pending",
        })

    if jobs:
        client.table("capture_jobs").insert(jobs).execute()

    print(f"Scheduled {len(jobs)} capture job(s) between {now} and {end}")


if __name__ == "__main__":
    institution_id = sys.argv[1]
    session_id = sys.argv[2]
    camera_id = sys.argv[3]
    duration_seconds = int(sys.argv[4]) if len(sys.argv) > 4 else 60

    schedule_capture_jobs(institution_id, session_id, camera_id, duration_seconds)
