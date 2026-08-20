from app.capture.rtsp_capture import grab_frame
from app.capture.credentials import build_rtsp_url
from app.capture.health import update_camera_health
from app.capture.events import log_capture_event
from app.capture.storage import upload_frame
from app.recognition.pipeline import process_frame
from app.db.client import get_client


class TenantMismatchError(ValueError):
    """Raised when a camera and session belong to different institutions."""


class SessionNotActiveError(ValueError):
    """Raised when trying to capture against a completed/cancelled session."""


def run_capture_job(camera_id: str, session_id: str):
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

    update_camera_health(camera_id, succeeded=succeeded, error=error)

    frame_path = upload_frame(frame, institution_id, session_id, camera_id) if succeeded else None

    log_capture_event(institution_id, session_id, camera_id, succeeded, error, frame_path)

    if not succeeded:
        return {"capture_succeeded": False, "error": error, "recognition": None}

    recognition_result = process_frame(frame, institution_id, session_id, frame_path)
    return {"capture_succeeded": True, "error": None, "recognition": recognition_result,
            "frame_path": frame_path}
