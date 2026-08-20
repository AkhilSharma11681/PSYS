from datetime import datetime, timezone
from app.db.client import get_client


def record_processing_metric(institution_id: str, session_id: str, succeeded: bool, processing_time_ms: float):
    """Upserts one aggregated processing_metrics row per session, per
    spec's 'aggregate, low-cardinality counters' design -- not one row
    per frame."""
    client = get_client()
    existing = client.table("processing_metrics").select("*").eq("session_id", session_id).execute()

    if existing.data:
        row = existing.data[0]
        frames_attempted = row["frames_attempted"] + 1
        frames_succeeded = row["frames_succeeded"] + (1 if succeeded else 0)
        prev_avg = row["avg_processing_time_ms"] or 0
        prev_count = row["frames_attempted"]
        new_avg = ((prev_avg * prev_count) + processing_time_ms) / frames_attempted

        client.table("processing_metrics").update({
            "frames_attempted": frames_attempted,
            "frames_succeeded": frames_succeeded,
            "avg_processing_time_ms": new_avg,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", row["id"]).execute()
    else:
        client.table("processing_metrics").insert({
            "institution_id": institution_id,
            "session_id": session_id,
            "frames_attempted": 1,
            "frames_succeeded": 1 if succeeded else 0,
            "avg_processing_time_ms": processing_time_ms,
        }).execute()
