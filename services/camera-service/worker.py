import time
from datetime import datetime, timezone
from app.db.client import get_client
from app.workers.capture_worker import run_capture_job

MAX_JOBS_PER_INSTITUTION_PER_POLL = 5


def claim_next_job(client):
    now = datetime.now(timezone.utc).isoformat()

    pending = (
        client.table("capture_jobs")
        .select("id, institution_id")
        .eq("status", "pending")
        .lte("run_at", now)
        .order("run_at")
        .limit(200)
        .execute()
    )
    if not pending.data:
        return []

    capped_ids = []
    counts = {}
    for job in pending.data:
        inst = job["institution_id"]
        counts[inst] = counts.get(inst, 0)
        if counts[inst] < MAX_JOBS_PER_INSTITUTION_PER_POLL:
            capped_ids.append(job["id"])
            counts[inst] += 1

    result = (
        client.table("capture_jobs")
        .update({"status": "processing", "claimed_at": now})
        .eq("status", "pending")
        .in_("id", capped_ids)
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
                client.table("capture_jobs").update({
                    "status": "failed",
                    "error": str(e),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
                print(f"Job {job_id} failed: {e}")

    print("No jobs for a while -- worker stopping.")


if __name__ == "__main__":
    run_worker()
