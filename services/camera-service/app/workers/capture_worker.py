import time
from datetime import datetime, timezone
from app.capture.rtsp_capture import grab_frame
from app.capture.credentials import build_rtsp_url
from app.capture.health import update_camera_health
from app.capture.events import log_capture_event
from app.capture.storage import upload_frame
from app.capture.metrics import record_processing_metric
from app.recognition.pipeline import process_frame
from app.db.client import get_client


class TenantMismatchError(ValueError):
    """Raised when a camera and session belong to different institutions."""


class SessionNotActiveError(ValueError):
    """Raised when trying to capture against a completed/cancelled session."""


def run_capture_job(camera_id: str, session_id: str, run_at: str | None = None):
    """run_at: the capture_jobs row's pre-scheduled timestamp, passed in by
    worker.py when this runs off the queue. Used as captured_at so a
    retried/re-claimed job produces the exact same captured_at both times,
    letting the idempotency constraint on attendance_observations(
    session_id, student_id, captured_at) actually catch duplicates (spec
    Guardrail 6). Falls back to now() only when called without job context
    (e.g. a direct /capture-and-recognize call with no queue involved).

    Same captured_at is threaded through BOTH capture_events.attempted_at
    and attendance_observations.captured_at so both reflect when the frame
    was actually taken, not when each downstream write happened to run."""
    job_start = time.perf_counter()

    client = get_client()
    cam = client.table("cameras").select("*").eq("id", camera_id).execute()
    if not cam.data:
        raise ValueError("camera not found")

    camera = cam.data[0]
    institution_id = camera["institution_id"]

    session = client.table("class_sessions").select("institution_id, status").eq("id", session_id).execute()
    if not session.data:
        raise ValueError("session not found")
    if session.data[0]["institution_id"] != institution_id:
        raise TenantMismatchError("camera and session belong to different institutions")
    if session.data[0]["status"] in ("completed", "cancelled"):
        raise SessionNotActiveError(f"session is {session.data[0]['status']}, cannot capture")

    rtsp_url = build_rtsp_url(camera["host"], camera["stream_path"], camera["credential_ref"])
    frame, error = grab_frame(rtsp_url)
    succeeded = frame is not None

    captured_at = run_at or datetime.now(timezone.utc).isoformat()

    update_camera_health(camera_id, succeeded=succeeded, error=error)

    frame_path = upload_frame(frame, institution_id, session_id, camera_id) if succeeded else None

    log_capture_event(institution_id, session_id, camera_id, succeeded, error, frame_path,
                       attempted_at=captured_at)

    if not succeeded:
        processing_time_ms = (time.perf_counter() - job_start) * 1000
        record_processing_metric(institution_id, session_id, False, processing_time_ms)
        return {"capture_succeeded": False, "error": error, "recognition": None}

    recognition_result = process_frame(frame, institution_id, session_id, frame_path, captured_at)

    processing_time_ms = (time.perf_counter() - job_start) * 1000
    record_processing_metric(institution_id, session_id, True, processing_time_ms)

    return {"capture_succeeded": True, "error": None, "recognition": recognition_result,
            "frame_path": frame_path}
