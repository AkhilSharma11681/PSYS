import io
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image
import numpy as np
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.workers.capture_worker import run_capture_job
from app.recognition.provider import DlibFaceRecognitionProvider
from app.finalization.orchestrator import finalize_session
from app.finalization.review import get_review_queue
from app.finalization.disputes import create_dispute, resolve_dispute
from app.reporting.export import export_session_csv

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="PSYS Camera Service")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

embed_provider = DlibFaceRecognitionProvider()


@app.get("/health")
def health():
    return {"status": "ok"}


class SessionRequest(BaseModel):
    session_id: str


@app.post("/cameras/{camera_id}/capture-and-recognize")
@limiter.limit("30/minute")
def capture_and_recognize(request: Request, camera_id: str, body: SessionRequest):
    try:
        result = run_capture_job(camera_id, body.session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@app.post("/internal/embed")
@limiter.limit("20/minute")
async def internal_embed(request: Request, file: UploadFile = File(...)):
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

    return {"faces_detected": 1, "quality_score": quality,
            "embedding": embedding, "embedding_model": "dlib_resnet_v1"}


@app.post("/sessions/{session_id}/finalize")
@limiter.limit("10/minute")
def finalize(request: Request, session_id: str):
    try:
        result = finalize_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@app.get("/sessions/{session_id}/review")
@limiter.limit("60/minute")
def review(request: Request, session_id: str):
    return {"session_id": session_id, "flagged": get_review_queue(session_id)}


@app.get("/sessions/{session_id}/export.csv")
@limiter.limit("30/minute")
def export_csv(request: Request, session_id: str):
    csv_content = export_session_csv(session_id)
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=session_{session_id}.csv"},
    )


class DisputeRequest(BaseModel):
    institution_id: str
    final_attendance_id: str
    session_id: str
    student_id: str
    reason: str | None = None


@app.post("/disputes")
@limiter.limit("10/minute")
def submit_dispute(request: Request, body: DisputeRequest):
    """Camera-service's Phase 7 scope: auto-attaches evidence, the
    submission UI/workflow itself is teammate's territory."""
    result = create_dispute(body.institution_id, body.final_attendance_id,
                             body.session_id, body.student_id, body.reason)
    return result

class ResolveDisputeRequest(BaseModel):
    status: str
    resolved_status_for_attendance: str | None = None


@app.post("/disputes/{dispute_id}/resolve")
@limiter.limit("20/minute")
def resolve_dispute_endpoint(request: Request, dispute_id: str, body: ResolveDisputeRequest):
    try:
        result = resolve_dispute(dispute_id, body.status, body.resolved_status_for_attendance)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result
