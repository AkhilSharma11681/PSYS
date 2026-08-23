from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.recognition.config import get_recognition_config
from app.scheduling.generate_sessions import generate_due_sessions
from app.finalization.orchestrator import finalize_session
from scheduler import schedule_capture_jobs

PRODUCTION_INTERVAL_MIN_SEC = 5 * 60   # spec default: 5-8 minutes between captures
PRODUCTION_INTERVAL_MAX_SEC = 8 * 60


def run_tick(now: datetime | None = None) -> dict:
    """One tick of the full session lifecycle (cron-style, every 2-5 min).

    1. generate_due_sessions() -- create sessions whose recurrence is due
    2. scheduled -> in_progress -- capture starts capture_buffer_minutes
       BEFORE scheduled_start (spec Phase D: catches a late start), using
       production interval defaults (5-8 min), not the fast test config
    3. in_progress -> completed -- finalize sessions past scheduled_end
       + capture_buffer_minutes
    """
    now = now or datetime.now(timezone.utc)
    client = get_client()

    generated = generate_due_sessions(now)

    scheduled = client.table("class_sessions").select("*").eq("status", "scheduled").execute()
    started = []
    for s in scheduled.data:
        if not s.get("scheduled_start"):
            continue  # data-quality gap -- skip rather than crash the whole tick
        config = get_recognition_config(s["institution_id"])
        buffer_minutes = config["capture_buffer_minutes"]
        capture_start_cutoff = datetime.fromisoformat(s["scheduled_start"]) - timedelta(minutes=buffer_minutes)

        if now < capture_start_cutoff:
            continue

        client.table("class_sessions").update({"status": "in_progress"}).eq("id", s["id"]).execute()
        started.append(s["id"])
        if s.get("camera_id"):
            duration_seconds = (
                datetime.fromisoformat(s["scheduled_end"]) - datetime.fromisoformat(s["scheduled_start"])
            ).total_seconds() + (2 * buffer_minutes * 60)
            schedule_capture_jobs(
                s["institution_id"], s["id"], s["camera_id"], duration_seconds,
                interval_min_sec=PRODUCTION_INTERVAL_MIN_SEC,
                interval_max_sec=PRODUCTION_INTERVAL_MAX_SEC,
            )

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
