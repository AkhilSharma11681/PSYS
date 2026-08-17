import io
from datetime import datetime, timezone
from PIL import Image
from app.db.client import get_client

BUCKET = "capture-frames"


def upload_frame(frame, institution_id: str, session_id: str, camera_id: str) -> str | None:
    """Uploads a captured RGB frame as JPEG to Supabase Storage.
    Returns the storage path on success, None on failure. Storage
    problems (bucket missing, network blip) should never take down
    the recognition pipeline, so this always swallows exceptions
    rather than raising."""
    try:
        client = get_client()
        img = Image.fromarray(frame)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        buffer.seek(0)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        path = f"{institution_id}/{session_id}/{camera_id}/{timestamp}.jpg"

        client.storage.from_(BUCKET).upload(
            path, buffer.read(), {"content-type": "image/jpeg"}
        )
        return path
    except Exception:
        return None
