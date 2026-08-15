from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.capture.rtsp_capture import grab_frame
from app.capture.credentials import build_rtsp_url
from app.capture.health import update_camera_health
from app.capture.events import log_capture_event
from app.db.client import get_client

app = FastAPI(title="PSYS Camera Service")


@app.get("/health")
def health():
    return {"status": "ok"}


class TestCaptureRequest(BaseModel):
    session_id: str | None = None


@app.post("/cameras/{camera_id}/test-capture")
def test_capture(camera_id: str, body: TestCaptureRequest):
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

    if body.session_id:
        log_capture_event(
            institution_id=institution_id,
            session_id=body.session_id,
            camera_id=camera_id,
            succeeded=succeeded,
            error=error,
        )

    return {
        "succeeded": succeeded,
        "error": error,
        "frame_shape": list(frame.shape) if frame is not None else None,
    }
