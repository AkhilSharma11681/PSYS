from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.capture.rtsp_capture import grab_frame
from app.capture.health import update_camera_health
from app.capture.events import log_capture_event
from app.db.client import get_client

app = FastAPI(title="PSYS Camera Service")


@app.get("/health")
def health():
    return {"status": "ok"}


class TestCaptureRequest(BaseModel):
    rtsp_url: str
    session_id: str | None = None


@app.post("/cameras/{camera_id}/test-capture")
def test_capture(camera_id: str, body: TestCaptureRequest):
    client = get_client()
    cam = client.table("cameras").select("*").eq("id", camera_id).execute()
    if not cam.data:
        raise HTTPException(status_code=404, detail="camera not found")

    institution_id = cam.data[0]["institution_id"]

    frame, error = grab_frame(body.rtsp_url)
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
