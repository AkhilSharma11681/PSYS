import io
import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image
import numpy as np
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.workers.capture_worker import run_capture_job, TenantMismatchError, SessionNotActiveError
from app.recognition.provider import DlibFaceRecognitionProvider
from app.finalization.orchestrator import finalize_session
from app.finalization.review import get_review_queue
from app.finalization.disputes import create_dispute, resolve_dispute
from app.reporting.export import export_session_csv
from app.scheduling.lifecycle import run_tick
from app.auth.verify import get_current_user, require_same_institution
from app.db.client import get_client

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
    except TenantMismatchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SessionNotActiveError as e:
        raise HTTPException(status_code=409, detail=str(e))
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
def finalize(request: Request, session_id: str, current_user: dict = Depends(get_current_user)):
    client = get_client()
    session = client.table("class_sessions").select("institution_id").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="session not found")
    require_same_institution(current_user, session.data[0]["institution_id"])

    try:
        result = finalize_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@app.get("/sessions/{session_id}/review")
@limiter.limit("60/minute")
def review(request: Request, session_id: str, current_user: dict = Depends(get_current_user)):
    client = get_client()
    session = client.table("class_sessions").select("institution_id").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="session not found")
    require_same_institution(current_user, session.data[0]["institution_id"])

    return {"session_id": session_id, "flagged": get_review_queue(session_id)}


@app.get("/sessions/{session_id}/export.csv")
@limiter.limit("30/minute")
def export_csv(request: Request, session_id: str, current_user: dict = Depends(get_current_user)):
    client = get_client()
    session = client.table("class_sessions").select("institution_id").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="session not found")
    require_same_institution(current_user, session.data[0]["institution_id"])

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
def submit_dispute(request: Request, body: DisputeRequest, current_user: dict = Depends(get_current_user)):
    """Camera-service's Phase 7 scope: auto-attaches evidence, the
    submission UI/workflow itself is teammate's territory."""
    require_same_institution(current_user, body.institution_id)

    try:
        result = create_dispute(body.institution_id, body.final_attendance_id,
                                 body.session_id, body.student_id, body.reason)
    except ValueError as e:
        if "dispute_window_expired" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    return result


class ResolveDisputeRequest(BaseModel):
    status: str
    resolved_status_for_attendance: str | None = None


@app.post("/disputes/{dispute_id}/resolve")
@limiter.limit("20/minute")
def resolve_dispute_endpoint(request: Request, dispute_id: str, body: ResolveDisputeRequest,
                              current_user: dict = Depends(get_current_user)):
    client = get_client()
    dispute = client.table("disputes").select("institution_id").eq("id", dispute_id).execute()
    if not dispute.data:
        raise HTTPException(status_code=404, detail="dispute not found")
    require_same_institution(current_user, dispute.data[0]["institution_id"])

    try:
        result = resolve_dispute(dispute_id, body.status, body.resolved_status_for_attendance)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@app.post("/tick")
@limiter.limit("30/minute")
def tick(request: Request):
    """Free-tier alternative to a dedicated Background Worker."""
    expected = os.environ.get("TICK_SECRET")
    if not expected or request.headers.get("X-Tick-Secret") != expected:
        raise HTTPException(status_code=403, detail="forbidden")
    return run_tick()
