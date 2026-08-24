from datetime import datetime, timezone, timedelta
from app.db.client import get_client

BUCKET = "capture-frames"


def cleanup_expired_evidence_photos(institution_id: str) -> dict:
    """Spec Section 9 (Privacy & Biometric Data Lifecycle): 'Evidence
    photos: kept only long enough to support the dispute window -- a
    short, configurable retention period, then deleted.'

    Deletes evidence photos whose finalize window has passed
    (dispute_window_hours from attendance_config), then nulls the
    evidence_photo_url column so the DB never points at a dead file.
    """
    client = get_client()

    config = (client.table("attendance_config").select("dispute_window_hours")
              .eq("institution_id", institution_id).eq("is_active", True).execute())
    window_hours = config.data[0]["dispute_window_hours"] if config.data else 48

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()

    old_sessions = (client.table("class_sessions")
                     .select("id")
                     .eq("institution_id", institution_id)
                     .lt("finalized_at", cutoff)
                     .not_.is_("finalized_at", "null")
                     .execute())
    session_ids = [s["id"] for s in old_sessions.data]
    if not session_ids:
        return {"sessions_checked": 0, "photos_deleted": 0, "errors": 0}

    obs = (client.table("attendance_observations")
           .select("id, evidence_photo_url")
           .in_("session_id", session_ids)
           .not_.is_("evidence_photo_url", "null")
           .execute())

    deleted = 0
    errors = 0
    for row in obs.data:
        try:
            client.storage.from_(BUCKET).remove([row["evidence_photo_url"]])
            client.table("attendance_observations").update(
                {"evidence_photo_url": None}
            ).eq("id", row["id"]).execute()
            deleted += 1
        except Exception:
            errors += 1

    return {"sessions_checked": len(session_ids), "photos_deleted": deleted, "errors": errors}
