from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.workers.capture_worker import run_capture_job

app = FastAPI(title="PSYS Camera Service")


@app.get("/health")
def health():
    return {"status": "ok"}


class SessionRequest(BaseModel):
    session_id: str


@app.post("/cameras/{camera_id}/capture-and-recognize")
def capture_and_recognize(camera_id: str, body: SessionRequest):
    try:
        result = run_capture_job(camera_id, body.session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
