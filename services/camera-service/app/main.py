from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.capture.rtsp_capture import grab_frame
from app.capture.credentials import build_rtsp_url
from app.capture.health import update_camera_health
from app.capture.events import log_capture_event
from app.recognition.pipeline import process_frame
from app.db.client import get_client

app = FastAPI(title="PSYS Camera Service")


@app.get("/health")
def health():
    return {"status": "ok"}


class SessionRequest(BaseModel):
    session_id: str


@app.post("/cameras/{camera_id}/test-capture")
def test_capture(camera_id: str, body: SessionRequest):
    """Capture only — no recognition. Useful for checking connectivity."""
    client = get_client()
    cam = client.table("cameras").select("*").eq("id", camera_id).execute()
    if not cam.data:
        raise HTTPException(status_code=404, detail="camera not found")

    camera = cam.data[0]
    institution_id = camera["institution_id"]

    try:
        rtsp_url = build_rtsp_url(camera["host"], camera["stream_path"], camera["credential_ref"])
    except ValueError:
        raise HTTPException(status_code=500, detail="credential resolution failed")

    frame, error = grab_frame(rtsp_url)
    succeeded = frame is not None

    update_camera_health(camera_id, succeeded=succeeded, error=error)
    log_capture_event(institution_id, body.session_id, camera_id, succeeded, error)

    return {
        "succeeded": succeeded,
        "error": error,
        "frame_shape": list(frame.shape) if frame is not None else None,
    }


@app.post("/cameras/{camera_id}/capture-and-recognize")
def capture_and_recognize(camera_id: str, body: SessionRequest):
    """The real Phase 2+3 loop: grab a frame, then run it through the
    recognition pipeline. This is what a scheduler-driven worker will
    call every 5-8 minutes during a live session (spec Phase D)."""
    client = get_client()
    cam = client.table("cameras").select("*").eq("id", camera_id).execute()
    if not cam.data:
        raise HTTPException(status_code=404, detail="camera not found")

    camera = cam.data[0]
    institution_id = camera["institution_id"]

    try:
        rtsp_url = build_rtsp_url(camera["host"], camera["stream_path"], camera["credential_ref"])
    except ValueError:
        raise HTTPException(status_code=500, detail="credential resolution failed")

    frame, error = grab_frame(rtsp_url)
    succeeded = frame is not None

    # Capture layer bookkeeping happens regardless of what recognition finds
    update_camera_health(camera_id, succeeded=succeeded, error=error)
    log_capture_event(institution_id, body.session_id, camera_id, succeeded, error)

    if not succeeded:
        # Camera outage — never blocks the session, nothing to recognize
        return {"capture_succeeded": False, "error": error, "recognition": None}

    recognition_result = process_frame(frame, institution_id, body.session_id)
    return {"capture_succeeded": True, "error": None, "recognition": recognition_result}
