from datetime import datetime, timezone
from app.db.client import get_client

def update_camera_health(camera_id: str, succeeded: bool, error: str | None):
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    existing = client.table("camera_health").select("*").eq("camera_id", camera_id).execute()
    consecutive_failures = 0
    if existing.data:
        consecutive_failures = existing.data[0].get("consecutive_failures", 0)

    if succeeded:
        payload = {
            "camera_id": camera_id,
            "last_frame_at": now,
            "consecutive_failures": 0,
            "status": "healthy",
            "last_error": None,
        }
    else:
        consecutive_failures += 1
        status = "degraded" if consecutive_failures < 5 else "offline"
        payload = {
            "camera_id": camera_id,
            "consecutive_failures": consecutive_failures,
            "status": status,
            "last_error": error,
        }

    client.table("camera_health").upsert(payload).execute()
