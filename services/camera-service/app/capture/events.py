from datetime import datetime, timezone
from app.db.client import get_client

def log_capture_event(institution_id: str, session_id: str, camera_id: str,
                       succeeded: bool, error: str | None):
    client = get_client()
    client.table("capture_events").insert({
        "institution_id": institution_id,
        "session_id": session_id,
        "camera_id": camera_id,
        "attempted_at": datetime.now(timezone.utc).isoformat(),
        "succeeded": succeeded,
        "error": error,
        "frame_stored": False,
    }).execute()
