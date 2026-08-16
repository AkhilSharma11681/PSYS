import time
from datetime import datetime, timezone
from app.db.client import get_client
from app.workers.capture_worker import run_capture_job


def claim_next_job(client):
    """Atomic claim: update pending->processing and return the row.
    If two workers race, only one gets a non-empty result — this is
    the idempotency pattern your spec uses for finalization too."""
    now = datetime.now(timezone.utc).isoformat()
    result = (
        client.table("capture_jobs")
        .update({"status": "processing", "claimed_at": now})
        .eq("status", "pending")
        .lte("run_at", now)
        .execute()
    )
    return result.data


def run_worker(poll_interval_sec=2, max_idle_polls=15):
    client = get_client()
    idle_polls = 0

    print("Worker started, polling for jobs...")
    while idle_polls < max_idle_polls:
        jobs = claim_next_job(client)

        if not jobs:
            idle_polls += 1
            time.sleep(poll_interval_sec)
            continue

        idle_polls = 0
        for job in jobs:
            job_id = job["id"]
            try:
                result = run_capture_job(job["camera_id"], job["session_id"])
                client.table("capture_jobs").update({
                    "status": "done",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
                print(f"Job {job_id}: {result}")
            except Exception as e:
                # A job failure must never crash the worker (spec Section 7)
                client.table("capture_jobs").update({
                    "status": "failed",
                    "error": str(e),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
                print(f"Job {job_id} failed: {e}")

    print("No jobs for a while — worker stopping.")


if __name__ == "__main__":
    run_worker()
