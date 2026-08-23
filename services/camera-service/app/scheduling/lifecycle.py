from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.recognition.config import get_recognition_config
from app.scheduling.generate_sessions import generate_due_sessions
from app.finalization.orchestrator import finalize_session
from scheduler import schedule_capture_jobs


def run_tick(now: datetime | None = None) -> dict:
    """One tick of the full session lifecycle, meant to run on a short
    interval (e.g. every 2-5 min via cron). Ties together three pieces
    that previously had no automatic glue between them:

    1. generate_due_sessions() -- create sessions whose recurrence is due
    2. scheduled -> in_progress -- start capture-job scheduling for
       sessions whose start time has arrived
    3. in_progress -> completed -- finalize sessions past their
       scheduled_end + capture_buffer_minutes

    Every step is individually idempotent (existing functions already
    guarantee this), so a tick can safely overlap or retry.
    """
    now = now or datetime.now(timezone.utc)
    client = get_client()

    generated = generate_due_sessions(now)

    starting = (client.table("class_sessions").select("*")
                .eq("status", "scheduled")
                .lte("scheduled_start", now.isoformat())
                .execute())
    started = []
    for s in starting.data:
        client.table("class_sessions").update({"status": "in_progress"}).eq("id", s["id"]).execute()
        started.append(s["id"])
        if s.get("camera_id"):
            duration_seconds = (
                datetime.fromisoformat(s["scheduled_end"]) - datetime.fromisoformat(s["scheduled_start"])
            ).total_seconds() + 1800  # + buffer on both sides, matches capture_buffer_minutes default
            schedule_capture_jobs(s["institution_id"], s["id"], s["camera_id"], duration_seconds)

    in_progress = client.table("class_sessions").select("*").eq("status", "in_progress").execute()
    finalized = []
    for s in in_progress.data:
        config = get_recognition_config(s["institution_id"])
        buffer_minutes = config["capture_buffer_minutes"]
        cutoff = datetime.fromisoformat(s["scheduled_end"]) + timedelta(minutes=buffer_minutes)
        if now >= cutoff:
            client.table("class_sessions").update({"status": "completed"}).eq("id", s["id"]).execute()
            finalize_session(s["id"])
            finalized.append(s["id"])

    return {"generated": len(generated), "started": started, "finalized": finalized}
