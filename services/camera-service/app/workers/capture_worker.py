from app.capture.rtsp_capture import grab_frame
from app.capture.credentials import build_rtsp_url
from app.capture.health import update_camera_health
from app.capture.events import log_capture_event
from app.recognition.pipeline import process_frame
from app.db.client import get_client


def run_capture_job(camera_id: str, session_id: str):
    """The core Phase 2+3 loop, shared by the API endpoint and the
    background worker so the logic only lives in one place."""
    client = get_client()
    cam = client.table("cameras").select("*").eq("id", camera_id).execute()
    if not cam.data:
        raise ValueError("camera not found")

    camera = cam.data[0]
    institution_id = camera["institution_id"]

    rtsp_url = build_rtsp_url(camera["host"], camera["stream_path"], camera["credential_ref"])
    frame, error = grab_frame(rtsp_url)
    succeeded = frame is not None

    update_camera_health(camera_id, succeeded=succeeded, error=error)
    log_capture_event(institution_id, session_id, camera_id, succeeded, error)

    if not succeeded:
        return {"capture_succeeded": False, "error": error, "recognition": None}

    recognition_result = process_frame(frame, institution_id, session_id)
    return {"capture_succeeded": True, "error": None, "recognition": recognition_result}
