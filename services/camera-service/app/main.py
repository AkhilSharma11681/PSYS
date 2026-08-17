import io
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from PIL import Image
import numpy as np

from app.workers.capture_worker import run_capture_job, TenantMismatchError
from app.recognition.provider import DlibFaceRecognitionProvider

app = FastAPI(title="PSYS Camera Service")

embed_provider = DlibFaceRecognitionProvider()


@app.get("/health")
def health():
    return {"status": "ok"}


class SessionRequest(BaseModel):
    session_id: str


@app.post("/cameras/{camera_id}/capture-and-recognize")
def capture_and_recognize(camera_id: str, body: SessionRequest):
    try:
        result = run_capture_job(camera_id, body.session_id)
    except TenantMismatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@app.post("/internal/embed")
async def internal_embed(file: UploadFile = File(...)):
    """Thin wrapper around detect() -> quality() -> embed() for the
    enrollment-feature to call, instead of duplicating provider.py.
    No new recognition logic here -- same code path camera-feature uses."""
    contents = await file.read()

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_image")

    frame = np.array(img)
    faces = embed_provider.detect(frame)

    if len(faces) == 0:
        raise HTTPException(status_code=422, detail="no_face_detected")
    if len(faces) > 1:
        raise HTTPException(status_code=422, detail="multiple_faces_detected")

    face = faces[0]
    quality = embed_provider.quality(frame, face)
    embedding = embed_provider.embed(frame, face)

    return {
        "faces_detected": 1,
        "quality_score": quality,
        "embedding": embedding,
        "embedding_model": "dlib_resnet_v1",
    }
